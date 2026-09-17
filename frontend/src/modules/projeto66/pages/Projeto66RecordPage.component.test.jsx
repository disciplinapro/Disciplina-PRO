import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Projeto66RecordPage } from './Projeto66RecordPage'

const mocks = vi.hoisted(() => ({ execution: null }))
vi.mock('../hooks/useProjeto66Cycle', () => ({ useProjeto66Cycle: () => mocks.execution }))

describe('Projeto66RecordPage private response', () => {
  beforeEach(() => {
    mocks.execution = {
      durationDays: 66,
      currentDay: 1,
      cycle: { status: 'ACTIVE', dailyRecords: {}, checklistByDay: {} },
      saveDailyRecord: vi.fn().mockResolvedValue(undefined),
      saveChecklist: vi.fn().mockResolvedValue(undefined),
      loadPrivateResponse: vi.fn().mockResolvedValue(null),
      savePrivateResponse: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('saves the objective day without creating an empty private response', async () => {
    const user = userEvent.setup()
    render(<Projeto66RecordPage />)
    await user.click(screen.getByRole('button', { name: 'Concluir registro do dia' }))

    await waitFor(() => expect(mocks.execution.saveDailyRecord).toHaveBeenCalledOnce())
    expect(mocks.execution.saveChecklist).toHaveBeenCalledOnce()
    expect(mocks.execution.savePrivateResponse).not.toHaveBeenCalled()
  })
})
