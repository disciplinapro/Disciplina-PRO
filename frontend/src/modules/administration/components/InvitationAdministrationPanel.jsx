import { useMemo, useState } from 'react'
import { ConfirmationDialog } from './ConfirmationDialog'
import { InvitationDeliveryAlerts } from './InvitationDeliveryAlerts'

const statusLabels = { PENDING: 'Pendente', ACCEPTED: 'Aceito', REVOKED: 'Revogado', EXPIRED: 'Expirado' }

export function InvitationAdministrationPanel({ administration }) {
  const [form, setForm] = useState({ email: '', role: 'USER', teamIds: [] })
  const [invitationToRevoke, setInvitationToRevoke] = useState(null)
  const availableTeams = useMemo(() => {
    if (administration.canManageTeams) return administration.teams.filter(({ archivedAt }) => !archivedAt)
    const actor = administration.memberships.find(({ id }) => id === administration.actorMembershipId)
    return (actor?.teams ?? []).filter(({ role }) => role === 'MANAGER').map(({ team }) => team)
  }, [administration.actorMembershipId, administration.canManageTeams, administration.memberships, administration.teams])

  function toggleTeam(teamId) {
    setForm((current) => ({ ...current, teamIds: current.teamIds.includes(teamId) ? current.teamIds.filter((id) => id !== teamId) : [...current.teamIds, teamId] }))
  }

  async function submit(event) {
    event.preventDefault()
    const input = {
      email: form.email.trim(),
      role: administration.canManageTeams ? form.role : 'USER',
      teams: form.teamIds.map((teamId) => ({ teamId, role: form.role === 'MANAGER' ? 'MANAGER' : 'MEMBER' })),
    }
    if (await administration.createInvitation(input)) setForm({ email: '', role: 'USER', teamIds: [] })
  }

  return <section className="admin-panel admin-invitations"><header><div><span>Entrada nominal</span><h2>Convites</h2></div></header>
    <form className="admin-invitation-form" onSubmit={(event) => submit(event).catch(() => {})}><label>E-mail<input type="email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>{administration.canManageTeams && <label>Papel<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value, teamIds: [] }))}><option value="USER">Participante</option><option value="MANAGER">Gestor</option></select></label>}<fieldset><legend>Times {administration.canManageTeams ? '(opcional)' : '(obrigatório)'}</legend>{availableTeams.map((team) => <label key={team.id}><input type="checkbox" checked={form.teamIds.includes(team.id)} onChange={() => toggleTeam(team.id)} />{team.name}</label>)}{!availableTeams.length && <span>Nenhum time disponível no seu escopo.</span>}</fieldset><button className="button" disabled={administration.mutating || (!administration.canManageTeams && !form.teamIds.length)} type="submit">Enviar convite</button></form>
    {administration.delivery && <output className={`admin-delivery ${administration.delivery.status?.toLowerCase()}`}>Entrega para {administration.delivery.email}: {administration.delivery.status === 'SENT' ? 'aceita pelo provedor de e-mail; recebimento ainda não confirmado' : 'não confirmada; consulte os avisos de revisão antes de reenviar'}</output>}
    <InvitationDeliveryAlerts invitations={administration.invitations} actorMembershipId={administration.actorMembershipId} />
    <div className="admin-list">{administration.invitations.length ? administration.invitations.map((invitation) => <article key={invitation.id}><div className="admin-invite-mark">@</div><div><strong>{invitation.email}</strong><span>{invitation.role === 'MANAGER' ? 'Gestor' : 'Participante'} · expira em {new Date(invitation.expiresAt).toLocaleString('pt-BR')}</span><div className="admin-team-chips">{invitation.teams.map(({ teamId, role }) => <span key={teamId}>{availableTeams.find(({ id }) => id === teamId)?.name ?? 'Time no escopo'} · {role === 'MANAGER' ? 'Gestor' : 'Membro'}</span>)}</div></div><small className={`admin-status ${invitation.status.toLowerCase()}`}>{statusLabels[invitation.status] ?? invitation.status}</small>{invitation.status === 'PENDING' && <div className="admin-invite-actions"><button disabled={administration.mutating} type="button" onClick={() => administration.resendInvitation(invitation.id).catch(() => {})}>Reenviar</button><button disabled={administration.mutating} type="button" onClick={() => setInvitationToRevoke(invitation)}>Revogar</button></div>}</article>) : <p className="admin-empty">Nenhum convite visível no seu escopo.</p>}</div>
    {invitationToRevoke && <ConfirmationDialog actionLabel="Revogar convite" description="A pessoa não poderá mais usar este convite." onCancel={() => setInvitationToRevoke(null)} onConfirm={() => administration.revokeInvitation(invitationToRevoke.id).then(() => setInvitationToRevoke(null)).catch(() => {})} title={`Revogar convite de ${invitationToRevoke.email}?`} />}
  </section>
}
