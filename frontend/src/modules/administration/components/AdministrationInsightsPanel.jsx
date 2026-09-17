import { useAdministrationInsights } from '../hooks/useAdministrationInsights'

const actionLabels = {
  TEAM_CREATED: 'Time criado', TEAM_UPDATED: 'Time renomeado', TEAM_ARCHIVED: 'Time arquivado', TEAM_RESTORED: 'Time restaurado',
  TEAM_MEMBERSHIP_ASSIGNED: 'Pessoa vinculada ao time', TEAM_MEMBERSHIP_ENDED: 'Vínculo de time encerrado',
  MEMBERSHIP_ROLE_CHANGED: 'Papel organizacional alterado', MEMBERSHIP_SUSPENDED: 'Acesso suspenso', MEMBERSHIP_INACTIVATED: 'Acesso inativado', MEMBERSHIP_REACTIVATED: 'Acesso reativado',
  INVITATION_ACCEPTED: 'Convite aceito', INVITATION_CREATED: 'Convite criado', INVITATION_RESENT: 'Convite reenviado', INVITATION_REVOKED: 'Convite revogado',
  TENANT_PROGRAM_ENABLED: 'Programa liberado para a organização', TENANT_PROGRAM_DISABLED: 'Programa removido da organização',
}

const entityTypeLabels = {
  TenantProgram: 'Disponibilidade do programa', Invitation: 'Convite', Team: 'Time',
  TeamMembership: 'Vínculo com o time', TenantMembership: 'Acesso à organização',
}

const roleLabels = { CEO: 'CEO', MANAGER: 'Gestor', USER: 'Participante' }
const formatDate = (value) => new Date(value).toLocaleString('pt-BR')
const metricValue = (value) => value === null || value === undefined ? '—' : value

function auditActor(event) {
  if (event.actor) return `${event.actor.email} · ${roleLabels[event.actor.role] ?? 'Membro'} (papel atual)`
  if (event.actorType === 'SYSTEM') return 'Sistema'
  if (event.actorType === 'PLATFORM_ACCESS') return 'Administração da plataforma'
  return 'Autor não disponível'
}

function AuditEntry({ event }) {
  return <article>
    <div>
      <strong>{actionLabels[event.action] ?? 'Ação administrativa registrada'}</strong>
      <span>Por: {auditActor(event)}</span>
      {event.target && <span>Pessoa relacionada: {event.target.email} · {roleLabels[event.target.role] ?? 'Membro'}</span>}
      <span>{entityTypeLabels[event.entityType] ?? 'Registro administrativo'}</span>
    </div>
    <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
  </article>
}

function PrivacyNotice({ minimumGroupSize, suppressed }) {
  return <p className="admin-insights-note">
    {suppressed
      ? `Indicadores ocultos porque o grupo possui menos de ${minimumGroupSize} participantes.`
      : `Somente indicadores agregados são exibidos. Resultados ou complementos com menos de ${minimumGroupSize} participantes são ocultados.`}
  </p>
}

function AggregatedMetrics({ summary }) {
  return <div className="admin-metrics">
    <article><span>Participantes no grupo</span><strong>{metricValue(summary.participants)}</strong></article>
    <article><span>Participantes que iniciaram</span><strong>{metricValue(summary.startedParticipants)}</strong></article>
    <article><span>Participantes em ciclo ativo</span><strong>{metricValue(summary.activeParticipants)}</strong></article>
    <article><span>Participantes com atividade</span><strong>{metricValue(summary.participantsWithActivity)}</strong></article>
  </div>
}

function ProgramResults({ report }) {
  if (report.programsSuppressed) return <p className="admin-empty">O detalhamento por programa foi ocultado para evitar reidentificação.</p>
  if (!report.programs?.length) return null
  return <div className="admin-report-members">
    <h3>Resultados por programa</h3>
    {report.programs.map((program) => <article key={`${program.programId}-${program.programVersionId}`}>
      <div>
        <strong>{program.title ?? 'Programa'}</strong>
        <span>{program.participants} participantes no grupo protegido</span>
      </div>
      <small>{metricValue(program.startedParticipants)} iniciaram · {metricValue(program.activeParticipants)} em ciclo ativo · {metricValue(program.participantsWithActivity)} com atividade</small>
    </article>)}
  </div>
}

export function AdministrationInsightsPanel({ administration }) {
  const insights = useAdministrationInsights(administration)
  const report = insights.report

  return <section className="admin-panel admin-insights">
    <header><div><span>Participação agregada</span><h2>Adesão ao projeto</h2></div>
      <label>Escopo dos indicadores
        <select aria-label="Escopo dos indicadores" value={insights.scope} onChange={(event) => insights.setScope(event.target.value)}>
          {administration.canManageTeams && <option value="tenant">Toda a organização</option>}
          {insights.availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>
    </header>
    {insights.status === 'loading' && <div className="admin-state" aria-live="polite" aria-atomic="true">Carregando indicadores agregados…</div>}
    {insights.status === 'empty' && <p className="admin-empty">Nenhum time gerenciado disponível para esta leitura.</p>}
    {insights.status === 'error' && <div className="admin-state error" role="alert"><strong>Não foi possível carregar os indicadores.</strong><span>{insights.error?.message}</span><button className="button" type="button" onClick={() => insights.reload().catch(() => {})}>Tentar novamente</button></div>}
    {insights.status === 'ready' && <>
      <PrivacyNotice minimumGroupSize={report.minimumGroupSize} suppressed={report.suppressed} />
      <h3>Resultados agregados</h3>
      <AggregatedMetrics summary={report.summary} />
      <ProgramResults report={report} />
      <details className="admin-audit"><summary>Histórico administrativo · últimas {insights.audit.items.length} de {insights.audit.total}</summary>
        {insights.audit.items.length ? insights.audit.items.map((event) => <AuditEntry key={event.id} event={event} />) : <p className="admin-empty">Nenhuma ação administrativa registrada.</p>}
      </details>
    </>}
  </section>
}
