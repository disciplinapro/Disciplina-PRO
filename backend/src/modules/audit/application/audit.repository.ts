import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'

export interface AuditEventView {
  actor?: { email: string; role: string } | null
  target?: { email: string; role: string } | null
  programTitle?: string | null
  activityTitle?: string | null
  id: string
  actorType: 'MEMBERSHIP' | 'PLATFORM_ACCESS' | 'SYSTEM'
  actorMembershipId: string | null
  targetMembershipId: string | null
  entityType: string
  entityId: string | null
  action: string
  occurredAt: Date
}

export interface AuditPage {
  items: AuditEventView[]
  page: number
  limit: number
  total: number
}

export interface AuditPageInput {
  page: number
  limit: number
}

export abstract class AuditQueryRepository {
  abstract findMine(context: CurrentTenantContext, input: AuditPageInput): Promise<AuditPage>
  abstract findTeam(context: CurrentTenantContext, teamId: string, input: AuditPageInput): Promise<AuditPage | null>
  abstract findTenant(context: CurrentTenantContext, input: AuditPageInput): Promise<AuditPage>
}
