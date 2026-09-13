import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'

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

export interface TeamMemberReport {
  startedEnrollments?: number
  lastObjectiveActivityAt?: Date | null
  membershipId: string
  email: string
  role: 'USER' | 'MANAGER' | 'CEO'
  enrollments: number
  activeEnrollments: number
  completedEnrollments: number
  activityCompletions: number
  dailyRecords: number
}

export interface TeamReport {
  teamId: string
  name: string
  summary: {
    members: number
    enrollments: number
    activeEnrollments: number
    completedEnrollments: number
    activityCompletions: number
    dailyRecords: number
  }
  members: TeamMemberReport[]
}

export interface TenantProgramReport {
  programId: string
  programVersionId: string | null
  title: string | null
  enrollments: number
  activeEnrollments: number
  completedEnrollments: number
  activityCompletions: number
  dailyRecords: number
}

export interface TenantReport {
  members?: TeamMemberReport[]
  tenantId: string
  summary: {
    activeMembers: number
    enrollments: number
    activeEnrollments: number
    completedEnrollments: number
    activityCompletions: number
    dailyRecords: number
  }
  programs: TenantProgramReport[]
}

export interface InactiveMemberReport {
  membershipId: string
  email: string
  role: 'USER' | 'MANAGER' | 'CEO'
  memberSince: Date
  lastObjectiveActivityAt: Date | null
}

export interface InactiveMembersReport {
  inactiveSince: Date
  total: number
  members: InactiveMemberReport[]
}

export abstract class ReportingRepository {
  abstract findPersonal(context: CurrentTenantContext): Promise<PersonalReport>
  abstract findTeam(context: CurrentTenantContext, teamId: string): Promise<TeamReport | null>
  abstract findTenant(context: CurrentTenantContext): Promise<TenantReport>
  abstract findInactiveMembers(context: CurrentTenantContext, inactiveSince: Date): Promise<InactiveMembersReport>
}
