import { jest } from '@jest/globals'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { InvalidExecutionDataError, PrivateResponseNotFoundError } from '../domain/execution.errors.js'
import type {
  ActivityCompletionView,
  DailyRecordView,
  ObjectiveExecutionFactsRepository,
  PrivateExecutionResponseRepository,
  PrivateResponseView,
} from './execution-facts.repository.js'
import { CompleteActivityUseCase, GetPrivateResponseUseCase, PutPrivateResponseUseCase, RecordDailyUseCase } from './execution-facts.use-cases.js'

describe('execution facts use cases', () => {
  const context: CurrentTenantContext = {
    tenantId: 'tenant',
    membershipId: 'membership',
    userId: 'user',
    tenantRole: 'USER',
  }

  it('delegates objective facts with server time', async () => {
    const completedAt = new Date()
    const activityCompletion: ActivityCompletionView = {
      id: 'completion',
      activityId: 'activity',
      programDay: 1,
      programDate: completedAt,
      occurrenceKey: 'once',
      completedAt,
    }
    const dailyRecord: DailyRecordView = {
      id: 'record',
      programDay: 1,
      programDate: completedAt,
      submittedAt: completedAt,
      pillarScores: [{ pillarKey: 'disciplina', score: 8 }],
    }
    const completeActivity = jest.fn<ObjectiveExecutionFactsRepository['completeActivity']>().mockResolvedValue(activityCompletion)
    const recordDaily = jest.fn<ObjectiveExecutionFactsRepository['recordDaily']>().mockResolvedValue(dailyRecord)
    const facts = { completeActivity, recordDaily } as unknown as ObjectiveExecutionFactsRepository
    await new CompleteActivityUseCase(facts).execute(context, 'enrollment', 'activity')
    await new RecordDailyUseCase(facts).execute(context, 'enrollment', [{ pillarKey: 'disciplina', score: 8 }])
    const completeInput = completeActivity.mock.calls[0]?.[1]
    const dailyInput = recordDaily.mock.calls[0]?.[1]
    expect(completeInput).toMatchObject({ enrollmentId: 'enrollment', activityId: 'activity' })
    expect(completeInput?.now).toBeInstanceOf(Date)
    expect(dailyInput).toMatchObject({ enrollmentId: 'enrollment' })
    expect(dailyInput?.now).toBeInstanceOf(Date)
  })

  it('validates objective and private payload shapes before persistence', () => {
    const facts = {} as ObjectiveExecutionFactsRepository
    const responses = { put: jest.fn() } as unknown as PrivateExecutionResponseRepository
    expect(() => new RecordDailyUseCase(facts).execute(context, 'enrollment', [])).toThrow(InvalidExecutionDataError)
    expect(() => new PutPrivateResponseUseCase(responses).execute(context, 'enrollment', 'activity', [] as never)).toThrow(InvalidExecutionDataError)
    expect(() => new PutPrivateResponseUseCase(responses).execute(context, 'enrollment', 'activity', {
      emotion: null,
      gratitude: ['', '  '],
      recordedAt: new Date().toISOString(),
    })).toThrow(InvalidExecutionDataError)
    expect(() => new PutPrivateResponseUseCase(responses).execute(context, 'enrollment', 'activity', { completed: false })).not.toThrow()
  })

  it('delegates private writes and maps missing private reads', async () => {
    const submittedAt = new Date()
    const response: PrivateResponseView = {
      id: 'response',
      activityId: 'activity',
      programDay: 1,
      programDate: submittedAt,
      payload: { note: 'private' },
      submittedAt,
      updatedAt: submittedAt,
    }
    const put = jest.fn<PrivateExecutionResponseRepository['put']>().mockResolvedValue(response)
    const get = jest.fn<PrivateExecutionResponseRepository['get']>().mockResolvedValueOnce(response).mockResolvedValueOnce(null)
    const responses = { put, get } as unknown as PrivateExecutionResponseRepository
    await new PutPrivateResponseUseCase(responses).execute(context, 'enrollment', 'activity', { note: 'private' })
    await expect(new GetPrivateResponseUseCase(responses).execute(context, 'enrollment', 'activity')).resolves.toEqual(response)
    await expect(new GetPrivateResponseUseCase(responses).execute(context, 'enrollment', 'activity')).rejects.toBeInstanceOf(PrivateResponseNotFoundError)
    expect(put).toHaveBeenCalledWith(context, expect.objectContaining({ payload: { note: 'private' } }))
  })
})
