import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { readPasswordResetToken, requestPasswordRecovery, resetPassword } from './password-recovery.client'

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
    if (reset && password !== confirmation) return setMessage('As senhas precisam ser iguais.')
    if (reset && ([...password.normalize('NFC')].length < 15 || [...password.normalize('NFC')].length > 128)) {
      return setMessage('Use entre 15 e 128 caracteres na senha.')
    }
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
        {done ? <p role="status">{reset
          ? 'Senha redefinida. Entre novamente com sua nova senha.'
          : 'Se houver uma conta ativa para este e-mail, enviaremos um link para redefinir sua senha. Confira também a pasta de spam. O link expira em 30 minutos.'}</p>
          : unusableLink ? <>
            <p role="alert">Link inválido ou expirado. Solicite um novo link.</p>
            <Link className="login-recovery-link" to="/recuperar-senha">Solicitar novo link</Link>
          </> : <form onSubmit={submit} aria-busy={submitting}>
            <p>{reset ? 'Crie uma senha com 15 a 128 caracteres.' : 'Informe seu e-mail para receber um link de recuperação.'}</p>
            {reset ? <>
              <label>Nova senha<input required type="password" autoComplete="new-password" minLength={15} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label>Confirme a nova senha<input required type="password" autoComplete="new-password" minLength={15} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            </> : <label>E-mail<input required type="email" autoComplete="email" maxLength={320} value={email} placeholder="voce@empresa.com.br" onChange={(event) => setEmail(event.target.value)} /></label>}
            <button className="button" disabled={submitting} type="submit">{submitting ? 'Enviando…' : reset ? 'Salvar nova senha' : 'Enviar link de recuperação'}</button>
            {message && <p role="alert">{message}</p>}
          </form>}
        <Link className="login-recovery-link" to="/login" reloadDocument={done && reset}>Voltar para o login</Link>
      </section>
    </main>
  )
}
