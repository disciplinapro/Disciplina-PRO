import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'

export const MINIMUM_REPORT_GROUP_SIZE = 10

export interface PersonalProgramReport {
  enrollmentId: string
  programId: string
  programVersionId: string | null
  title: string | null
  status: 'AVAILABLE' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  durationDays: number | null
  startedOn: Date | null
  completedAt: Date | null
  activityCompletions: number
  dailyRecords: number
}

export interface PersonalReport {
  membershipId: string
  summary: {
    enrollments: number
    activeEnrollments: number
    completedEnrollments: number
    activityCompletions: number
    dailyRecords: number
  }
  programs: PersonalProgramReport[]
}

export interface AggregatedParticipationSummary {
  participants: number | null
  startedParticipants: number | null
  activeParticipants: number | null
  completedParticipants: number | null
  participantsWithActivity: number | null
}

export interface TeamReport {
  teamId: string
  name: string
  minimumGroupSize: number
  suppressed: boolean
  summary: AggregatedParticipationSummary
}

export interface TenantProgramReport {
  programId: string
  programVersionId: string | null
  title: string | null
  participants: number
  startedParticipants: number | null
  activeParticipants: number | null
  completedParticipants: number | null
  participantsWithActivity: number | null
}

export interface TenantReport {
  tenantId: string
  minimumGroupSize: number
  suppressed: boolean
  programsSuppressed: boolean
  summary: AggregatedParticipationSummary
  programs: TenantProgramReport[]
}

export interface InactiveParticipantsReport {
  windowDays: number
  minimumGroupSize: number
  suppressed: boolean
  inactiveParticipants: number | null
}

export abstract class ReportingRepository {
  abstract findPersonal(context: CurrentTenantContext): Promise<PersonalReport>
  abstract findTeam(context: CurrentTenantContext, teamId: string): Promise<TeamReport | null>
  abstract findTenant(context: CurrentTenantContext): Promise<TenantReport>
  abstract findInactiveParticipants(context: CurrentTenantContext, cutoff: Date): Promise<InactiveParticipantsReport>
}
