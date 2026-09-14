import type { InvitationDeliveryMessage } from '../application/invitation-delivery.js'
import { brandedEmail, escapeEmailHtml } from '../../../email/branded-email.js'

export function invitationEmail(message: InvitationDeliveryMessage, acceptanceUrl: string, from: string) {
  const link = `${acceptanceUrl}#token=${encodeURIComponent(message.token)}`
  const htmlLink = escapeEmailHtml(link)
  return {
    from,
    to: message.email,
    subject: 'Seu convite para o Disciplina PRO',
    ...brandedEmail({
      frontendUrl: acceptanceUrl,
      welcome: message.includeWelcomeCard,
      text: ['Você recebeu um convite para o Disciplina PRO.', `Abra o link: ${link}`, `Este convite expira em ${message.expiresAt.toISOString()}.`].join('\n\n'),
      html: ['<p>Você recebeu um convite para o Disciplina PRO.</p>', `<p><a href="${htmlLink}">Aceitar convite</a></p>`, `<p>Este convite expira em ${message.expiresAt.toISOString()}.</p>`].join(''),
    }),
  }
}
