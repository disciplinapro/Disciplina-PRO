import { SessionApiError } from './session.client.js'

export function readPasswordResetToken(hash) {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? ''
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null
}

export async function requestPasswordRecovery(email) {
  return send('forgot-password', { email })
}

export async function resetPassword(token, password) {
  return send('reset-password', { token, password })
}

async function send(endpoint, body) {
  const response = await fetch(`/api/auth/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}))
    throw new SessionApiError(response.status, problem.code ?? 'REQUEST_FAILED', 'Não foi possível concluir a solicitação.')
  }
}
