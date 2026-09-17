import { jest } from '@jest/globals'
import type { PrismaService } from '../../../database/prisma.service.js'
import { PrismaReportingRepository } from './prisma-reporting.repository.js'

const context = { tenantId: 'tenant', membershipId: 'actor', userId: 'user', tenantRole: 'CEO' as const }
const enrollment = { membershipId: 'member-0', programId: 'program', programVersionId: 'version', programVersion: { title: 'Protocolo 77' }, status: 'ACTIVE', startedOn: new Date('2026-09-01'), _count: { activityCompletions: 2, dailyRecords: 1 } }
const memberships = Array.from({ length: 20 }, (_, index) => ({ id: `member-${index}` }))

describe('Protected project adherence', () => {
  it('returns only aggregates when both the metric and its complement contain at least ten participants', async () => {
    const enrollments = memberships.slice(0, 10).map((membership) => ({ ...enrollment, membershipId: membership.id }))
    const findMany = jest.fn(() => enrollments)
    const prisma = {
      tenantMembership: { findFirst: jest.fn(() => ({ id: 'actor' })), findMany: jest.fn(() => memberships) },
      enrollment: { findMany },
    }
    const report = await new PrismaReportingRepository(prisma as unknown as PrismaService).findTenant(context)
    expect(report).toMatchObject({
      minimumGroupSize: 10,
      suppressed: false,
      summary: { participants: 20, startedParticipants: 10, activeParticipants: 10, participantsWithActivity: 10 },
    })
    expect(report).not.toHaveProperty('members')
    expect(JSON.stringify(report)).not.toContain('email')
  })
  it('suppresses a managed team with fewer than ten participants', async () => {
    const findMany = jest.fn(() => [])
    const teamMembers = memberships.slice(0, 2)
    const teamRead = jest.fn(() => ({ id: 'team', name: 'Equipe', memberships: teamMembers.map((membership) => ({ membership })) }))
    const prisma = { tenantMembership: { findFirst: jest.fn(() => ({ id: 'actor' })) }, team: { findFirst: teamRead }, enrollment: { findMany } }
    const report = await new PrismaReportingRepository(prisma as unknown as PrismaService).findTeam({ ...context, tenantRole: 'MANAGER' }, 'team')
    expect(report).toMatchObject({ suppressed: true, summary: { participants: null, participantsWithActivity: null } })
    expect(report).not.toHaveProperty('members')
    expect(teamRead).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant', memberships: { some: { membershipId: 'actor', role: 'MANAGER', endedAt: null } } }) as unknown }))
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', membershipId: { in: ['member-0', 'member-1'] } } }))
  })
})
