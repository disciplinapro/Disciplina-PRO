import type { Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { validateEnvironment } from '../src/config/environment.js'
import { PrismaModule } from '../src/database/prisma.module.js'
import { PrismaService } from '../src/database/prisma.service.js'
import { IdentityAccessModule } from '../src/modules/identity-access/identity-access.module.js'
import { PasswordRecoveryDelivery } from '../src/modules/identity-access/application/password-recovery.delivery.js'
import { PasswordRecoveryUseCase } from '../src/modules/identity-access/application/password-recovery.use-case.js'
import { CreateUserUseCase } from '../src/modules/identity-access/application/create-user.use-case.js'
import { CreateSessionUseCase } from '../src/modules/identity-access/application/create-session.use-case.js'
import { LoginUseCase } from '../src/modules/identity-access/application/login.use-case.js'
import { Clock } from '../src/modules/identity-access/application/clock.js'
import request from 'supertest'
import { configureApp } from '../src/http/configure-app.js'

describe('Password recovery integration', () => {
  it('rotates, expires and consumes links once, revokes sessions and preserves unknown/disabled identities', async () => {
    let now = new Date()
    const deliveries: Array<{ email: string; token: string }> = []
    let failDelivery = false
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), PrismaModule, IdentityAccessModule] })
      .overrideProvider(Clock).useValue({ now: () => now })
      .overrideProvider(PasswordRecoveryDelivery).useValue({ send: (email: string, token: string) => {
        if (failDelivery) return Promise.reject(new Error('delivery unavailable'))
        deliveries.push({ email, token })
        return Promise.resolve()
      } }).compile()
    const app = moduleRef.createNestApplication({ bodyParser: false })
    configureApp(app)
    await app.init()
    try {
      const prisma = moduleRef.get(PrismaService)
      const recovery = moduleRef.get(PasswordRecoveryUseCase)
      const email = `recovery-${randomUUID()}@example.test`
      const oldPassword = 'Uma senha antiga muito segura'
      const newPassword = 'Uma senha nova muito segura'
      const user = await moduleRef.get(CreateUserUseCase).execute({ email, password: oldPassword })
      const origin = 'http://localhost:5173'
      await request(app.getHttpServer() as Server).post('/api/auth/forgot-password').send({ email }).expect(403)
      await request(app.getHttpServer() as Server).post('/api/auth/forgot-password').set('Origin', origin).send({ email: 'invalid' }).expect(400)
      const unknown = await request(app.getHttpServer() as Server).post('/api/auth/forgot-password').set('Origin', origin).send({ email: 'unknown@example.test' }).expect(200)
      const session = await moduleRef.get(CreateSessionUseCase).execute({ userId: user.id })
      await recovery.request('unknown@example.test')
      expect(deliveries).toHaveLength(0)
      const known = await request(app.getHttpServer() as Server).post('/api/auth/forgot-password').set('Origin', origin).send({ email: ` ${email.toUpperCase()} ` }).expect(200)
      expect(known.body).toEqual(unknown.body)
      await recovery.request(email)
      expect(deliveries).toHaveLength(1)
      const first = deliveries[0].token
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
      expect(stored.passwordResetHash).toHaveLength(64)
      expect(stored.passwordResetHash).not.toBe(first)
      await expect(recovery.reset(first, 'curta')).rejects.toThrow()
      now = new Date(now.getTime() + 61_000)
      await recovery.request(email)
      await expect(recovery.reset(first, newPassword)).rejects.toThrow('Link inválido')
      const second = deliveries[1].token
      now = new Date(now.getTime() + 30 * 60_000)
      await expect(recovery.reset(second, newPassword)).rejects.toThrow('Link inválido')
      await recovery.request(email)
      const third = deliveries[2].token
      const results = await Promise.allSettled([recovery.reset(third, newPassword), recovery.reset(third, newPassword)])
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      const reused = await request(app.getHttpServer() as Server).post('/api/auth/reset-password').set('Origin', origin).send({ token: third, password: newPassword }).expect(400)
      expect((reused.body as { code: string }).code).toBe('INVALID_RESET_TOKEN')
      expect((await prisma.authSession.findUniqueOrThrow({ where: { id: session.sessionId } })).revocationReason).toBe('PASSWORD_RESET')
      expect(await prisma.refreshToken.count({ where: { sessionId: session.sessionId, revokedAt: null } })).toBe(0)
      const login = moduleRef.get(LoginUseCase)
      await expect(login.execute({ email, password: oldPassword })).rejects.toThrow()
      await expect(login.execute({ email, password: newPassword })).resolves.toBeDefined()
      await prisma.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } })
      now = new Date(now.getTime() + 61_000)
      await recovery.request(email)
      expect(deliveries).toHaveLength(3)
      await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } })
      failDelivery = true
      await expect(recovery.request(email)).resolves.toBeUndefined()
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordResetHash).toBeNull()
      now = new Date(now.getTime() + 61_000)
      failDelivery = false
      await recovery.request(email)
      const resetResponse = await request(app.getHttpServer() as Server).post('/api/auth/reset-password').set('Origin', origin).send({ token: deliveries[3].token, password: newPassword }).expect(204)
      expect(resetResponse.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('dp_refresh=;'), expect.stringContaining('dp_csrf=;')]))
    } finally { await app.close() }
  }, 30_000)
})
