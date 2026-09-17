import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service.js'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import {
  MINIMUM_REPORT_GROUP_SIZE,
  ReportingRepository,
  type AggregatedParticipationSummary,
  type PersonalReport,
  type TenantProgramReport,
  type TenantReport,
  type TeamReport,
} from '../application/reporting.repository.js'

const participantEnrollmentSelect = {
  membershipId: true,
  programId: true,
  programVersionId: true,
  status: true,
  startedOn: true,
  programVersion: { select: { title: true } },
  _count: { select: { activityCompletions: true, dailyRecords: true } },
} as const

type ParticipantEnrollment = {
  membershipId: string
  programId: string
  programVersionId: string | null
  status: string
  startedOn: Date | null
  programVersion: { title: string } | null
  _count: { activityCompletions: number; dailyRecords: number }
}

type Participant = { id: string }

function safelyAggregatedCount(count: number, total: number) {
  if (count === 0 || count === total) return count
  return count >= MINIMUM_REPORT_GROUP_SIZE && total - count >= MINIMUM_REPORT_GROUP_SIZE ? count : null
}

function groupByParticipant<T extends { membershipId: string }>(enrollments: T[]) {
  const grouped = new Map<string, T[]>()
  for (const enrollment of enrollments) {
    const current = grouped.get(enrollment.membershipId) ?? []
    current.push(enrollment)
    grouped.set(enrollment.membershipId, current)
  }
  return grouped
}

function participantSignals(enrollments: ParticipantEnrollment[]) {
  return {
    started: enrollments.some(({ startedOn }) => startedOn !== null),
    active: enrollments.some(({ status }) => status === 'ACTIVE' || status === 'PAUSED'),
    completed: enrollments.some(({ status }) => status === 'COMPLETED'),
    activity: enrollments.some(({ _count }) => _count.activityCompletions > 0 || _count.dailyRecords > 0),
  }
}

function aggregatedSummary(participants: Participant[], enrollments: ParticipantEnrollment[]): AggregatedParticipationSummary {
  const total = participants.length
  if (total < MINIMUM_REPORT_GROUP_SIZE) {
    return { participants: null, startedParticipants: null, activeParticipants: null, completedParticipants: null, participantsWithActivity: null }
  }
  const byParticipant = groupByParticipant(enrollments)
  const signals = participants.map(({ id }) => participantSignals(byParticipant.get(id) ?? []))
  return {
    participants: total,
    startedParticipants: safelyAggregatedCount(signals.filter(({ started }) => started).length, total),
    activeParticipants: safelyAggregatedCount(signals.filter(({ active }) => active).length, total),
    completedParticipants: safelyAggregatedCount(signals.filter(({ completed }) => completed).length, total),
    participantsWithActivity: safelyAggregatedCount(signals.filter(({ activity }) => activity).length, total),
  }
}

function programReports(enrollments: ParticipantEnrollment[]): { reports: TenantProgramReport[]; suppressed: boolean } {
  const byProgram = new Map<string, ParticipantEnrollment[]>()
  for (const enrollment of enrollments) {
    const key = `${enrollment.programId}:${enrollment.programVersionId ?? 'unversioned'}`
    const current = byProgram.get(key) ?? []
    current.push(enrollment)
    byProgram.set(key, current)
  }

  const groups = [...byProgram.values()]
  if (groups.some((group) => new Set(group.map(({ membershipId }) => membershipId)).size < MINIMUM_REPORT_GROUP_SIZE)) {
    return { reports: [], suppressed: true }
  }

  const reports = groups.map((group) => {
    const byParticipant = groupByParticipant(group)
    const participantIds = [...byParticipant.keys()]
    const total = participantIds.length
    const signals = participantIds.map((id) => participantSignals(byParticipant.get(id) ?? []))
    const first = group[0]
    return {
      programId: first.programId,
      programVersionId: first.programVersionId,
      title: first.programVersion?.title ?? null,
      participants: total,
      startedParticipants: safelyAggregatedCount(signals.filter(({ started }) => started).length, total),
      activeParticipants: safelyAggregatedCount(signals.filter(({ active }) => active).length, total),
      completedParticipants: safelyAggregatedCount(signals.filter(({ completed }) => completed).length, total),
      participantsWithActivity: safelyAggregatedCount(signals.filter(({ activity }) => activity).length, total),
    }
  }).sort((left, right) => (left.title ?? '').localeCompare(right.title ?? '') || left.programId.localeCompare(right.programId))
  return { reports, suppressed: false }
}

function suppressedSummary(): AggregatedParticipationSummary {
  return { participants: null, startedParticipants: null, activeParticipants: null, completedParticipants: null, participantsWithActivity: null }
}

@Injectable()
export class PrismaReportingRepository extends ReportingRepository {
  constructor(private readonly prisma: PrismaService) { super() }

