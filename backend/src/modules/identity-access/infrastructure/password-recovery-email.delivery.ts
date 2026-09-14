import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { brandedEmail, escapeEmailHtml } from '../../../email/branded-email.js'
import type { Environment } from '../../../config/environment.js'
import { SmtpClient } from '../../invitations/application/smtp-client.js'
import { PasswordRecoveryDelivery } from '../application/password-recovery.delivery.js'

@Injectable()
export class PasswordRecoveryEmailDelivery extends PasswordRecoveryDelivery {
  constructor(private readonly config: ConfigService<Environment, true>, private readonly smtp: SmtpClient) { super() }

  async send(email: string, token: string) {
    if (!this.config.get('SMTP_DELIVERY_ENABLED', { infer: true })) throw new Error('EMAIL_DISABLED')
    const resend = this.config.get('INVITATION_EMAIL_PROVIDER', { infer: true }) === 'resend'
    const stage = this.config.get('DEPLOYMENT_STAGE', { infer: true })
    if (resend && (stage === 'local' || stage === 'lab') && email.toLowerCase() !== this.config.get('RESEND_TEST_RECIPIENT', { infer: true })?.toLowerCase()) {
      throw new Error('RECIPIENT_NOT_ALLOWED')
    }
    const link = new URL('/redefinir-senha', this.config.get('FRONTEND_URL', { infer: true }))
    link.hash = `token=${token}`
    const htmlLink = escapeEmailHtml(link.href)
    const message = {
      from: this.config.get(resend ? 'RESEND_FROM' : 'SMTP_FROM', { infer: true }),
      to: email,
      subject: 'Recupere sua senha — Disciplina PRO',
      ...brandedEmail({
        frontendUrl: link.href,
        text: `Para redefinir sua senha, acesse: ${link.href}\n\nO link expira em 30 minutos e só pode ser usado uma vez. Se você não solicitou esta alteração, ignore este e-mail.`,
        html: `<p><a href="${htmlLink}">Redefinir minha senha</a></p><p>O link expira em 30 minutos e só pode ser usado uma vez.</p><p>Se você não solicitou esta alteração, ignore este e-mail.</p>`,
      }),
    }
    if (!resend) return this.smtp.send(message)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.get('RESEND_API_KEY', { infer: true })}`, 'Content-Type': 'application/json', 'Idempotency-Key': `password-reset-${createHash('sha256').update(token).digest('hex')}` },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error('EMAIL_REJECTED')
    const result: unknown = await response.json()
    if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !result.id) throw new Error('EMAIL_INVALID_RESPONSE')
  }
}
