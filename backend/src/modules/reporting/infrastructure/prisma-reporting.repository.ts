import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service.js'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import {
  ReportingRepository,
  type InactiveMembersReport,
  type PersonalReport,
  type TenantProgramReport,
  type TenantReport,
  type TeamReport,
} from '../application/reporting.repository.js'

const memberEnrollmentSelect = {
  membershipId: true, status: true, startedOn: true,
  _count: { select: { activityCompletions: true, dailyRecords: true } },
  activityCompletions: { select: { completedAt: true }, orderBy: { completedAt: 'desc' }, take: 1 },
  dailyRecords: { select: { submittedAt: true }, orderBy: { submittedAt: 'desc' }, take: 1 },
} as const

function memberSummary(enrollments: Array<{
  status: string; startedOn: Date | null;
  _count: { activityCompletions: number; dailyRecords: number };
  activityCompletions: Array<{ completedAt: Date }>;
  dailyRecords: Array<{ submittedAt: Date }>;
}>) {
  const dates = enrollments.flatMap((item) => [
    ...item.activityCompletions.map(({ completedAt }) => completedAt),
    ...item.dailyRecords.map(({ submittedAt }) => submittedAt),
  ])
  return {
    enrollments: enrollments.length,
    startedEnrollments: enrollments.filter(({ startedOn }) => startedOn !== null).length,
    activeEnrollments: enrollments.filter(({ status }) => status === 'ACTIVE' || status === 'PAUSED').length,
    completedEnrollments: enrollments.filter(({ status }) => status === 'COMPLETED').length,
    activityCompletions: enrollments.reduce((sum, item) => sum + item._count.activityCompletions, 0),
    dailyRecords: enrollments.reduce((sum, item) => sum + item._count.dailyRecords, 0),
    lastObjectiveActivityAt: dates.reduce<Date | null>((latest, date) => !latest || date > latest ? date : latest, null),
  }
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
          memberships: {
            some: {
              membershipId: context.membershipId,
              role: 'MANAGER',
              endedAt: null,
            },
          },
        }),
      },
      select: {
        id: true,
        name: true,
        memberships: {
          where: {
            endedAt: null,
            membership: { status: 'ACTIVE', user: { status: 'ACTIVE' } },
          },
          select: {
            membership: { select: { id: true, role: true, user: { select: { email: true } } } },
          },
          orderBy: { membershipId: 'asc' },
        },
      },
    })
    if (!team) return null

    const membershipIds = team.memberships.map(({ membership }) => membership.id)
    const enrollments = membershipIds.length === 0 ? [] : await this.prisma.enrollment.findMany({
      where: { tenantId: context.tenantId, membershipId: { in: membershipIds } },
      select: memberEnrollmentSelect,
    })
    const enrollmentsByMembership = new Map<string, typeof enrollments>()
    for (const enrollment of enrollments) {
      const scoped = enrollmentsByMembership.get(enrollment.membershipId) ?? []
      scoped.push(enrollment)
      enrollmentsByMembership.set(enrollment.membershipId, scoped)
    }
    const members = team.memberships.map(({ membership }) => {
      const scoped = enrollmentsByMembership.get(membership.id) ?? []
      return {
        membershipId: membership.id,
        email: membership.user.email,
        role: membership.role,
        ...memberSummary(scoped),
      }
    })
    return {
      teamId: team.id,
      name: team.name,
      summary: {
        members: members.length,
        enrollments: members.reduce((total, member) => total + member.enrollments, 0),
        activeEnrollments: members.reduce((total, member) => total + member.activeEnrollments, 0),
        completedEnrollments: members.reduce((total, member) => total + member.completedEnrollments, 0),
        activityCompletions: members.reduce((total, member) => total + member.activityCompletions, 0),
        dailyRecords: members.reduce((total, member) => total + member.dailyRecords, 0),
      },
      members,
    }
  }

  async findTenant(context: CurrentTenantContext): Promise<TenantReport> {
    await this.assertActiveActor(context, ['CEO'])
    const [memberships, enrollments] = await Promise.all([
      this.prisma.tenantMembership.findMany({
        where: {
          tenantId: context.tenantId,
          status: 'ACTIVE',
          user: { status: 'ACTIVE' },
        },
        select: { id: true, role: true, user: { select: { email: true } } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.enrollment.findMany({
        where: {
          tenantId: context.tenantId,
          membership: { status: 'ACTIVE', user: { status: 'ACTIVE' } },
        },
        select: {
          ...memberEnrollmentSelect,
          programId: true,
          programVersionId: true,
          status: true,
          programVersion: { select: { title: true } },
          _count: { select: { activityCompletions: true, dailyRecords: true } },
        },
      }),
    ])
    const byMember = new Map<string, typeof enrollments>()
    for (const enrollment of enrollments) {
      const entries = byMember.get(enrollment.membershipId) ?? []
      entries.push(enrollment)
      byMember.set(enrollment.membershipId, entries)
    }
    const members = memberships.map((membership) => ({
      membershipId: membership.id, email: membership.user.email, role: membership.role,
      ...memberSummary(byMember.get(membership.id) ?? []),
    }))
    const programsByVersion = new Map<string, TenantProgramReport>()
    for (const enrollment of enrollments) {
      const key = `${enrollment.programId}:${enrollment.programVersionId ?? 'unversioned'}`
      const report = programsByVersion.get(key) ?? {
        programId: enrollment.programId,
        programVersionId: enrollment.programVersionId,
        title: enrollment.programVersion?.title ?? null,
        enrollments: 0,
        activeEnrollments: 0,
        completedEnrollments: 0,
        activityCompletions: 0,
        dailyRecords: 0,
      }
      report.enrollments += 1
      if (enrollment.status === 'ACTIVE' || enrollment.status === 'PAUSED') report.activeEnrollments += 1
      if (enrollment.status === 'COMPLETED') report.completedEnrollments += 1
      report.activityCompletions += enrollment._count.activityCompletions
      report.dailyRecords += enrollment._count.dailyRecords
      programsByVersion.set(key, report)
    }
    const programs = [...programsByVersion.values()].sort((left, right) =>
      (left.title ?? '').localeCompare(right.title ?? '') || left.programId.localeCompare(right.programId))
    return {
      tenantId: context.tenantId,
      summary: {
        activeMembers: members.length,
        enrollments: enrollments.length,
        activeEnrollments: enrollments.filter(({ status }) => status === 'ACTIVE' || status === 'PAUSED').length,
        completedEnrollments: enrollments.filter(({ status }) => status === 'COMPLETED').length,
        activityCompletions: programs.reduce((total, program) => total + program.activityCompletions, 0),
        dailyRecords: programs.reduce((total, program) => total + program.dailyRecords, 0),
      },
      programs,
      members,
    }
  }

  async findInactiveMembers(context: CurrentTenantContext, inactiveSince: Date): Promise<InactiveMembersReport> {
    await this.assertActiveActor(context, ['CEO'])
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId: context.tenantId,
        status: 'ACTIVE',
        createdAt: { lte: inactiveSince },
        user: { status: 'ACTIVE' },
        enrollments: { some: {} },
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { email: true } },
        enrollments: {
          select: {
            activityCompletions: {
              select: { completedAt: true },
              orderBy: { completedAt: 'desc' },
              take: 1,
            },
            dailyRecords: {
              select: { submittedAt: true },
              orderBy: { submittedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const members = memberships.flatMap((membership) => {
      const objectiveDates = membership.enrollments.flatMap((enrollment) => [
        enrollment.activityCompletions[0]?.completedAt,
        enrollment.dailyRecords[0]?.submittedAt,
      ]).filter((date): date is Date => date !== undefined)
      const lastObjectiveActivityAt = objectiveDates.reduce<Date | null>(
        (latest, date) => latest === null || date > latest ? date : latest,
        null,
      )
      if (lastObjectiveActivityAt !== null && lastObjectiveActivityAt >= inactiveSince) return []
      return [{
        membershipId: membership.id,
        email: membership.user.email,
        role: membership.role,
        memberSince: membership.createdAt,
        lastObjectiveActivityAt,
      }]
    })
    return { inactiveSince, total: members.length, members }
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
    if (!actor || (roles && !roles.includes(context.tenantRole as 'CEO' | 'MANAGER'))) {
      throw new Error('Contexto de reporting inválido')
    }
  }
}
