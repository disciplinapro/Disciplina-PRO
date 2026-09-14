import { invitationEmail } from './invitation-email.js'

const message = {
  invitationId: 'invitation', email: 'member@example.test', token: 'private-invitation-token',
  expiresAt: new Date('2026-09-16T12:00:00Z'),
}
const acceptanceUrl = 'https://app.example.test/convites/aceitar'
const from = 'no-reply@example.test'

describe('Initial invitation welcome card', () => {
  it('uses the frontend image without sending the token to the image URL', () => {
    const email = invitationEmail({ ...message, includeWelcomeCard: true }, acceptanceUrl, from)
    expect(email.html).toContain('src="https://app.example.test/email/bem-vindo.jpeg"')
    expect(email.html).toContain('alt="Bem-vindo(a) ao Disciplina PRO — Sistema de Treinamento"')
    expect(email.html).toContain('max-width:600px;height:auto')
    expect(email.html.indexOf('<img')).toBeLessThan(email.html.indexOf('Aceitar convite'))
    expect(email.html).toContain(`href="${acceptanceUrl}#token=${message.token}"`)
    expect(email.text).toContain(`${acceptanceUrl}#token=${message.token}`)
    expect(email.text).toContain(message.expiresAt.toISOString())
    expect(email.text).not.toContain('<img')
    expect(email.html).not.toContain('/email/main.jpeg')
    expect(email.html).toContain('Equipe Disciplina PRO')
    expect(email.text).toContain('Equipe Disciplina PRO')
  })

  it.each([false, undefined])('uses the default card for resends and messages without opt-in (%s)', (includeWelcomeCard) => {
    const email = invitationEmail({ ...message, includeWelcomeCard }, acceptanceUrl, from)
    expect(email.html).toContain('src="https://app.example.test/email/main.jpeg"')
    expect(email.html).not.toContain('bem-vindo.jpeg')
    expect(email.text).toContain('Equipe Disciplina PRO')
    expect(email.html).toContain('Equipe Disciplina PRO')
    expect(email.html).toContain('Aceitar convite')
  })
})
