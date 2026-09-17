import { Injectable } from '@nestjs/common'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { InvalidExecutionDataError, PrivateResponseNotFoundError } from '../domain/execution.errors.js'
import { ObjectiveExecutionFactsRepository, PrivateExecutionResponseRepository } from './execution-facts.repository.js'

@Injectable()
export class CompleteActivityUseCase {
  constructor(private readonly facts: ObjectiveExecutionFactsRepository) {}
  execute(context: CurrentTenantContext, enrollmentId: string, activityId: string, now = new Date()) {
    return this.facts.completeActivity(context, { enrollmentId, activityId, now })
  }
}

@Injectable()
export class RecordDailyUseCase {
  constructor(private readonly facts: ObjectiveExecutionFactsRepository) {}
  execute(context: CurrentTenantContext, enrollmentId: string, scores: Array<{ pillarKey: string; score: number }>, now = new Date()) {
    if (!Array.isArray(scores) || scores.length < 1 || scores.length > 20) throw new InvalidExecutionDataError()
    return this.facts.recordDaily(context, { enrollmentId, scores, now })
  }
}

@Injectable()
export class PutPrivateResponseUseCase {
  constructor(private readonly responses: PrivateExecutionResponseRepository) {}
  execute(context: CurrentTenantContext, enrollmentId: string, activityId: string, payload: Record<string, unknown>, now = new Date()) {
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new InvalidExecutionDataError()
    if (!hasMeaningfulPrivateContent(payload)) throw new InvalidExecutionDataError()
    return this.responses.put(context, { enrollmentId, activityId, payload, now })
  }
}

const PRIVATE_RESPONSE_METADATA_KEYS = new Set(['recordedAt', 'occurredAt', 'updatedAt', 'createdAt'])

function hasMeaningfulPrivateContent(value: unknown, key?: string): boolean {
  if (key && PRIVATE_RESPONSE_METADATA_KEYS.has(key)) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulPrivateContent(item))
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([entryKey, entryValue]) => hasMeaningfulPrivateContent(entryValue, entryKey))
  }
  return false
}

@Injectable()
export class GetPrivateResponseUseCase {
  constructor(private readonly responses: PrivateExecutionResponseRepository) {}
  async execute(context: CurrentTenantContext, enrollmentId: string, activityId: string, now = new Date()) {
    const response = await this.responses.get(context, { enrollmentId, activityId, now })
    if (!response) throw new PrivateResponseNotFoundError()
    return response
  }
}
