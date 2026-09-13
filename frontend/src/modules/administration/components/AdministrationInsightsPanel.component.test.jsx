import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdministrationInsightsPanel } from './AdministrationInsightsPanel'

const state = vi.hoisted(() => ({ current: null }))
vi.mock('../hooks/useAdministrationInsights', () => ({ useAdministrationInsights: () => state.current }))
const member = { membershipId: 'one', email: 'gestor@example.test', role: 'MANAGER', startedEnrollments: 2, activeEnrollments: 2, completedEnrollments: 0, activityCompletions: 4, dailyRecords: 0, lastObjectiveActivityAt: new Date().toISOString() }
function setup(members) {
  state.current = {
    status: 'ready', scope: 'tenant', availableTeams: [],
    report: { summary: { activeEnrollments: 2, completedEnrollments: 0, activityCompletions: 4, dailyRecords: 0 }, members },
    audit: { total: 1, items: [{ id: 'event', action: 'ACTIVITY_COMPLETED', entityType: 'Enrollment', occurredAt: '2026-09-01T12:00:00Z', actor: { email: member.email, role: 'MANAGER' }, activityTitle: 'Caminhada', programTitle: 'Protocolo 77' }] },
  }
  return render(<AdministrationInsightsPanel administration={{ canManageTeams: true }} />)
}

describe('Project adherence', () => {
  it('counts people once across multiple cycles and identifies non-starters', () => {
    setup([member, { ...member, membershipId: 'two', email: 'participante@example.test', role: 'USER', startedEnrollments: 0, activeEnrollments: 0, activityCompletions: 0, lastObjectiveActivityAt: null }])
    expect(screen.getByText('50%')).not.toBeNull()
    expect(screen.getByText('1 de 2 pessoas iniciaram')).not.toBeNull()
    expect(screen.getByText('Participante · Ainda não iniciou')).not.toBeNull()
    expect(screen.getByText('Ativos nos últimos 7 dias').closest('article').textContent).toContain('1')
  })
  it('handles an empty scope without a misleading percentage', () => {
    setup([])
    expect(screen.getByText('—')).not.toBeNull()
    expect(screen.getByText('Nenhuma pessoa com acesso ativo neste escopo.')).not.toBeNull()
  })
  it('explains the action, actor role and program in a collapsed history', async () => {
    setup([member])
    const history = screen.getByText('Histórico de ações · últimas 1 de 1')
    expect(history.closest('details').open).toBe(false)
    await userEvent.click(history)
    expect(history.closest('details').open).toBe(true)
    expect(screen.getByText('Atividade concluída: Caminhada')).not.toBeNull()
    expect(screen.getByText('Por: gestor@example.test · Gestor (papel atual)')).not.toBeNull()
    expect(screen.queryByText('ACTIVITY_COMPLETED')).toBeNull()
  })
})
