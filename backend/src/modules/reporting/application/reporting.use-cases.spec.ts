import { jest } from '@jest/globals'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { ReportingRepository } from './reporting.repository.js'
import { GetInactiveParticipantsReportUseCase, GetPersonalReportUseCase, GetTeamReportUseCase, GetTenantReportUseCase } from './reporting.use-cases.js'

describe('GetPersonalReportUseCase', () => {
  it('delegates the trusted tenant context to the reporting boundary', async () => {
    const context = {
      userId: '01900000-0000-7000-8000-000000000001',
      tenantId: '01900000-0000-7000-8000-000000000002',
      membershipId: '01900000-0000-7000-8000-000000000003',
      tenantRole: 'USER',
    } satisfies CurrentTenantContext
    const result = {
      membershipId: context.membershipId,
      summary: { enrollments: 0, activeEnrollments: 0, completedEnrollments: 0, activityCompletions: 0, dailyRecords: 0 },
      programs: [],
    }
    const findPersonal = jest.fn<ReportingRepository['findPersonal']>().mockResolvedValue(result)
    const findTeam = jest.fn<ReportingRepository['findTeam']>()
    const findTenant = jest.fn<ReportingRepository['findTenant']>()
    const findInactiveParticipants = jest.fn<ReportingRepository['findInactiveParticipants']>()
    const repository = { findPersonal, findTeam, findTenant, findInactiveParticipants } as ReportingRepository

    await expect(new GetPersonalReportUseCase(repository).execute(context)).resolves.toBe(result)
    expect(findPersonal).toHaveBeenCalledWith(context)

    await new GetTeamReportUseCase(repository).execute(context, '01900000-0000-7000-8000-000000000004')
    expect(findTeam).toHaveBeenCalledWith(context, '01900000-0000-7000-8000-000000000004')

    await new GetTenantReportUseCase(repository).execute(context)
    expect(findTenant).toHaveBeenCalledWith(context)

    const now = new Date('2026-09-01T00:00:00.000Z')
    await new GetInactiveParticipantsReportUseCase(repository).execute(context, now)
    expect(findInactiveParticipants).toHaveBeenCalledWith(context, new Date('2026-08-02T00:00:00.000Z'))
  })
})
