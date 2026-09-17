import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdministrationInsightsPanel } from './AdministrationInsightsPanel'

const state = vi.hoisted(() => ({ current: null }))
vi.mock('../hooks/useAdministrationInsights', () => ({ useAdministrationInsights: () => state.current }))

function setup(report, auditItems = []) {
  state.current = {
    status: 'ready', scope: 'tenant', availableTeams: [], report,
    audit: { total: auditItems.length, items: auditItems },
  }
  return render(<AdministrationInsightsPanel administration={{ canManageTeams: true }} />)
}

const safeReport = {
  minimumGroupSize: 10,
  suppressed: false,
  programsSuppressed: false,
  summary: { participants: 20, startedParticipants: 10, activeParticipants: null, completedParticipants: 0, participantsWithActivity: 10 },
  programs: [],
}

describe('Protected project adherence', () => {
  it('shows only aggregate metrics and explains complementary suppression', () => {
    setup(safeReport)
    expect(screen.getByText('20')).not.toBeNull()
    expect(screen.getAllByText('10')).toHaveLength(2)
    expect(screen.getByText('—')).not.toBeNull()
    expect(screen.getByText(/resultados ou complementos com menos de 10 participantes/i)).not.toBeNull()
    expect(screen.queryByText(/acompanhamento por pessoa/i)).toBeNull()
  })

  it('hides every metric for a small group', () => {
    setup({ ...safeReport, suppressed: true, summary: Object.fromEntries(Object.keys(safeReport.summary).map((key) => [key, null])) })
    expect(screen.getByText(/grupo possui menos de 10 participantes/i)).not.toBeNull()
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('keeps the administrative history collapsed', async () => {
    setup(safeReport, [{
      id: 'event', action: 'TEAM_CREATED', entityType: 'Team', occurredAt: '2026-09-01T12:00:00Z',
      actor: { email: 'gestor@example.test', role: 'MANAGER' },
    }])
    const history = screen.getByText('Histórico administrativo · últimas 1 de 1')
    expect(history.closest('details').open).toBe(false)
    await userEvent.click(history)
    expect(screen.getByText('Time criado')).not.toBeNull()
    expect(screen.getByText('Por: gestor@example.test · Gestor (papel atual)')).not.toBeNull()
  })
})
