import { jest } from '@jest/globals'
import { PasswordRecoveryEmailDelivery } from './password-recovery-email.delivery.js'
import { SmtpClient } from '../../invitations/application/smtp-client.js'

function setup(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    SMTP_DELIVERY_ENABLED: true, INVITATION_EMAIL_PROVIDER: 'smtp', DEPLOYMENT_STAGE: 'local',
    FRONTEND_URL: 'https://app.example.test', SMTP_FROM: 'sender@example.test', RESEND_FROM: 'sender@example.test', ...overrides,
  }
  const smtp = { send: jest.fn<SmtpClient['send']>().mockResolvedValue() }
  const config = { get: (key: string) => values[key] }
  return { delivery: new PasswordRecoveryEmailDelivery(config as never, smtp), smtp }
}

describe('PasswordRecoveryEmailDelivery', () => {
  afterEach(() => jest.restoreAllMocks())

  it('sends a link to the configured frontend using a fragment', async () => {
    const { delivery, smtp } = setup()
    await delivery.send('person@example.test', 'a'.repeat(43))
    const message = smtp.send.mock.calls[0][0]
    expect(message.text).toContain(`https://app.example.test/redefinir-senha#token=${'a'.repeat(43)}`)
    expect(message.text).toContain('30 minutos')
    expect(message.to).toBe('person@example.test')
    expect(message.html).toContain('src="https://app.example.test/email/main.jpeg"')
    expect(message.html).toContain('Equipe Disciplina PRO')
    expect(message.text).toContain('suporte@disciplinapro.com.br')
  })

  it('does not send when disabled or to a disallowed Resend test recipient', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch')
    const disabled = setup({ SMTP_DELIVERY_ENABLED: false })
    await expect(disabled.delivery.send('person@example.test', 'a'.repeat(43))).rejects.toThrow('EMAIL_DISABLED')
    expect(disabled.smtp.send).not.toHaveBeenCalled()
    const restricted = setup({ INVITATION_EMAIL_PROVIDER: 'resend', RESEND_TEST_RECIPIENT: 'allowed@example.test' })
    await expect(restricted.delivery.send('person@example.test', 'a'.repeat(43))).rejects.toThrow('RECIPIENT_NOT_ALLOWED')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses the configured Resend provider and rejects failed delivery', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'message-id' }), { status: 200 }))
    const { delivery, smtp } = setup({ INVITATION_EMAIL_PROVIDER: 'resend', DEPLOYMENT_STAGE: 'production', RESEND_API_KEY: 'test-key' })
    await delivery.send('person@example.test', 'a'.repeat(43))
    expect(smtp.send).not.toHaveBeenCalled()
    const payload = JSON.parse(fetch.mock.calls[0][1]?.body as string) as { html: string; text: string }
    expect(payload.html).toContain('/email/main.jpeg')
    expect(payload.text).toContain('Equipe Disciplina PRO')
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }))
    fetch.mockResolvedValueOnce(new Response('{}', { status: 503 }))
    await expect(delivery.send('person@example.test', 'b'.repeat(43))).rejects.toThrow('EMAIL_REJECTED')
  })
})
