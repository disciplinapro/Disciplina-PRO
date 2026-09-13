import { jest } from '@jest/globals'
import type { PrismaService } from '../../../database/prisma.service.js'
import { PrismaReportingRepository } from './prisma-reporting.repository.js'

const context = { tenantId: 'tenant', membershipId: 'actor', userId: 'user', tenantRole: 'CEO' as const }
const latest = new Date('2026-09-13T10:00:00Z')
const enrollment = { membershipId: 'one', programId: 'program', programVersionId: 'version', programVersion: { title: 'Protocolo 77' }, status: 'ACTIVE', startedOn: new Date('2026-09-01'), _count: { activityCompletions: 2, dailyRecords: 1 }, activityCompletions: [{ completedAt: latest }], dailyRecords: [{ submittedAt: new Date('2026-09-12') }] }
const memberships = [{ id: 'one', role: 'MANAGER', user: { email: 'manager@example.test' } }, { id: 'two', role: 'USER', user: { email: 'participant@example.test' } }]

describe('Nominal project adherence', () => {
  it('keeps one row per active member, includes non-starters and finds the last objective activity', async () => {
    const findMany = jest.fn(() => [enrollment, { ...enrollment, status: 'COMPLETED' }])
    const prisma = {
      tenantMembership: { findFirst: jest.fn(() => ({ id: 'actor' })), findMany: jest.fn(() => memberships) },
      enrollment: { findMany },
    }
    const report = await new PrismaReportingRepository(prisma as unknown as PrismaService).findTenant(context)
    expect(report.members).toHaveLength(2)
    expect(report.members?.[0]).toMatchObject({ startedEnrollments: 2, activeEnrollments: 1, completedEnrollments: 1, activityCompletions: 4, lastObjectiveActivityAt: latest })
    expect(report.members?.[1]).toMatchObject({ startedEnrollments: 0, activityCompletions: 0, lastObjectiveActivityAt: null })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', membership: { status: 'ACTIVE', user: { status: 'ACTIVE' } } } }))
  })
  it('does not treat a merely available cycle as started in a managed team', async () => {
    const findMany = jest.fn(() => [{ ...enrollment, status: 'AVAILABLE', startedOn: null, _count: { activityCompletions: 0, dailyRecords: 0 }, activityCompletions: [], dailyRecords: [] }])
    const teamRead = jest.fn(() => ({ id: 'team', name: 'Equipe', memberships: memberships.map((membership) => ({ membership })) }))
    const prisma = { tenantMembership: { findFirst: jest.fn(() => ({ id: 'actor' })) }, team: { findFirst: teamRead }, enrollment: { findMany } }
    const report = await new PrismaReportingRepository(prisma as unknown as PrismaService).findTeam({ ...context, tenantRole: 'MANAGER' }, 'team')
    expect(report?.members[0]).toMatchObject({ enrollments: 1, startedEnrollments: 0, lastObjectiveActivityAt: null })
    expect(teamRead).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant', memberships: { some: { membershipId: 'actor', role: 'MANAGER', endedAt: null } } }) as unknown }))
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', membershipId: { in: ['one', 'two'] } } }))
  })
})
