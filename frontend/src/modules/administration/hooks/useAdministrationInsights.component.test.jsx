import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useAdministrationInsights } from './useAdministrationInsights'

const mocks = vi.hoisted(() => ({
  session: { tenant: { id: 'tenant' }, sessionClient: {} },
  repository: { getTenantReport: vi.fn(), getTenantAudit: vi.fn(), getTeamReport: vi.fn(), getTeamAudit: vi.fn() },
}))
vi.mock('../../../app/providers/app-context', () => ({ useAppContext: () => mocks.session }))
vi.mock('../repositories/tenant-administration.http.repository', () => ({ createTenantAdministrationHttpRepository: () => mocks.repository }))

it('hides the previous scope while the selected team is loading', async () => {
  const report = { summary: { activeMembers: 5 } }
  mocks.repository.getTenantReport.mockResolvedValue(report)
  mocks.repository.getTenantAudit.mockResolvedValue({ items: [], total: 0 })
  let resolveTeam
  mocks.repository.getTeamReport.mockReturnValue(new Promise((resolve) => { resolveTeam = resolve }))
  mocks.repository.getTeamAudit.mockResolvedValue({ items: [], total: 0 })
  const administration = { canManageTeams: true, teams: [{ id: 'team', name: 'Equipe' }], memberships: [] }
  const { result } = renderHook(() => useAdministrationInsights(administration))
  await waitFor(() => expect(result.current.status).toBe('ready'))
  act(() => result.current.setScope('team'))
  expect(result.current.status).toBe('loading')
  await act(async () => resolveTeam({ summary: { members: 2 } }))
  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current.report.summary.members).toBe(2)
})
