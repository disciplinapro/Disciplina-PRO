import { ApiProperty } from '@nestjs/swagger'

const ENROLLMENT_STATUSES = ['AVAILABLE', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'] as const

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

export class AggregatedParticipationSummaryDto {
  @ApiProperty({ nullable: true, description: 'Suprimido quando o grupo ou seu complemento tem menos de 10 participantes.' }) participants!: number | null
  @ApiProperty({ nullable: true }) startedParticipants!: number | null
  @ApiProperty({ nullable: true }) activeParticipants!: number | null
  @ApiProperty({ nullable: true }) completedParticipants!: number | null
  @ApiProperty({ nullable: true }) participantsWithActivity!: number | null
}

export class TeamReportResponseDto {
  @ApiProperty({ format: 'uuid' }) teamId!: string
  @ApiProperty() name!: string
  @ApiProperty() minimumGroupSize!: number
  @ApiProperty() suppressed!: boolean
  @ApiProperty({ type: AggregatedParticipationSummaryDto }) summary!: AggregatedParticipationSummaryDto
}

export class TenantProgramReportDto {
  @ApiProperty({ format: 'uuid' }) programId!: string
  @ApiProperty({ format: 'uuid', nullable: true }) programVersionId!: string | null
  @ApiProperty({ nullable: true }) title!: string | null
  @ApiProperty() participants!: number
  @ApiProperty({ nullable: true }) startedParticipants!: number | null
  @ApiProperty({ nullable: true }) activeParticipants!: number | null
  @ApiProperty({ nullable: true }) completedParticipants!: number | null
  @ApiProperty({ nullable: true }) participantsWithActivity!: number | null
}

export class TenantReportResponseDto {
  @ApiProperty({ format: 'uuid' }) tenantId!: string
  @ApiProperty() minimumGroupSize!: number
  @ApiProperty() suppressed!: boolean
  @ApiProperty() programsSuppressed!: boolean
  @ApiProperty({ type: AggregatedParticipationSummaryDto }) summary!: AggregatedParticipationSummaryDto
  @ApiProperty({ type: [TenantProgramReportDto] }) programs!: TenantProgramReportDto[]
}

export class InactiveParticipantsReportResponseDto {
  @ApiProperty() windowDays!: number
  @ApiProperty() minimumGroupSize!: number
  @ApiProperty() suppressed!: boolean
  @ApiProperty({ nullable: true }) inactiveParticipants!: number | null
}
