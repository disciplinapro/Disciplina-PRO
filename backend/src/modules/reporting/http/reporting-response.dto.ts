import { ApiProperty } from '@nestjs/swagger'

const ENROLLMENT_STATUSES = ['AVAILABLE', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'] as const
const TENANT_ROLES = ['USER', 'MANAGER', 'CEO'] as const

export class ObjectiveSummaryDto {
  @ApiProperty() enrollments!: number
  @ApiProperty() activeEnrollments!: number
  @ApiProperty() completedEnrollments!: number
  @ApiProperty() activityCompletions!: number
  @ApiProperty() dailyRecords!: number
}

export class PersonalProgramReportDto {
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string
  @ApiProperty({ format: 'uuid' }) programId!: string
  @ApiProperty({ format: 'uuid', nullable: true }) programVersionId!: string | null
  @ApiProperty({ nullable: true }) title!: string | null
  @ApiProperty({ enum: ENROLLMENT_STATUSES }) status!: (typeof ENROLLMENT_STATUSES)[number]
  @ApiProperty({ nullable: true }) durationDays!: number | null
  @ApiProperty({ type: String, format: 'date', nullable: true }) startedOn!: Date | null
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) completedAt!: Date | null
  @ApiProperty() activityCompletions!: number
  @ApiProperty() dailyRecords!: number
}

export class PersonalReportResponseDto {
  @ApiProperty({ format: 'uuid' }) membershipId!: string
  @ApiProperty({ type: ObjectiveSummaryDto }) summary!: ObjectiveSummaryDto
  @ApiProperty({ type: [PersonalProgramReportDto] }) programs!: PersonalProgramReportDto[]
}

export class TeamMemberReportDto extends ObjectiveSummaryDto {
  @ApiProperty() startedEnrollments!: number
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastObjectiveActivityAt!: Date | null
  @ApiProperty({ format: 'uuid' }) membershipId!: string
  @ApiProperty({ format: 'email' }) email!: string
  @ApiProperty({ enum: TENANT_ROLES }) role!: (typeof TENANT_ROLES)[number]
}

export class TeamSummaryDto extends ObjectiveSummaryDto {
  @ApiProperty() members!: number
}

export class TeamReportResponseDto {
  @ApiProperty({ format: 'uuid' }) teamId!: string
  @ApiProperty() name!: string
  @ApiProperty({ type: TeamSummaryDto }) summary!: TeamSummaryDto
  @ApiProperty({ type: [TeamMemberReportDto] }) members!: TeamMemberReportDto[]
}

export class TenantProgramReportDto extends ObjectiveSummaryDto {
  @ApiProperty({ format: 'uuid' }) programId!: string
  @ApiProperty({ format: 'uuid', nullable: true }) programVersionId!: string | null
  @ApiProperty({ nullable: true }) title!: string | null
}

export class TenantSummaryDto extends ObjectiveSummaryDto {
  @ApiProperty() activeMembers!: number
}

export class TenantReportResponseDto {
  @ApiProperty({ type: [TeamMemberReportDto] }) members!: TeamMemberReportDto[]
  @ApiProperty({ format: 'uuid' }) tenantId!: string
  @ApiProperty({ type: TenantSummaryDto }) summary!: TenantSummaryDto
  @ApiProperty({ type: [TenantProgramReportDto] }) programs!: TenantProgramReportDto[]
}

export class InactiveMemberReportDto {
  @ApiProperty({ format: 'uuid' }) membershipId!: string
  @ApiProperty({ format: 'email' }) email!: string
  @ApiProperty({ enum: TENANT_ROLES }) role!: (typeof TENANT_ROLES)[number]
  @ApiProperty({ type: String, format: 'date-time' }) memberSince!: Date
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastObjectiveActivityAt!: Date | null
}

export class InactiveMembersReportResponseDto {
  @ApiProperty({ type: String, format: 'date-time' }) inactiveSince!: Date
  @ApiProperty() total!: number
  @ApiProperty({ type: [InactiveMemberReportDto] }) members!: InactiveMemberReportDto[]
}
