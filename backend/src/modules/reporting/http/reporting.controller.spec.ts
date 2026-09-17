import { NotFoundException } from '@nestjs/common'
import { jest } from '@jest/globals'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import type { PersonalReport, TeamReport } from '../application/reporting.repository.js'
import type { GetInactiveParticipantsReportUseCase, GetPersonalReportUseCase, GetTeamReportUseCase, GetTenantReportUseCase } from '../application/reporting.use-cases.js'
import { ReportingController } from './reporting.controller.js'

const context: CurrentTenantContext = {
  userId: '01900000-0000-7000-8000-000000000001',
  tenantId: '01900000-0000-7000-8000-000000000002',
  membershipId: '01900000-0000-7000-8000-000000000003',
  tenantRole: 'MANAGER',
}
const teamId = '01900000-0000-7000-8000-000000000004'

describe('ReportingController', () => {
  it('returns personal and team projections from their use cases', async () => {
    const personal = {
      membershipId: context.membershipId,
      summary: { enrollments: 0, activeEnrollments: 0, completedEnrollments: 0, activityCompletions: 0, dailyRecords: 0 },
      programs: [],
    } satisfies PersonalReport
    const team = {
      teamId,
      name: 'Time',
      minimumGroupSize: 10,
      suppressed: true,
      summary: { participants: null, startedParticipants: null, activeParticipants: null, completedParticipants: null, participantsWithActivity: null },
    } satisfies TeamReport
    const personalExecute = jest.fn<GetPersonalReportUseCase['execute']>().mockResolvedValue(personal)
    const teamExecute = jest.fn<GetTeamReportUseCase['execute']>().mockResolvedValue(team)
    const tenantExecute = jest.fn<GetTenantReportUseCase['execute']>().mockResolvedValue({
      tenantId: context.tenantId,
      minimumGroupSize: 10, suppressed: true, programsSuppressed: true,
      summary: { participants: null, startedParticipants: null, activeParticipants: null, completedParticipants: null, participantsWithActivity: null },
      programs: [],
    })
    const inactiveExecute = jest.fn<GetInactiveParticipantsReportUseCase['execute']>().mockResolvedValue({
      windowDays: 30, minimumGroupSize: 10, suppressed: true, inactiveParticipants: null,
    })
    const controller = new ReportingController(
      { execute: personalExecute } as unknown as GetPersonalReportUseCase,
      { execute: teamExecute } as unknown as GetTeamReportUseCase,
      { execute: tenantExecute } as unknown as GetTenantReportUseCase,
      { execute: inactiveExecute } as unknown as GetInactiveParticipantsReportUseCase,
    )

    await expect(controller.mine(context)).resolves.toBe(personal)
    await expect(controller.team(context, teamId)).resolves.toBe(team)
    expect(personalExecute).toHaveBeenCalledWith(context)
    expect(teamExecute).toHaveBeenCalledWith(context, teamId)
    await expect(controller.tenant(context)).resolves.toMatchObject({ tenantId: context.tenantId })
    await expect(controller.inactiveParticipants(context)).resolves.toMatchObject({ inactiveParticipants: null })
    expect(tenantExecute).toHaveBeenCalledWith(context)
    expect(inactiveExecute).toHaveBeenCalledWith(context)
  })

  it('uses the same not-found response for an absent or unauthorized team', async () => {
    const controller = new ReportingController(
      { execute: jest.fn<GetPersonalReportUseCase['execute']>() } as unknown as GetPersonalReportUseCase,
      { execute: jest.fn<GetTeamReportUseCase['execute']>().mockResolvedValue(null) } as unknown as GetTeamReportUseCase,
      { execute: jest.fn<GetTenantReportUseCase['execute']>() } as unknown as GetTenantReportUseCase,
      { execute: jest.fn<GetInactiveParticipantsReportUseCase['execute']>() } as unknown as GetInactiveParticipantsReportUseCase,
    )

    await expect(controller.team(context, teamId)).rejects.toBeInstanceOf(NotFoundException)
  })
})
