import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'

export interface PrivateDataPurgeResult {
  privateResponses: number
  trackerBehaviors: number
  trackerMarks: number
  trackerJustifications: number
  derivedEvents: number
}

export abstract class PrivateDataRepository {
  abstract deleteMine(context: CurrentTenantContext): Promise<PrivateDataPurgeResult | null>
  abstract cleanupExpired(input: { cutoff: Date }): Promise<PrivateDataPurgeResult>
}
