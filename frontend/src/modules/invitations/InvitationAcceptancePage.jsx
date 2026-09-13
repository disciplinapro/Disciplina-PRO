import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../../app/providers/app-context'
import { acceptInvitation, readInvitationToken } from './invitation-acceptance.client'

function acceptanceErrorMessage(error) {
  if (error.code === 'EXISTING_ACCOUNT_AUTHENTICATION_REQUIRED') return 'Este e-mail já possui uma conta. Entre com a senha dessa conta para aceitar o convite.'
  if (error.code === 'INVITATION_INVALID') return 'Convite inválido, expirado, já utilizado ou destinado a outra conta. Confira o link mais recente e a conta utilizada.'
  if (error.code === 'INVALID_INVITATION_DATA') return 'Confira o convite e use uma senha de 15 a 128 caracteres.'
  return 'Não foi possível concluir. Confira suas credenciais e conexão e tente novamente.'
}

function submitLabel(submitting, existingIdentity) {
  if (submitting) return 'Aceitando…'
  return existingIdentity ? 'Aceitar convite' : 'Criar conta e aceitar convite'
}

function CredentialsFields({ session, existing, email, password, confirmation, setEmail, setPassword, setConfirmation }) {
  if (session.authenticated) return <p>Conta conectada: {session.user?.email}</p>
  return <>
    {existing && <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
    <label>{existing ? 'Senha' : 'Crie sua senha'}<input required type="password" minLength={existing ? undefined : 15} maxLength={128} autoComplete={existing ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {!existing && <>
      <p>Use de 15 a 128 caracteres. Você pode usar uma frase longa.</p>
      <label>Confirme sua senha<input required type="password" minLength={15} maxLength={128} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
    </>}
  </>
}

export function InvitationAcceptancePage() {
  const session = useAppContext()
  const location = useLocation()
  const navigate = useNavigate()
  const token = readInvitationToken(location.hash)
  const [existing, setExisting] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [accepted, setAccepted] = useState(false)
  const existingIdentity = existing || session.authenticated

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    setMessage('')
    if (!existingIdentity && password !== confirmation) {
      setMessage('As senhas precisam ser iguais.')
      return
    }
    setSubmitting(true)
    try {
      if (existingIdentity && !session.authenticated) await session.sessionClient.login(email, password)
      await acceptInvitation({ token, password, sessionClient: session.sessionClient, existingIdentity })
      setPassword('')
      setConfirmation('')
      setAccepted(true)
      navigate('/convites/aceitar', { replace: true })
    } catch (error) {
      if (error.code === 'EXISTING_ACCOUNT_AUTHENTICATION_REQUIRED') {
        setExisting(true)
        setPassword('')
        setConfirmation('')
      }
      setMessage(acceptanceErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const switchAccount = async () => {
    await session.logout()
    setExisting(true)
    setPassword('')
  }
  const toggleExistingAccount = () => {
    setExisting(!existing)
    setPassword('')
    setConfirmation('')
    setMessage('')
  }
  const toggleAccountLabel = existing ? 'Ainda não tenho conta' : 'Já tenho uma conta'

  let content
  if (accepted) {
    content = <>
      <output>Convite aceito! Seu acesso à organização está liberado.</output>
      <a className="button" href={existingIdentity ? '/app' : '/login'}>Entrar no Disciplina PRO</a>
    </>
  } else if (!token) {
    content = <>
      <p role="alert">Link de convite inválido ou incompleto. Abra o botão do e-mail mais recente ou solicite um novo convite ao administrador.</p>
      <a className="login-recovery-link" href="/login">Voltar ao login</a>
    </>
  } else if (session.status === 'loading') {
    content = <output>Verificando sessão…</output>
  } else {
    content = <>
      <p>{existingIdentity ? 'Use a conta do e-mail que recebeu o convite.' : 'Crie sua senha para ativar a conta do e-mail que recebeu o convite.'}</p>
      <form onSubmit={submit}>
        <CredentialsFields session={session} existing={existing} email={email} password={password} confirmation={confirmation} setEmail={setEmail} setPassword={setPassword} setConfirmation={setConfirmation} />
        <button className="button" type="submit" disabled={submitting}>{submitLabel(submitting, existingIdentity)}</button>
        {message && <p role="alert">{message}</p>}
      </form>
      {session.authenticated
        ? <button className="button" disabled={submitting} type="button" onClick={() => switchAccount().catch(() => {})}>Usar outra conta</button>
        : <button className="button" disabled={submitting} type="button" onClick={toggleExistingAccount}>{toggleAccountLabel}</button>}
    </>
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="invitation-title">
        <span className="brand-mark">DP</span>
        <span className="eyebrow">Disciplina PRO</span>
        <h1 id="invitation-title">Aceitar convite</h1>
        {content}
      </section>
    </main>
  )
}
