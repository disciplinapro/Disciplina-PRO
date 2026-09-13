import { useState } from 'react'
import { useAdministrationInsights } from '../hooks/useAdministrationInsights'

const actionLabels = {
  TEAM_CREATED: 'Time criado', TEAM_UPDATED: 'Time renomeado', TEAM_ARCHIVED: 'Time arquivado', TEAM_RESTORED: 'Time restaurado',
  TEAM_MEMBERSHIP_ASSIGNED: 'Pessoa vinculada ao time', TEAM_MEMBERSHIP_ENDED: 'Vínculo de time encerrado',
  MEMBERSHIP_ROLE_CHANGED: 'Papel organizacional alterado', MEMBERSHIP_SUSPENDED: 'Acesso suspenso', MEMBERSHIP_INACTIVATED: 'Acesso inativado', MEMBERSHIP_REACTIVATED: 'Acesso reativado',
  INVITATION_ACCEPTED: 'Convite aceito', ACTIVITY_COMPLETED: 'Atividade concluída',
  PRIVATE_RESPONSE_CREATED: 'Registro privado realizado', PRIVATE_RESPONSE_REPLACED: 'Registro privado atualizado',
  INVITATION_CREATED: 'Convite criado', INVITATION_RESENT: 'Convite reenviado', INVITATION_REVOKED: 'Convite revogado',
  DAILY_RECORD_SUBMITTED: 'Registro diário concluído', ACTIVITY_COMPLETION_RECORDED: 'Atividade concluída', ENROLLMENT_STARTED: 'Programa iniciado', ENROLLMENT_COMPLETED: 'Programa concluído',
  TENANT_PROGRAM_ENABLED: 'Programa liberado para a organização', TENANT_PROGRAM_DISABLED: 'Programa removido da organização',
}

const entityTypeLabels = {
  TenantProgram: 'Disponibilidade do programa', Enrollment: 'Ciclo do programa', Invitation: 'Convite',
  PrivateActivityResponse: 'Conteúdo privado preservado', Team: 'Time', TeamMembership: 'Vínculo com o time', TenantMembership: 'Acesso à organização',
}

function programSummary(program) {
  return `${program.activeEnrollments} ciclos em andamento · ${program.activityCompletions} tarefas concluídas · ${program.dailyRecords} registros diários`
}

const roleLabels = { CEO: 'CEO', MANAGER: 'Gestor', USER: 'Participante' }
const formatDate = (value) => new Date(value).toLocaleString('pt-BR')
const hasStarted = (member) => (member.startedEnrollments ?? member.activeEnrollments + member.completedEnrollments) > 0
const hasActivity = (member) => member.activityCompletions > 0 || member.dailyRecords > 0

function AuditEntry({ event }) {
  const actor = event.actor
    ? `${event.actor.email} · ${roleLabels[event.actor.role] ?? 'Membro'} (papel atual)`
    : event.actorType === 'SYSTEM' ? 'Sistema' : event.actorType === 'PLATFORM_ACCESS' ? 'Administração da plataforma' : 'Autor não disponível'
  return <article>
    <div>
      <strong>{actionLabels[event.action] ?? 'Ação registrada'}{event.activityTitle ? `: ${event.activityTitle}` : ''}</strong>
      <span>Por: {actor}</span>
      {event.target && <span>Pessoa relacionada: {event.target.email} · {roleLabels[event.target.role] ?? 'Membro'}</span>}
      <span>{event.programTitle ?? entityTypeLabels[event.entityType] ?? 'Registro administrativo'}</span>
    </div>
    <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
  </article>
}

