import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { readPasswordResetToken, requestPasswordRecovery, resetPassword } from './password-recovery.client'

function passwordError(password, confirmation) {
  if (password !== confirmation) return 'As senhas precisam ser iguais.'
  const length = [...password.normalize('NFC')].length
  if (length < 15 || length > 128) return 'Use entre 15 e 128 caracteres na senha.'
  return ''
}

function RecoveryContent({ done, reset, unusableLink, children }) {
  if (done) return <output>{reset
    ? 'Senha redefinida. Entre novamente com sua nova senha.'
    : 'Se houver uma conta ativa para este e-mail, enviaremos um link para redefinir sua senha. Confira também a pasta de spam. O link expira em 30 minutos.'}</output>
  if (unusableLink) return <>
    <p role="alert">Link inválido ou expirado. Solicite um novo link.</p>
    <Link className="login-recovery-link" to="/recuperar-senha">Solicitar novo link</Link>
  </>
  return children
}

function submitLabel(submitting, reset) {
  if (submitting) return 'Enviando…'
  return reset ? 'Salvar nova senha' : 'Enviar link de recuperação'
}

export function PasswordRecoveryPage({ reset = false }) {
  const location = useLocation()
  const token = readPasswordResetToken(location.hash)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [invalidToken, setInvalidToken] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (submitting) return
    setMessage('')
    const validation = reset ? passwordError(password, confirmation) : ''
    if (validation) return setMessage(validation)
    setSubmitting(true)
    try {
      if (reset) await resetPassword(token, password)
      else await requestPasswordRecovery(email.trim())
      setPassword('')
      setConfirmation('')
      setDone(true)
    } catch (error) {
      if (error.code === 'INVALID_RESET_TOKEN') setInvalidToken(true)
      else setMessage(error.status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente novamente.' : 'Não foi possível concluir. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const unusableLink = reset && (!token || invalidToken)
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="recovery-title">
        <span className="brand-mark">DP</span>
        <span className="eyebrow">Disciplina PRO</span>
        <h1 id="recovery-title">{reset ? 'Nova senha' : 'Recuperar senha'}</h1>
        <RecoveryContent done={done} reset={reset} unusableLink={unusableLink}>
          <form onSubmit={submit} aria-busy={submitting}>
            <p>{reset ? 'Crie uma senha com 15 a 128 caracteres.' : 'Informe seu e-mail para receber um link de recuperação.'}</p>
            {reset ? <>
              <label>Nova senha<input required type="password" autoComplete="new-password" minLength={15} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label>Confirme a nova senha<input required type="password" autoComplete="new-password" minLength={15} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            </> : <label>E-mail<input required type="email" autoComplete="email" maxLength={320} value={email} placeholder="voce@empresa.com.br" onChange={(event) => setEmail(event.target.value)} /></label>}
            <button className="button" disabled={submitting} type="submit">{submitLabel(submitting, reset)}</button>
            {message && <p role="alert">{message}</p>}
          </form>
        </RecoveryContent>
        <Link className="login-recovery-link" to="/login" reloadDocument={done && reset}>Voltar para o login</Link>
      </section>
    </main>
  )
}
