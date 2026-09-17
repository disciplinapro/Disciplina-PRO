import { jest } from '@jest/globals'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { PrivateDataRepository } from './private-data.repository.js'
import { CleanupExpiredPrivateDataUseCase, DeleteMyPrivateDataUseCase } from './private-data.use-cases.js'

const context: CurrentTenantContext = { tenantId: 'tenant', membershipId: 'membership', userId: 'user', tenantRole: 'USER' }
const result = { privateResponses: 1, trackerBehaviors: 2, trackerMarks: 3, trackerJustifications: 1, derivedEvents: 3 }

it('uses a twelve-month cutoff and delegates deletion to the owner-scoped repository', async () => {
  const deleteMine = jest.fn<PrivateDataRepository['deleteMine']>().mockResolvedValue(result)
  const cleanupExpired = jest.fn<PrivateDataRepository['cleanupExpired']>().mockResolvedValue(result)
  const repository = { deleteMine, cleanupExpired } as PrivateDataRepository

  await expect(new DeleteMyPrivateDataUseCase(repository).execute(context)).resolves.toBe(result)
  expect(deleteMine).toHaveBeenCalledWith(context)

  await new CleanupExpiredPrivateDataUseCase(repository).execute(new Date('2026-09-16T12:00:00.000Z'))
  expect(cleanupExpired).toHaveBeenCalledWith({ cutoff: new Date('2025-09-16T12:00:00.000Z') })
})
