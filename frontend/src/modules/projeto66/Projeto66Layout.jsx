import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CrisisSupportDialog } from './components/private/CrisisSupportDialog'
import { Projeto66Provider } from './Projeto66Provider'
import { useProjeto66Context } from './projeto66-context'
import './styles/projeto66.css'
import './styles/checklist.css'
import './styles/private-tools.css'
import './styles/navigation.css'
import './styles/loading.css'

const programLinks = [
  { to: '/app/programas/projeto-66', label: 'Hoje', icon: '⌂', end: true },
  { to: '/app/programas/projeto-66/registrar', label: 'Registro', icon: '+' },
  { to: '/app/programas/projeto-66/novo-eu', label: 'Novo Eu', icon: '★' },
  { to: '/app/programas/projeto-66/progresso', label: 'Progresso', icon: '⌁' },
]

const secondaryLinks = [
  { to: '/app/programas/projeto-66/hoje', label: 'Checklist' },
  { to: '/app/programas/projeto-66/meditar', label: 'Meditar' },
  { to: '/app/programas/projeto-66/jornada', label: 'Jornada' },
]

function Projeto66Shell() {
  const [crisisOpen, setCrisisOpen] = useState(false)
  const execution = useProjeto66Context()
  if (execution.status === 'loading') return (
    <section className="p66-app">
      <header className="p66-header">
        <div><NavLink className="p66-back" to="/app/programas">‹ Disciplina PRO</NavLink><span>O Incendiário × Spark</span><strong>Protocolo <em>77</em></strong></div>
      </header>
      <div className="p66-content">
        <section className="p66-loading-card" aria-labelledby="p66-loading-title">
          <span className="p66-loading-spinner" aria-hidden="true" />
          <h1 id="p66-loading-title">Preparando sua jornada</h1>
          <p role="status" aria-live="polite" aria-atomic="true">Carregando seu ciclo…</p>
          <p className="p66-loading-detail">Seu progresso e suas atividades aparecerão aqui.</p>
        </section>
        <div className="p66-loading-preview" aria-hidden="true">
          <div className="p66-loading-placeholder p66-loading-placeholder-hero"><span /><span /><span /></div>
          <div className="p66-loading-placeholder"><span /><span /></div>
          <div className="p66-loading-placeholder"><span /><span /></div>
        </div>
      </div>
    </section>
  )
  if (execution.status === 'error') return <section className="p66-app"><div className="p66-content"><section className="p66-callout"><b>!</b><p>{execution.error.message}</p></section><button className="p66-primary" type="button" onClick={() => execution.reload()}>Tentar novamente</button></div></section>
  return (
    <section className="p66-app">
      <header className="p66-header">
        <div><NavLink className="p66-back" to="/app/programas">‹ Disciplina PRO</NavLink><span>O Incendiário × Spark</span><strong>Protocolo <em>77</em></strong></div>
        <span className="p66-day-badge">{execution.cycle.status === 'ACTIVE' ? `Dia ${execution.cycle.currentDay}` : execution.cycle.status}</span>
      </header>
      <div className="p66-content">
        <nav className="p66-secondary-nav" aria-label="Ações do ciclo">
          {secondaryLinks.map((link) => <NavLink key={link.to} to={link.to}>{link.label}</NavLink>)}
        </nav>
        <Outlet />
      </div>
      <button className="p66-crisis-fab" type="button" aria-label="Abrir modo crise" onClick={() => setCrisisOpen(true)}>🆘</button>
      <CrisisSupportDialog open={crisisOpen} onClose={() => setCrisisOpen(false)} />
      <nav className="p66-tabbar" aria-label="Navegação do Projeto 77">
        {programLinks.map((link) => <NavLink key={link.to} to={link.to} end={link.end}><b>{link.icon}</b><span>{link.label}</span></NavLink>)}
      </nav>
    </section>
  )
}

export function Projeto66Layout() {
  return <Projeto66Provider><Projeto66Shell /></Projeto66Provider>
}
