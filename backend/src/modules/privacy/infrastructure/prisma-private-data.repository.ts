import { Injectable } from '@nestjs/common'
import { Prisma } from '../../../generated/prisma/client.js'
import { PrismaService } from '../../../database/prisma.service.js'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { PrivateDataRepository, type PrivateDataPurgeResult } from '../application/private-data.repository.js'

type Transaction = Prisma.TransactionClient
const TRACKER_EVENT_TYPE = 'tracker.mark.recorded.v1'
const PRIVATE_RESPONSE_ACTIONS = ['PRIVATE_RESPONSE_CREATED', 'PRIVATE_RESPONSE_REPLACED']

function emptyResult(): PrivateDataPurgeResult {
  return { privateResponses: 0, trackerBehaviors: 0, trackerMarks: 0, trackerJustifications: 0, derivedEvents: 0 }
}

@Injectable()
export class PrismaPrivateDataRepository extends PrivateDataRepository {
  constructor(private readonly prisma: PrismaService) { super() }

  async deleteMine(context: CurrentTenantContext): Promise<PrivateDataPurgeResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.findFirst({
        where: {
          id: context.membershipId,
          tenantId: context.tenantId,
          userId: context.userId,
          status: 'ACTIVE',
          tenant: { status: 'ACTIVE' },
          user: { status: 'ACTIVE' },
        },
        select: { id: true },
      })
      if (!membership) return null
      await this.enablePrivateDataPurge(tx)

      const [responses, behaviors] = await Promise.all([
        tx.privateActivityResponse.findMany({
          where: { tenantId: context.tenantId, enrollment: { membershipId: context.membershipId } },
          select: { id: true },
        }),
        tx.trackerBehavior.findMany({
          where: { tenantId: context.tenantId, membershipId: context.membershipId },
          select: { id: true },
        }),
      ])
      const result = emptyResult()
      result.privateResponses = await this.purgePrivateResponses(tx, responses.map(({ id }) => id))
      const trackerResult = await this.purgeTracker(tx, {
        tenantId: context.tenantId,
        membershipId: context.membershipId,
        behaviorIds: behaviors.map(({ id }) => id),
      })
      return { ...result, ...trackerResult, privateResponses: result.privateResponses }
    })
  }

  async cleanupExpired(input: { cutoff: Date }): Promise<PrivateDataPurgeResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.enablePrivateDataPurge(tx)
      const terminalEnrollments = await tx.enrollment.findMany({
        where: {
          OR: [
            { status: 'COMPLETED', completedAt: { lte: input.cutoff } },
            { status: 'ABANDONED', abandonedAt: { lte: input.cutoff } },
          ],
        },
        select: { id: true },
      })
      const responses = terminalEnrollments.length === 0 ? [] : await tx.privateActivityResponse.findMany({
        where: { enrollmentId: { in: terminalEnrollments.map(({ id }) => id) } },
        select: { id: true },
      })
      const result = emptyResult()
      result.privateResponses = await this.purgePrivateResponses(tx, responses.map(({ id }) => id))

      const expiredMarks = await tx.trackerMark.findMany({
        where: { trackedOn: { lte: input.cutoff } },
        select: { id: true, tenantId: true, membershipId: true, behaviorId: true, trackedOn: true },
      })
      const grouped = new Map<string, typeof expiredMarks>()
      for (const mark of expiredMarks) {
        const key = `${mark.tenantId}:${mark.membershipId}`
        const entries = grouped.get(key) ?? []
        entries.push(mark)
        grouped.set(key, entries)
      }
      for (const marks of grouped.values()) {
        const trackerResult = await this.purgeTracker(tx, {
          tenantId: marks[0].tenantId,
          membershipId: marks[0].membershipId,
          markIds: marks.map(({ id }) => id),
          eventSourceKeys: marks.map(({ membershipId, behaviorId, trackedOn }) =>
            `tracker-mark:${membershipId}:${behaviorId}:${trackedOn.toISOString().slice(0, 10)}`),
        })
        result.trackerMarks += trackerResult.trackerMarks
        result.trackerJustifications += trackerResult.trackerJustifications
        result.derivedEvents += trackerResult.derivedEvents
      }

      const archivedBehaviors = await tx.trackerBehavior.findMany({
        where: { active: false, archivedAt: { lte: input.cutoff }, marks: { none: {} } },
        select: { id: true },
      })
      if (archivedBehaviors.length) {
        result.trackerBehaviors = (await tx.trackerBehavior.deleteMany({
          where: { id: { in: archivedBehaviors.map(({ id }) => id) } },
        })).count
      }
      return result
    })
  }

  private async enablePrivateDataPurge(tx: Transaction) {
    await tx.$queryRaw`SELECT set_config('app.private_data_purge', 'on', true)`
  }

  private async purgePrivateResponses(tx: Transaction, responseIds: string[]) {
    if (!responseIds.length) return 0
    await tx.auditEvent.deleteMany({
      where: { entityType: 'PrivateActivityResponse', entityId: { in: responseIds }, action: { in: PRIVATE_RESPONSE_ACTIONS } },
    })
    return (await tx.privateActivityResponse.deleteMany({ where: { id: { in: responseIds } } })).count
  }

  private async purgeTracker(tx: Transaction, input: {
    tenantId: string
    membershipId: string
    behaviorIds?: string[]
    markIds?: string[]
    eventSourceKeys?: string[]
  }): Promise<Omit<PrivateDataPurgeResult, 'privateResponses'>> {
    const eventWhere: Prisma.InternalEventWhereInput = {
      tenantId: input.tenantId,
      type: TRACKER_EVENT_TYPE,
      ...(input.eventSourceKeys ? { sourceKey: { in: input.eventSourceKeys } } : { aggregateId: { in: input.behaviorIds ?? [] } }),
    }
    const events = await tx.internalEvent.findMany({ where: eventWhere, select: { id: true } })
    const eventIds = events.map(({ id }) => id)
    if (eventIds.length) {
      await tx.userAchievement.deleteMany({ where: { sourceEventId: { in: eventIds } } })
      await tx.xpTransaction.deleteMany({ where: { internalEventId: { in: eventIds } } })
      await tx.internalEventDelivery.deleteMany({ where: { internalEventId: { in: eventIds } } })
      await tx.internalEvent.deleteMany({ where: { id: { in: eventIds } } })
    }

    const markWhere: Prisma.TrackerMarkWhereInput = input.markIds
      ? { id: { in: input.markIds }, tenantId: input.tenantId, membershipId: input.membershipId }
      : { tenantId: input.tenantId, membershipId: input.membershipId, behaviorId: { in: input.behaviorIds ?? [] } }
    const justifications = await tx.trackerJustification.deleteMany({ where: { trackerMark: markWhere } })
    const marks = await tx.trackerMark.deleteMany({ where: markWhere })
    const behaviors = input.behaviorIds?.length
      ? await tx.trackerBehavior.deleteMany({ where: { id: { in: input.behaviorIds }, tenantId: input.tenantId, membershipId: input.membershipId } })
      : { count: 0 }
    return {
      trackerBehaviors: behaviors.count,
      trackerMarks: marks.count,
      trackerJustifications: justifications.count,
      derivedEvents: eventIds.length,
    }
  }
}
