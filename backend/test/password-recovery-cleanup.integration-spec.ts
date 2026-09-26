import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { validateEnvironment } from '../src/config/environment.js'
import { PrismaModule } from '../src/database/prisma.module.js'
import { PrismaService } from '../src/database/prisma.service.js'
import { CleanupExpiredPasswordRecoveryUseCase } from '../src/modules/identity-access/application/cleanup-expired-password-recovery.use-case.js'
import { Clock } from '../src/modules/identity-access/application/clock.js'
import { CreateUserUseCase } from '../src/modules/identity-access/application/create-user.use-case.js'
import { IdentityAccessModule } from '../src/modules/identity-access/identity-access.module.js'

describe('Password recovery cleanup integration', () => {
  it('clears expired recovery credentials only, keeps valid and absent credentials, and is idempotent', async () => {
    const now = new Date('2026-09-26T12:00:00.000Z')
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), PrismaModule, IdentityAccessModule],
    }).overrideProvider(Clock).useValue({ now: () => now }).compile()
    await moduleRef.init()

    try {
      const prisma = moduleRef.get(PrismaService)
      const users = moduleRef.get(CreateUserUseCase)
      const suffix = randomUUID()
      const [expiredUser, validUser, noRecoveryUser] = await Promise.all([
        users.execute({ email: `recovery-cleanup-expired-${suffix}@example.test`, password: 'Uma senha segura para teste' }),
        users.execute({ email: `recovery-cleanup-valid-${suffix}@example.test`, password: 'Uma senha segura para teste' }),
        users.execute({ email: `recovery-cleanup-none-${suffix}@example.test`, password: 'Uma senha segura para teste' }),
      ])
      const tenant = await prisma.tenant.create({
        data: { name: 'Password recovery cleanup', slug: `recovery-cleanup-${suffix}` },
      })
      const membership = await prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: expiredUser.id } })
      const originalPasswordHash = (await prisma.user.findUniqueOrThrow({ where: { id: expiredUser.id } })).passwordHash
      const expiredTokenHash = randomUUID().replaceAll('-', '').repeat(2)
      const validTokenHash = randomUUID().replaceAll('-', '').repeat(2)

      await prisma.user.update({
        where: { id: expiredUser.id },
        data: { passwordResetHash: expiredTokenHash, passwordResetExpiresAt: new Date(now.getTime() - 1) },
      })
      await prisma.user.update({
        where: { id: validUser.id },
        data: { passwordResetHash: validTokenHash, passwordResetExpiresAt: new Date(now.getTime() + 60_000) },
      })

      const cleanup = moduleRef.get(CleanupExpiredPasswordRecoveryUseCase)
      await expect(cleanup.execute()).resolves.toEqual({ eligible: 1, processed: 1 })

      const expiredAfter = await prisma.user.findUniqueOrThrow({ where: { id: expiredUser.id } })
      expect(expiredAfter).toMatchObject({
        passwordHash: originalPasswordHash,
        passwordResetHash: null,
        passwordResetExpiresAt: null,
        status: 'ACTIVE',
      })
      expect(await prisma.tenantMembership.findUnique({ where: { id: membership.id } })).not.toBeNull()
      expect(await prisma.user.findUniqueOrThrow({ where: { id: validUser.id } })).toMatchObject({
        passwordResetHash: validTokenHash,
        passwordResetExpiresAt: new Date(now.getTime() + 60_000),
      })
      expect(await prisma.user.findUniqueOrThrow({ where: { id: noRecoveryUser.id } })).toMatchObject({
        passwordResetHash: null,
        passwordResetExpiresAt: null,
      })

      await expect(cleanup.execute()).resolves.toEqual({ eligible: 0, processed: 0 })
    } finally {
      await moduleRef.close()
    }
  })
})
