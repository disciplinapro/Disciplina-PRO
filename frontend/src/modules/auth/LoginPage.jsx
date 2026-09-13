import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from '../../app/providers/app-context'

export function LoginPage() {
  const session = useAppContext()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  if (session.authenticated) return <Navigate to={session.platformAccess?.role === 'SUPER_ADMIN' ? '/plataforma' : '/app'} replace />

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      const context = await session.login(email, password)
      if (context.organizations.length === 0 && context.platformAccess?.role !== 'SUPER_ADMIN') {
        setMessage('Sua identidade não possui uma organização ativa.')
        return
      }
      navigate(location.state?.from ?? (context.platformAccess?.role === 'SUPER_ADMIN' ? '/plataforma' : '/app'), { replace: true })
    } catch {
      setMessage('E-mail ou senha inválidos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-mark">DP</span>
        <span className="eyebrow">Spark Inteligência Corporativa</span>
        <h1>Disciplina PRO</h1>
        <p>Acesse seus programas de desenvolvimento.</p>
        <label>E-mail<input required type="email" autoComplete="email" value={email} placeholder="voce@empresa.com.br" onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Senha<input required type="password" autoComplete="current-password" value={password} placeholder="••••••••" onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="button" disabled={submitting} type="submit">{submitting ? 'Entrando…' : 'Entrar'}</button>
        <Link className="login-recovery-link" to="/recuperar-senha">Esqueci minha senha</Link>
        {message && <p role="alert">{message}</p>}
      </form>
    </main>
  )
}
