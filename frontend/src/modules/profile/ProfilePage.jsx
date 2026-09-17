import { useMemo, useState } from 'react'
import { useAppContext } from '../../app/providers/app-context'
import { createPrivacyHttpRepository } from './privacy.http.repository'

export function ProfilePage() {
  const app = useAppContext()
  const { user, tenant, membership } = app
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const privacy = useMemo(() => createPrivacyHttpRepository({
    getTenantId: () => tenant.id,
    authorizedFetch: app.sessionClient.authorizedFetch,
  }), [app.sessionClient, tenant.id])

  async function deletePrivateData() {
    if (!window.confirm('Excluir definitivamente suas respostas privadas, hábitos e justificativas desta organização?')) return
    setStatus('loading')
    setMessage('')
    try {
      await privacy.deleteMyPrivateData()
      setStatus('success')
      setMessage('Seus dados privados foram excluídos. Os hábitos padrão serão recriados vazios quando você abrir o tracker.')
    } catch (error) {
      setStatus('error')
      setMessage(error.message)
    }
  }

  return <>
    <section className="page-heading"><span className="eyebrow">Sua conta</span><h1>Perfil</h1><p>Identidade, organização e controles de privacidade.</p></section>
    <section className="profile-card"><div className="avatar large">{user.email.slice(0, 2).toUpperCase()}</div><div><h2>{user.email}</h2><span>{membership.role} em {tenant.name}</span></div></section>
    <section className="profile-privacy" aria-labelledby="private-data-title">
      <span className="eyebrow">Somente você</span>
      <h2 id="private-data-title">Dados privados</h2>
      <p>Respostas emocionais, reflexões, hábitos e justificativas não são exibidos à empresa. Dados vinculados a ciclos encerrados e registros antigos de hábitos são expurgados após 12 meses.</p>
      <button className="button profile-delete-private" type="button" disabled={status === 'loading'} onClick={deletePrivateData}>
        {status === 'loading' ? 'Excluindo…' : 'Excluir meus dados privados'}
      </button>
      {message && <p className={status === 'error' ? 'profile-private-message error' : 'profile-private-message'} role={status === 'error' ? 'alert' : 'status'}>{message}</p>}
    </section>
  </>
}
