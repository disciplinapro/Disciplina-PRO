import { type INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module.js'
import { PrismaService } from '../src/database/prisma.service.js'
import { configureApp } from '../src/http/configure-app.js'
import { CreateUserUseCase } from '../src/modules/identity-access/application/create-user.use-case.js'
import type { CurrentTenantContext } from '../src/modules/organizations/application/organization-context.repository.js'
import { GetInactiveParticipantsReportUseCase, GetTenantReportUseCase } from '../src/modules/reporting/application/reporting.use-cases.js'

describe('Tenant reporting integration', () => {
  let app: INestApplication
  let prisma: PrismaService
  let ceoContext: CurrentTenantContext
  let managerContext: CurrentTenantContext
  let inactiveMemberId: string
  let activeMemberId: string
  let tenantId: string
  let foreignTenantId: string
  let teamId: string
  let outsideTeamId: string
  let ceoToken: string
  let managerToken: string
  let memberToken: string
  const inactiveSince = new Date('2026-08-01T00:00:00.000Z')
  const privateMarker = 'segredo que não atravessa o reporting do tenant'
  const password = 'uma frase segura para reporting HTTP'
  const origin = 'http://localhost:5173'

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
    prisma = app.get(PrismaService)
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const emails = ['ceo', 'manager', 'inactive', 'active', 'recent', 'disabled', 'foreign']
      .map((name) => `tenant-report-${name}-${suffix}@test.invalid`)
    const users = await Promise.all(emails.map((email) => app.get(CreateUserUseCase).execute({ email, password })))
    const [tenant, foreignTenant] = await Promise.all([
      prisma.tenant.create({ data: { name: 'Tenant report', slug: `tenant-report-${suffix}`, status: 'ACTIVE' } }),
      prisma.tenant.create({ data: { name: 'Foreign', slug: `foreign-tenant-report-${suffix}`, status: 'ACTIVE' } }),
    ])
    tenantId = tenant.id
    foreignTenantId = foreignTenant.id
    const oldMembershipDate = new Date('2026-07-01T00:00:00.000Z')
    const [ceo, manager, inactive, active, recent, disabled, foreign] = await Promise.all([
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: users[0].id, role: 'CEO', createdAt: oldMembershipDate } }),
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: users[1].id, role: 'MANAGER', createdAt: oldMembershipDate } }),
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: users[2].id, createdAt: oldMembershipDate } }),
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: users[3].id, createdAt: oldMembershipDate } }),
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: users[4].id, createdAt: new Date('2026-08-02T00:00:00.000Z') } }),
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: users[5].id, status: 'INACTIVE', createdAt: oldMembershipDate, deactivatedAt: new Date() } }),
      prisma.tenantMembership.create({ data: { tenantId: foreignTenant.id, userId: users[6].id, role: 'CEO', createdAt: oldMembershipDate } }),
    ])
    inactiveMemberId = inactive.id
    activeMemberId = active.id
    ceoContext = { tenantId: tenant.id, membershipId: ceo.id, userId: users[0].id, tenantRole: 'CEO' }
    managerContext = { tenantId: tenant.id, membershipId: manager.id, userId: users[1].id, tenantRole: 'MANAGER' }
    const [team, outsideTeam] = await Promise.all([
      prisma.team.create({ data: { tenantId: tenant.id, name: 'Managed report', normalizedName: 'managed report' } }),
      prisma.team.create({ data: { tenantId: tenant.id, name: 'Outside report', normalizedName: 'outside report' } }),
    ])
    teamId = team.id
    outsideTeamId = outsideTeam.id
    await prisma.teamMembership.createMany({ data: [
      { tenantId: tenant.id, teamId, membershipId: manager.id, role: 'MANAGER' },
      { tenantId: tenant.id, teamId, membershipId: active.id },
      { tenantId: tenant.id, teamId: outsideTeamId, membershipId: inactive.id },
    ] })

    const program = await prisma.program.create({ data: { slug: `tenant-report-${suffix}`, name: 'Programa', summary: 'Objetivo.' } })
    const version = await prisma.programVersion.create({
      data: { programId: program.id, versionNumber: 1, title: 'Programa', description: 'Objetivo.', durationDays: 10 },
    })
    const phase = await prisma.programPhase.create({
      data: { programVersionId: version.id, key: 'phase', title: 'Fase', description: 'Fase.', position: 1 },
    })
    const activity = await prisma.programActivity.create({
      data: { programVersionId: version.id, programPhaseId: phase.id, key: 'daily', title: 'Diária', description: 'Objetiva.', position: 1, type: 'TASK', frequency: 'DAILY' },
    })
    const [tenantProgram, foreignTenantProgram] = await Promise.all([
      prisma.tenantProgram.create({ data: { tenantId: tenant.id, programId: program.id } }),
      prisma.tenantProgram.create({ data: { tenantId: foreignTenant.id, programId: program.id } }),
    ])
    const [inactiveEnrollment, activeEnrollment, recentEnrollment, disabledEnrollment, foreignEnrollment] = await Promise.all([
      createEnrollment(tenant.id, tenantProgram.id, program.id, version.id, inactive.id),
      createEnrollment(tenant.id, tenantProgram.id, program.id, version.id, active.id),
      createEnrollment(tenant.id, tenantProgram.id, program.id, version.id, recent.id),
      createEnrollment(tenant.id, tenantProgram.id, program.id, version.id, disabled.id),
      createEnrollment(foreignTenant.id, foreignTenantProgram.id, program.id, version.id, foreign.id),
    ])
    await Promise.all([
      createCompletion(tenant.id, inactiveEnrollment.id, version.id, activity.id, new Date('2026-07-20T12:00:00.000Z')),
      createCompletion(tenant.id, activeEnrollment.id, version.id, activity.id, new Date('2026-08-02T12:00:00.000Z')),
      createCompletion(tenant.id, disabledEnrollment.id, version.id, activity.id, new Date('2026-07-20T12:00:00.000Z')),
      createCompletion(foreignTenant.id, foreignEnrollment.id, version.id, activity.id, new Date('2026-08-02T12:00:00.000Z')),
      prisma.dailyRecord.create({
        data: { tenantId: tenant.id, enrollmentId: activeEnrollment.id, programDay: 2, programDate: new Date('2026-08-02T00:00:00.000Z'), submittedAt: new Date('2026-08-02T12:30:00.000Z') },
      }),
      prisma.privateActivityResponse.create({
        data: {
          tenantId: tenant.id,
          enrollmentId: activeEnrollment.id,
          programVersionId: version.id,
          activityId: activity.id,
          programDay: 2,
          programDate: new Date('2026-08-02T00:00:00.000Z'),
          payload: { secret: privateMarker },
        },
      }),
    ])
    void recentEnrollment
    ceoToken = await login(emails[0])
    managerToken = await login(emails[1])
    memberToken = await login(emails[3])
  })

  afterAll(async () => app.close())

  it('returns CEO-only tenant aggregates without private or foreign data', async () => {
    const report = await app.get(GetTenantReportUseCase).execute(ceoContext)
    expect(report).toMatchObject({
      tenantId: ceoContext.tenantId,
      minimumGroupSize: 10,
      suppressed: true,
      summary: { participants: null, startedParticipants: null, participantsWithActivity: null },
      programs: [],
    })
    expect(JSON.stringify(report)).not.toContain(privateMarker)
    await expect(app.get(GetTenantReportUseCase).execute(managerContext)).rejects.toThrow('Contexto de reporting inválido')
  })

  it('suppresses the fixed inactivity metric when the participant cohort is too small', async () => {
    const report = await app.get(GetInactiveParticipantsReportUseCase).execute(ceoContext, new Date('2026-09-01T00:00:00.000Z'))
    expect(report).toMatchObject({ windowDays: 30, minimumGroupSize: 10, suppressed: true, inactiveParticipants: null })
    expect(JSON.stringify(report)).not.toContain(inactiveMemberId)
    expect(JSON.stringify(report)).not.toContain(activeMemberId)
    expect(JSON.stringify(report)).not.toContain(privateMarker)
  })

  it('enforces the complete HTTP authorization, tenant, validation, and privacy matrix', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0]).get('/api/reports/me').expect(401)
    const mine = await api('/me', memberToken).expect(200)
    await api(`/teams/${teamId}`, memberToken).expect(403)
    const team = await api(`/teams/${teamId}`, managerToken).expect(200)
    await api(`/teams/${outsideTeamId}`, managerToken).expect(404)
    await api('/tenant', managerToken).expect(403)
    await api('/inactive-members', managerToken).expect(403)
    const tenant = await api('/tenant', ceoToken).expect(200)
    const inactive = await api('/inactive-members', ceoToken).expect(200)
    await api(`/inactive-members?inactiveSince=${encodeURIComponent(inactiveSince.toISOString())}`, ceoToken).expect(200)
    await api('/tenant', ceoToken, foreignTenantId).expect(403)
    const serialized = JSON.stringify([mine.body, team.body, tenant.body, inactive.body])
    expect(serialized).not.toContain(privateMarker)
    expect(serialized).not.toContain('privateResponses')
    expect(serialized).not.toContain('payload')
    expect(serialized).not.toContain('metadata')
  })

  it('publishes every reporting route and its allowlisted response schema in OpenAPI', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle('Disciplina PRO API').addBearerAuth({ type: 'http', scheme: 'bearer' }, 'access-token').build())
    for (const path of ['/reports/me', '/reports/teams/{teamId}', '/reports/tenant', '/reports/inactive-members']) {
      const operation = document.paths[`/api${path}`]?.get ?? document.paths[path]?.get
      expect(operation).toBeDefined()
      expect(operation?.security).toEqual(expect.arrayContaining([{ 'access-token': [] }]))
      const response = operation?.responses?.['200']
      if (!response || !('content' in response)) throw new Error(`Contrato 200 ausente em ${path}`)
      expect(response.content?.['application/json']?.schema).toBeDefined()
    }
    const schemas = JSON.stringify(document.components?.schemas)
    expect(schemas).toContain('PersonalReportResponseDto')
    expect(schemas).toContain('InactiveParticipantsReportResponseDto')
    expect(schemas).not.toContain('PrivateActivityResponse')
    expect(schemas).not.toContain('payload')
  })

  async function login(email: string) {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/auth/login').set('Origin', origin).send({ email, password }).expect(200)
    return (response.body as { accessToken: string }).accessToken
  }

  function api(path: string, token: string, requestedTenantId = tenantId) {
    return request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/api/reports${path}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', requestedTenantId)
  }

  async function createEnrollment(tenantId: string, tenantProgramId: string, programId: string, programVersionId: string, membershipId: string) {
    return prisma.enrollment.create({
      data: { tenantId, tenantProgramId, programId, programVersionId, membershipId, status: 'ACTIVE', timeZone: 'America/Bahia', startedAt: new Date('2026-07-01T12:00:00.000Z'), startedOn: new Date('2026-07-01T00:00:00.000Z') },
    })
  }

  async function createCompletion(tenantId: string, enrollmentId: string, programVersionId: string, activityId: string, completedAt: Date) {
    return prisma.activityCompletion.create({
      data: { tenantId, enrollmentId, programVersionId, activityId, programDay: 1, programDate: new Date('2026-07-20T00:00:00.000Z'), occurrenceKey: `at:${completedAt.toISOString()}`, completedAt },
    })
  }
})
