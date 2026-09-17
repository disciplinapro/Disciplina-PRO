import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/app.module.js'
import { PrismaService } from '../src/database/prisma.service.js'
import { DeleteMyPrivateDataUseCase } from '../src/modules/privacy/application/private-data.use-cases.js'
import type { CurrentTenantContext } from '../src/modules/organizations/application/organization-context.repository.js'

describe('Private data lifecycle integration', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
  })

  afterAll(async () => app.close())

  it('deletes owner private categories and their derived tracker events without touching administrative audit', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const user = await prisma.user.create({ data: { email: `privacy-${suffix}@test.invalid`, normalizedEmail: `privacy-${suffix}@test.invalid`, passwordHash: 'integration' } })
    const tenant = await prisma.tenant.create({ data: { name: 'Privacy', slug: `privacy-${suffix}`, status: 'ACTIVE' } })
    const membership = await prisma.tenantMembership.create({ data: { tenantId: tenant.id, userId: user.id } })
    const program = await prisma.program.create({ data: { slug: `privacy-${suffix}`, name: 'Privacy', summary: 'Privacy.' } })
    const version = await prisma.programVersion.create({ data: { programId: program.id, versionNumber: 1, title: 'Privacy', description: 'Privacy.', durationDays: 10 } })
    const phase = await prisma.programPhase.create({ data: { programVersionId: version.id, key: 'phase', title: 'Phase', description: 'Phase.', position: 1 } })
    const activity = await prisma.programActivity.create({
      data: { programVersionId: version.id, programPhaseId: phase.id, key: 'private', title: 'Private', description: 'Private.', position: 1, type: 'REFLECTION', frequency: 'DAILY' },
    })
    const tenantProgram = await prisma.tenantProgram.create({ data: { tenantId: tenant.id, programId: program.id } })
    const enrollment = await prisma.enrollment.create({
      data: {
        tenantId: tenant.id,
        tenantProgramId: tenantProgram.id,
        programId: program.id,
        membershipId: membership.id,
        programVersionId: version.id,
        status: 'ACTIVE',
        timeZone: 'America/Bahia',
        startedAt: new Date('2026-01-01T12:00:00.000Z'),
        startedOn: new Date('2026-01-01'),
      },
    })
    const response = await prisma.privateActivityResponse.create({
      data: { tenantId: tenant.id, enrollmentId: enrollment.id, programVersionId: version.id, activityId: activity.id, programDay: 1, programDate: new Date('2026-01-01'), payload: { note: 'intimate' } },
    })
    await prisma.auditEvent.createMany({ data: [
      { tenantId: tenant.id, actorType: 'MEMBERSHIP', actorMembershipId: membership.id, targetMembershipId: membership.id, entityType: 'PrivateActivityResponse', entityId: response.id, action: 'PRIVATE_RESPONSE_CREATED' },
      { tenantId: tenant.id, actorType: 'MEMBERSHIP', actorMembershipId: membership.id, entityType: 'TenantMembership', entityId: membership.id, action: 'MEMBERSHIP_PROFILE_VIEWED' },
    ] })

    const behavior = await prisma.trackerBehavior.create({ data: { tenantId: tenant.id, membershipId: membership.id, name: 'Private habit', normalizedName: 'private habit', position: 0 } })
    const trackedOn = new Date('2026-01-01')
    const mark = await prisma.trackerMark.create({ data: { tenantId: tenant.id, membershipId: membership.id, behaviorId: behavior.id, trackedOn, status: 'FAILED' } })
    await prisma.trackerJustification.create({ data: { tenantId: tenant.id, membershipId: membership.id, trackerMarkId: mark.id, text: 'Private reason' } })
    const internalEvent = await prisma.internalEvent.create({
      data: {
        tenantId: tenant.id,
        type: 'tracker.mark.recorded.v1',
        version: 1,
        aggregateType: 'TrackerBehavior',
        aggregateId: behavior.id,
        sourceKey: `tracker-mark:${membership.id}:${behavior.id}:2026-01-01`,
        payload: { membershipId: membership.id, behaviorId: behavior.id, trackedOn: '2026-01-01', status: 'FAILED' },
        occurredAt: trackedOn,
      },
    })
    await prisma.internalEventDelivery.create({ data: { internalEventId: internalEvent.id, consumer: 'privacy-test' } })
    await prisma.xpTransaction.create({
      data: { tenantId: tenant.id, membershipId: membership.id, internalEventId: internalEvent.id, ruleKey: 'tracker.mark.v1', eventType: internalEvent.type, amount: 5, description: 'Tracker', occurredAt: trackedOn },
    })

    const context: CurrentTenantContext = { tenantId: tenant.id, membershipId: membership.id, userId: user.id, tenantRole: 'USER' }
    await expect(app.get(DeleteMyPrivateDataUseCase).execute(context)).resolves.toMatchObject({
      privateResponses: 1, trackerBehaviors: 1, trackerMarks: 1, trackerJustifications: 1, derivedEvents: 1,
    })
    expect(await prisma.privateActivityResponse.count({ where: { id: response.id } })).toBe(0)
    expect(await prisma.trackerBehavior.count({ where: { id: behavior.id } })).toBe(0)
    expect(await prisma.internalEvent.count({ where: { id: internalEvent.id } })).toBe(0)
    expect(await prisma.auditEvent.count({ where: { action: 'PRIVATE_RESPONSE_CREATED', entityId: response.id } })).toBe(0)
    expect(await prisma.auditEvent.count({ where: { action: 'MEMBERSHIP_PROFILE_VIEWED', entityId: membership.id } })).toBe(1)
  })
})
