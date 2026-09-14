import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'
import { brandedEmail, escapeEmailHtml } from '../../../email/branded-email.js'
import type { Environment } from '../../../config/environment.js'
import { InvitationNoticeDelivery, type InvitationNotice } from '../application/invitation-notice.js'

@Injectable()
export class ResendInvitationNoticeDelivery extends InvitationNoticeDelivery {
  constructor(private readonly config: ConfigService<Environment, true>) { super() }

  async send(notice: InvitationNotice): Promise<'SENT' | 'FAILED' | 'BLOCKED' | 'UNCERTAIN'> {
    if (!this.config.get('SMTP_DELIVERY_ENABLED', { infer: true })) return 'BLOCKED'
    const stage = this.config.get('DEPLOYMENT_STAGE', { infer: true })
    const allowed = this.config.get('RESEND_TEST_RECIPIENT', { infer: true })
    if (['local', 'lab'].includes(stage) && notice.email.toLowerCase() !== allowed?.toLowerCase()) return 'BLOCKED'
    // No acceptance token or invitee address: details require an authenticated panel.
    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true })
    const text = `A entrega do convite ${notice.invitationId} precisa de revisão. O envio automático foi interrompido. Acesse o painel de administração para verificar; não reenvie sem confirmar a causa.`
    const body = JSON.stringify({
      from: this.config.get('RESEND_FROM', { infer: true }), to: notice.email,
      subject: 'Um convite precisa de revisão — Disciplina PRO',
      ...brandedEmail({
        frontendUrl,
        text: `${text}\n${frontendUrl}`,
        html: `<p>${escapeEmailHtml(text)}</p><p><a href="${escapeEmailHtml(new URL('/app/administracao', frontendUrl).href)}">Acessar painel de administração</a></p>`,
      }),
    })
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${this.config.get('RESEND_API_KEY', { infer: true })}`, 'Content-Type': 'application/json', 'Idempotency-Key': `invitation-notice-${notice.id}-${createHash('sha256').update(body).digest('hex')}` },
        body, signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) return response.status >= 400 && response.status < 500 && response.status !== 409 ? 'FAILED' : 'UNCERTAIN'
      const result: unknown = await response.json()
      return result && typeof result === 'object' && 'id' in result && typeof result.id === 'string' && result.id ? 'SENT' : 'UNCERTAIN'
    } catch { return 'UNCERTAIN' }
  }
}