  async findPersonal(context: CurrentTenantContext): Promise<PersonalReport> {
    await this.assertActiveActor(context)
    const enrollments = await this.prisma.enrollment.findMany({
      where: { tenantId: context.tenantId, membershipId: context.membershipId },
      select: {
        id: true,
        programId: true,
        programVersionId: true,
        status: true,
        startedOn: true,
        completedAt: true,
        programVersion: { select: { title: true, durationDays: true } },
        _count: { select: { activityCompletions: true, dailyRecords: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const programs = enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      programId: enrollment.programId,
      programVersionId: enrollment.programVersionId,
      title: enrollment.programVersion?.title ?? null,
      status: enrollment.status,
      durationDays: enrollment.programVersion?.durationDays ?? null,
      startedOn: enrollment.startedOn,
      completedAt: enrollment.completedAt,
      activityCompletions: enrollment._count.activityCompletions,
      dailyRecords: enrollment._count.dailyRecords,
    }))
    return {
      membershipId: context.membershipId,
      summary: {
        enrollments: programs.length,
        activeEnrollments: programs.filter(({ status }) => status === 'ACTIVE' || status === 'PAUSED').length,
        completedEnrollments: programs.filter(({ status }) => status === 'COMPLETED').length,
        activityCompletions: programs.reduce((total, program) => total + program.activityCompletions, 0),
        dailyRecords: programs.reduce((total, program) => total + program.dailyRecords, 0),
      },
      programs,
    }
  }

  async findTeam(context: CurrentTenantContext, teamId: string): Promise<TeamReport | null> {
    await this.assertActiveActor(context, ['CEO', 'MANAGER'])
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        tenantId: context.tenantId,
        ...(context.tenantRole === 'CEO' ? {} : {
          archivedAt: null,
          memberships: { some: { membershipId: context.membershipId, role: 'MANAGER', endedAt: null } },
        }),
      },
      select: {
        id: true,
        name: true,
        memberships: {
          where: {
            endedAt: null,
            membership: { status: 'ACTIVE', role: 'USER', user: { status: 'ACTIVE' } },
          },
          select: { membership: { select: { id: true } } },
          orderBy: { membershipId: 'asc' },
        },
      },
    })
    if (!team) return null

    const participants = team.memberships.map(({ membership }) => membership)
    const participantIds = participants.map(({ id }) => id)
    const enrollments = participantIds.length === 0 ? [] : await this.prisma.enrollment.findMany({
      where: { tenantId: context.tenantId, membershipId: { in: participantIds } },
      select: participantEnrollmentSelect,
    })
    const suppressed = participants.length < MINIMUM_REPORT_GROUP_SIZE
    return {
      teamId: team.id,
      name: team.name,
      minimumGroupSize: MINIMUM_REPORT_GROUP_SIZE,
      suppressed,
      summary: suppressed ? suppressedSummary() : aggregatedSummary(participants, enrollments),
    }
  }

  async findTenant(context: CurrentTenantContext): Promise<TenantReport> {
    await this.assertActiveActor(context, ['CEO'])
    const participants = await this.prisma.tenantMembership.findMany({
      where: { tenantId: context.tenantId, role: 'USER', status: 'ACTIVE', user: { status: 'ACTIVE' } },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    const participantIds = participants.map(({ id }) => id)
    const enrollments: ParticipantEnrollment[] = participantIds.length === 0 ? [] : await this.prisma.enrollment.findMany({
      where: { tenantId: context.tenantId, membershipId: { in: participantIds } },
      select: participantEnrollmentSelect,
    })
    const suppressed = participants.length < MINIMUM_REPORT_GROUP_SIZE
    const programResult = suppressed ? { reports: [], suppressed: true } : programReports(enrollments)
    return {
      tenantId: context.tenantId,
      minimumGroupSize: MINIMUM_REPORT_GROUP_SIZE,
      suppressed,
      programsSuppressed: programResult.suppressed,
      summary: suppressed ? suppressedSummary() : aggregatedSummary(participants, enrollments),
      programs: programResult.reports,
    }
  }

  async findInactiveParticipants(context: CurrentTenantContext, cutoff: Date) {
    await this.assertActiveActor(context, ['CEO'])
    const participants = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId: context.tenantId,
        role: 'USER',
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
        enrollments: { some: {} },
      },
      select: {
        id: true,
        enrollments: {
          select: {
            activityCompletions: { select: { completedAt: true }, orderBy: { completedAt: 'desc' }, take: 1 },
            dailyRecords: { select: { submittedAt: true }, orderBy: { submittedAt: 'desc' }, take: 1 },
          },
        },
      },
    })
    if (participants.length < MINIMUM_REPORT_GROUP_SIZE) {
      return { windowDays: 30, minimumGroupSize: MINIMUM_REPORT_GROUP_SIZE, suppressed: true, inactiveParticipants: null }
    }
    const inactive = participants.filter((participant) => {
      const dates = participant.enrollments.flatMap((enrollment) => [
        enrollment.activityCompletions[0]?.completedAt,
        enrollment.dailyRecords[0]?.submittedAt,
      ]).filter((date): date is Date => date !== undefined)
      return dates.every((date) => date < cutoff)
    }).length
    const inactiveParticipants = safelyAggregatedCount(inactive, participants.length)
    return {
      windowDays: 30,
      minimumGroupSize: MINIMUM_REPORT_GROUP_SIZE,
      suppressed: inactiveParticipants === null,
      inactiveParticipants,
    }
  }

  private async assertActiveActor(context: CurrentTenantContext, roles?: Array<'CEO' | 'MANAGER'>) {
    const actor = await this.prisma.tenantMembership.findFirst({
      where: {
        id: context.membershipId,
        tenantId: context.tenantId,
        userId: context.userId,
        status: 'ACTIVE',
        ...(roles ? { role: { in: roles } } : {}),
        tenant: { status: 'ACTIVE' },
        user: { status: 'ACTIVE' },
      },
      select: { id: true },
    })
    if (!actor) throw new Error('Contexto de reporting inválido')
  }
}
