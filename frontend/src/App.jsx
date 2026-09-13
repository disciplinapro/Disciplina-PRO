import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './app/layouts/AppLayout'
import { SiteContacts } from './app/SiteContacts'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { DisciplineTrackerPage } from './modules/discipline-tracker/pages/DisciplineTrackerPage'
import { DailyRitualPage } from './modules/daily-ritual/pages/DailyRitualPage'
import { GamificationPage } from './modules/gamification/pages/GamificationPage'
import { MissionsPage } from './modules/discipline-content/pages/MissionsPage'
import { ProtocolPage } from './modules/discipline-content/pages/ProtocolPage'
import { LoginPage } from './modules/auth/LoginPage'
import { PasswordRecoveryPage } from './modules/auth/PasswordRecoveryPage'
import { InvitationAcceptancePage } from './modules/invitations/InvitationAcceptancePage'
import { ProfilePage } from './modules/profile/ProfilePage'
import { ProgramsPage } from './modules/programs/ProgramsPage'
import { Projeto66Layout } from './modules/projeto66/Projeto66Layout'
import { Projeto66JourneyPage } from './modules/projeto66/pages/Projeto66JourneyPage'
import { Projeto66OverviewPage } from './modules/projeto66/pages/Projeto66OverviewPage'
import { Projeto66ProgressPage } from './modules/projeto66/pages/Projeto66ProgressPage'
import { Projeto66RecordPage } from './modules/projeto66/pages/Projeto66RecordPage'
import { Projeto66MeditationPage } from './modules/projeto66/pages/Projeto66MeditationPage'
import { Projeto66NewSelfPage } from './modules/projeto66/pages/Projeto66NewSelfPage'
import { Projeto66TodayPage } from './modules/projeto66/pages/Projeto66TodayPage'
import { TenantAdministrationPage } from './modules/administration/pages/TenantAdministrationPage'
import { PlatformAdministrationPage } from './modules/platform/pages/PlatformAdministrationPage'
import { GamificationProvider } from './modules/gamification/GamificationProvider'
import './App.css'
import { useAppContext } from './app/providers/app-context'
import { tenantScopeKey } from './app/providers/tenant-async-scope'

function RequireSession({ children }) {
  const session = useAppContext()
  const location = useLocation()
  if (session.status === 'loading') return <main className="login-page"><p>Restaurando sessão…</p></main>
  if (!session.authenticated || !session.tenant) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}

function RequirePlatformSession({ children }) {
  const session = useAppContext()
  const location = useLocation()
  if (session.status === 'loading') return <main className="login-page"><p>Restaurando sessão…</p></main>
  if (!session.authenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (session.platformAccess?.role !== 'SUPER_ADMIN') return <Navigate to={session.tenant ? '/app' : '/login'} replace />
  return children
}

function App() {
  const session = useAppContext()
  return (
    <GamificationProvider key={tenantScopeKey(session.tenant?.id)}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar-senha" element={<PasswordRecoveryPage key="request" />} />
        <Route path="/redefinir-senha" element={<PasswordRecoveryPage key="reset" reset />} />
        <Route path="/convites/aceitar" element={<InvitationAcceptancePage />} />
        <Route path="/plataforma" element={<RequirePlatformSession><PlatformAdministrationPage /></RequirePlatformSession>} />
        <Route path="/app" element={<RequireSession><AppLayout /></RequireSession>}>
          <Route index element={<DashboardPage />} />
          <Route path="programas" element={<ProgramsPage />} />
          <Route path="programas/projeto-66" element={<Projeto66Layout />}>
            <Route index element={<Projeto66OverviewPage />} />
            <Route path="hoje" element={<Projeto66TodayPage />} />
            <Route path="registrar" element={<Projeto66RecordPage />} />
            <Route path="meditar" element={<Projeto66MeditationPage />} />
            <Route path="novo-eu" element={<Projeto66NewSelfPage />} />
            <Route path="jornada" element={<Projeto66JourneyPage />} />
            <Route path="progresso" element={<Projeto66ProgressPage />} />
          </Route>
          <Route path="minha-evolucao" element={<DisciplineTrackerPage />} />
          <Route path="ritual" element={<DailyRitualPage />} />
          <Route path="conquistas" element={<GamificationPage />} />
          <Route path="missoes" element={<MissionsPage />} />
          <Route path="protocolo" element={<ProtocolPage />} />
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="administracao" element={<TenantAdministrationPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      <SiteContacts />
    </GamificationProvider>
  )
}

export default App