export function AdministrationInsightsPanel({ administration }) {
  const insights = useAdministrationInsights(administration)
  const [referenceTime] = useState(() => Date.now())
  const summary = insights.report?.summary
  const members = insights.report?.members
  const started = members?.filter(hasStarted).length ?? 0
  const engaged = members?.filter(hasActivity).length ?? 0
  const recent = members?.filter((member) => {
    const date = new Date(member.lastObjectiveActivityAt).getTime()
    return member.lastObjectiveActivityAt && date >= referenceTime - 7 * 86400000 && date <= referenceTime
  }).length ?? 0
  const total = members?.length ?? 0
  const adoption = total ? Math.round(started / total * 100) : 0

  return <section className="admin-panel admin-insights">
    <header><div><span>Participação e acompanhamento</span><h2>Adesão ao projeto</h2></div>
      <select aria-label="Escopo dos indicadores" value={insights.scope} onChange={(event) => insights.setScope(event.target.value)}>
        {administration.canManageTeams && <option value="tenant">Toda a organização</option>}
        {insights.availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
    </header>
    {insights.status === 'loading' && <div className="admin-state" aria-live="polite" aria-atomic="true">Carregando indicadores objetivos…</div>}
    {insights.status === 'empty' && <p className="admin-empty">Nenhum time gerenciado disponível para esta leitura.</p>}
    {insights.status === 'error' && <div className="admin-state error" role="alert"><strong>Não foi possível carregar os indicadores.</strong><span>{insights.error?.message}</span><button className="button" type="button" onClick={() => insights.reload().catch(() => {})}>Tentar novamente</button></div>}
    {insights.status === 'ready' && <>
      {members && <>
        <p className="admin-insights-note">Pessoas com acesso ativo no escopo selecionado. Adesão considera quem iniciou pelo menos um ciclo; cada pessoa conta uma única vez.</p>
        <div className="admin-metrics">
          <article><span>Adesão ao projeto</span><strong>{total ? `${adoption}%` : '—'}</strong><small>{started} de {total} pessoas iniciaram</small></article>
          <article><span>Com atividade registrada</span><strong>{engaged}</strong><small>Ao menos uma tarefa ou registro diário</small></article>
          <article><span>Ativos nos últimos 7 dias</span><strong>{recent}</strong><small>Com tarefa ou registro diário no período</small></article>
          <article><span>Ainda não iniciaram</span><strong>{total - started}</strong><small>Pessoas para acompanhar</small></article>
        </div>
      </>}
      <h3>Resultados acumulados</h3>
      <div className="admin-metrics">
        <article><span>Ciclos em andamento ou pausados</span><strong>{summary.activeEnrollments}</strong></article>
        <article><span>Ciclos concluídos</span><strong>{summary.completedEnrollments ?? 0}</strong></article>
        <article><span>Tarefas concluídas</span><strong>{summary.activityCompletions}</strong></article>
        <article><span>Registros diários</span><strong>{summary.dailyRecords}</strong></article>
      </div>
      {members && <div className="admin-report-members"><h3>Acompanhamento por pessoa</h3>
        {members.length ? members.map((member) => <article key={member.membershipId}>
          <div><strong>{member.email}</strong><span>{roleLabels[member.role] ?? 'Membro'} · {hasActivity(member) ? 'Com participação registrada' : hasStarted(member) ? 'Iniciou, sem atividades registradas' : 'Ainda não iniciou'}</span>
            <span>Última atividade: {member.lastObjectiveActivityAt ? formatDate(member.lastObjectiveActivityAt) : 'Nenhuma registrada'}</span></div>
          <small>{member.activeEnrollments} ciclos em andamento ou pausados · {member.activityCompletions} tarefas · {member.dailyRecords} registros diários</small>
        </article>) : <p className="admin-empty">Nenhuma pessoa com acesso ativo neste escopo.</p>}
      </div>}
      {insights.report.programs && <div className="admin-report-members"><h3>Resultados por programa</h3>{insights.report.programs.map((program) => <article key={`${program.programId}-${program.programVersionId}`}><div><strong>{program.title ?? 'Versão ainda não iniciada'}</strong><span>{program.enrollments} ciclos disponibilizados · {program.completedEnrollments} concluídos</span></div><small>{programSummary(program)}</small></article>)}</div>}
      <details className="admin-audit"><summary>Histórico de ações · últimas {insights.audit.items.length} de {insights.audit.total}</summary>
        {insights.audit.items.length ? insights.audit.items.map((event) => <AuditEntry key={event.id} event={event} />) : <p className="admin-empty">Nenhuma atividade registrada.</p>}
      </details>
    </>}
  </section>
}
