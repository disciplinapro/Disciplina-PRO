import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/app.module.js'
import { PrismaService } from '../src/database/prisma.service.js'
import type { CurrentTenantContext } from '../src/modules/organizations/application/organization-context.repository.js'
import { GetTeamReportUseCase } from '../src/modules/reporting/application/reporting.use-cases.js'

describe('Team reporting integration', () => {
  let app: INestApplication
  let prisma: PrismaService
  let managerContext: CurrentTenantContext
  let ceoContext: CurrentTenantContext
  let teamId: string
  let outsideTeamId: string
  let foreignTeamId: string
  let memberId: string
  const privateMarker = 'reflexão íntima exclusiva do participante'

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const [ceo, manager, member, outside, foreign] = await Promise.all(
      ['ceo', 'manager', 'member', 'outside', 'foreign'].map((name) => prisma.user.create({
        data: {
          email: `team-report-${name}-${suffix}@test.invalid`,
          normalizedEmail: `team-report-${name}-${suffix}@test.invalid`,
          passwordHash: 'integration',
        },
      })),
    )
    const [tenant, foreignTenant] = await Promise.all([
      prisma.tenant.create({ data: { name: 'Team report', slug: `team-report-${suffix}`, status: 'ACTIVE' } }),
      prisma.tenant.create({ data: { name: 'Foreign report', slug: `foreign-team-report-${suffix}`, status: 'ACTIVE' } }),
    ])
    const [ceoMembership, managerMembership, memberMembership, outsideMembership, foreignMembership] = await Promise.all([
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: ceo.id, role: 'CEO' } }),
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: manager.id, role: 'MANAGER' } }),
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: member.id } }),
      prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: outside.id } }),
      prisma.tenantMembership.create({ data: { tenantId: foreignTenant.id, userId: foreign.id, role: 'CEO' } }),
    ])
    memberId = memberMembership.id
    ceoContext = { tenantId: tenant.id, membershipId: ceoMembership.id, userId: ceo.id, tenantRole: 'CEO' }
    managerContext = { tenantId: tenant.id, membershipId: managerMembership.id, userId: manager.id, tenantRole: 'MANAGER' }
    const [team, outsideTeam, foreignTeam] = await Promise.all([
      prisma.team.create({ data: { tenantId: tenant.id, name: 'Managed', normalizedName: 'managed' } }),
      prisma.team.create({ data: { tenantId: tenant.id, name: 'Outside', normalizedName: 'outside' } }),
      prisma.team.create({ data: { tenantId: foreignTenant.id, name: 'Foreign', normalizedName: 'foreign' } }),
    ])
    teamId = team.id
    outsideTeamId = outsideTeam.id
    foreignTeamId = foreignTeam.id
    await prisma.teamMembership.createMany({
      data: [
        { tenantId: tenant.id, teamId, membershipId: managerMembership.id, role: 'MANAGER' },
        { tenantId: tenant.id, teamId, membershipId: memberMembership.id },
        { tenantId: tenant.id, teamId: outsideTeamId, membershipId: outsideMembership.id },
        { tenantId: foreignTenant.id, teamId: foreignTeamId, membershipId: foreignMembership.id, role: 'MANAGER' },
      ],
    })

    const program = await prisma.program.create({ data: { slug: `team-report-${suffix}`, name: 'Objetivo', summary: 'Objetivo.' } })
    const version = await prisma.programVersion.create({
      data: { programId: program.id, versionNumber: 1, title: 'Objetivo', description: 'Objetivo.', durationDays: 10 },
    })
    const phase = await prisma.programPhase.create({
      data: { programVersionId: version.id, key: 'phase', title: 'Fase', description: 'Fase.', position: 1 },
    })
    const activity = await prisma.programActivity.create({
      data: {
        programVersionId: version.id,
        programPhaseId: phase.id,
        key: 'daily',
        title: 'Diária',
        description: 'Objetiva.',
        position: 1,
        type: 'TASK',
        frequency: 'DAILY',
      },
    })
    const tenantProgram = await prisma.tenantProgram.create({ data: { tenantId: tenant.id, programId: program.id } })
    const memberEnrollment = await createEnrollment(tenant.id, tenantProgram.id, program.id, version.id, memberMembership.id)
    const outsideEnrollment = await createEnrollment(tenant.id, tenantProgram.id, program.id, version.id, outsideMembership.id)
    await Promise.all([
      createCompletion(tenant.id, memberEnrollment.id, version.id, activity.id),
      createCompletion(tenant.id, outsideEnrollment.id, version.id, activity.id),
      prisma.dailyRecord.create({
        data: { tenantId: tenant.id, enrollmentId: memberEnrollment.id, programDay: 1, programDate: new Date('2026-08-01T00:00:00.000Z') },
      }),
      prisma.privateActivityResponse.create({
        data: {
          tenantId: tenant.id,
          enrollmentId: memberEnrollment.id,
          programVersionId: version.id,
          activityId: activity.id,
          programDay: 1,
          programDate: new Date('2026-08-01T00:00:00.000Z'),
          payload: { secret: privateMarker },
        },
      }),
    ])
  })

  afterAll(async () => app.close())

  it('limits a manager to the actively managed team and suppresses a small group', async () => {
    const reporting = app.get(GetTeamReportUseCase)
    const report = await reporting.execute(managerContext, teamId)
    expect(report).toMatchObject({
      teamId,
      name: 'Managed',
      minimumGroupSize: 10,
      suppressed: true,
      summary: { participants: null, startedParticipants: null, participantsWithActivity: null },
    })
    expect(report).not.toHaveProperty('members')
    expect(JSON.stringify(report)).not.toContain(memberId)
    expect(JSON.stringify(report)).not.toContain(privateMarker)
    await expect(reporting.execute(managerContext, outsideTeamId)).resolves.toBeNull()
    await expect(reporting.execute(managerContext, foreignTeamId)).resolves.toBeNull()
  })

  it('allows the CEO to read any team in the tenant without crossing tenantId', async () => {
    const reporting = app.get(GetTeamReportUseCase)
    await expect(reporting.execute(ceoContext, outsideTeamId)).resolves.toMatchObject({
      teamId: outsideTeamId,
      suppressed: true,
      summary: { participants: null, participantsWithActivity: null },
    })
    await expect(reporting.execute(ceoContext, foreignTeamId)).resolves.toBeNull()
  })

  async function createEnrollment(tenantId: string, tenantProgramId: string, programId: string, programVersionId: string, membershipId: string) {
    return prisma.enrollment.create({
      data: {
        tenantId,
        tenantProgramId,
        programId,
        membershipId,
        programVersionId,
        status: 'ACTIVE',
        timeZone: 'America/Bahia',
        startedAt: new Date('2026-08-01T12:00:00.000Z'),
        startedOn: new Date('2026-08-01T00:00:00.000Z'),
      },
    })
  }

  async function createCompletion(tenantId: string, enrollmentId: string, programVersionId: string, activityId: string) {
    return prisma.activityCompletion.create({
      data: {
        tenantId,
        enrollmentId,
        programVersionId,
        activityId,
        programDay: 1,
        programDate: new Date('2026-08-01T00:00:00.000Z'),
        occurrenceKey: 'day:1',
      },
    })
  }
})
