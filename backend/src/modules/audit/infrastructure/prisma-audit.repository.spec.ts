import { jest } from '@jest/globals'
import type { PrismaService } from '../../../database/prisma.service.js'
import { PrismaAuditRepository } from './prisma-audit.repository.js'

const context = { tenantId: 'tenant', membershipId: 'actor', userId: 'user', tenantRole: 'CEO' as const }
describe('Audit display projection', () => {
  it('returns actor and activity labels without exposing metadata or identities from another tenant', async () => {
    const findMany = jest.fn(() => [{
      id: 'event', actorType: 'MEMBERSHIP', actorMembershipId: 'actor', targetMembershipId: 'target',
      entityType: 'Enrollment', entityId: 'cycle', action: 'ACTIVITY_COMPLETED', occurredAt: new Date(),
      metadata: { activityId: 'activity', privateText: 'must never be returned' },
      actorMembership: { tenantId: 'tenant', role: 'MANAGER', user: { email: 'manager@example.test' } },
      targetMembership: { tenantId: 'other', role: 'USER', user: { email: 'hidden@example.test' } },
    }])
    const enrollments = jest.fn(() => [{ id: 'cycle', programVersion: { title: 'Protocolo 77', activities: [{ id: 'activity', title: 'Caminhada' }] } }])
    const prisma = {
      tenantMembership: { findFirst: jest.fn(() => ({ id: 'actor' })) },
      auditEvent: { findMany, count: jest.fn(() => 1) }, enrollment: { findMany: enrollments },
    }
    const page = await new PrismaAuditRepository(prisma as unknown as PrismaService).findTenant(context, { page: 1, limit: 20 })
    expect(page.items[0]).toMatchObject({ actor: { email: 'manager@example.test', role: 'MANAGER' }, target: null, activityTitle: 'Caminhada', programTitle: 'Protocolo 77' })
    expect(page.items[0]).not.toHaveProperty('metadata')
    expect(JSON.stringify(page)).not.toContain('hidden@example.test')
    expect(enrollments).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['cycle'] }, tenantId: 'tenant' } }))
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant' }, take: 20 }))
  })
})
