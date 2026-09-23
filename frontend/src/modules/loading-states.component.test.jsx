import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { ProgramsPage } from './programs/ProgramsPage'
import { MissionsPage } from './discipline-content/pages/MissionsPage'
import { GamificationPage } from './gamification/pages/GamificationPage'
import { DailyRitualPage } from './daily-ritual/pages/DailyRitualPage'
import { AdministrationInsightsPanel } from './administration/components/AdministrationInsightsPanel'
import { TenantAdministrationPage } from './administration/pages/TenantAdministrationPage'
import { Projeto66Layout } from './projeto66/Projeto66Layout'

const state = vi.hoisted(() => ({ current: null }))
vi.mock('./programs/hooks/useProgramCatalog', () => ({ useProgramCatalog: () => state.current }))
vi.mock('./discipline-content/hooks/useMissions', () => ({ useMissions: () => state.current }))
vi.mock('./gamification/gamification-context', () => ({ useGamification: () => state.current }))
vi.mock('./daily-ritual/hooks/useDailyRitual', () => ({ useDailyRitual: () => state.current }))
vi.mock('./administration/hooks/useAdministrationInsights', () => ({ useAdministrationInsights: () => state.current }))
vi.mock('./administration/hooks/useTenantAdministration', () => ({ useTenantAdministration: () => state.current }))
vi.mock('./projeto66/projeto66-context', () => ({ useProjeto66Context: () => state.current }))
vi.mock('./projeto66/Projeto66Provider', () => ({ Projeto66Provider: ({ children }) => children }))

describe('Accessible loading boundaries', () => {
  beforeEach(() => {
    state.current = {
      status: 'loading', error: { message: 'Conexão indisponível' }, reload: vi.fn(),
      programs: [], metrics: {}, achievements: [], achievementDefinitions: [], transactions: [],
      level: { level: 1, name: 'Início', medal: '1' }, xp: 0, progress: { percent: 0, completed: 0, total: 0 },
      timer: { running: false, remainingSeconds: 1800, completedCycles: 0 }, checks: {},
      scope: 'tenant', availableTeams: [], canManage: true, canManageTeams: true,
    }
  })

  it('keeps protocol identity and lets the user leave while the cycle is pending', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/app/programas/projeto-66']}>
      <Routes>
        <Route path="/app/programas/projeto-66" element={<Projeto66Layout />} />
        <Route path="/app/programas" element={<h1>Seus programas</h1>} />
      </Routes>
    </MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Preparando sua jornada' })).not.toBeNull()
    expect(screen.getByText('77')).not.toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Carregando seu ciclo…')
    await user.click(screen.getByRole('link', { name: '‹ Disciplina PRO' }))
    expect(screen.getByRole('heading', { name: 'Seus programas' })).not.toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it.each([
    ['programs', ProgramsPage, 'Carregando programas habilitados…'],
    ['missions', MissionsPage, 'Carregando missões…'],
    ['gamification', GamificationPage, 'Atualizando progresso do servidor…'],
    ['ritual', DailyRitualPage, 'Carregando ritual…'],
    ['insights', AdministrationInsightsPanel, 'Carregando indicadores agregados…'],
    ['administration', TenantAdministrationPage, 'Carregando estrutura da organização…'],
    ['Projeto 66', Projeto66Layout, 'Carregando seu ciclo…'],
  ])('%s announces loading and replaces it with an actionable error', (_name, Page, message) => {
    const view = () => <MemoryRouter><Page administration={{ canManageTeams: true }} /></MemoryRouter>
    const { rerender } = render(view())
    const announcement = screen.getByText(message)
    expect(announcement.getAttribute('aria-live')).toBe('polite')
    expect(announcement.getAttribute('aria-atomic')).toBe('true')
    state.current = { ...state.current, status: 'error' }
    rerender(view())
    expect(screen.queryByText(message)).toBeNull()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).not.toBeNull()
  })
})
