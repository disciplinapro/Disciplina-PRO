import { jest } from '@jest/globals'
import { ResendInvitationNoticeDelivery } from './resend-invitation-notice.delivery.js'

describe('Resend administrator notices', () => {
  afterEach(() => jest.restoreAllMocks())
  const notice = { id: 'job-test', invitationId: 'invitation-test', email: 'owner@example.test' }
  function subject(overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = { SMTP_DELIVERY_ENABLED: true, DEPLOYMENT_STAGE: 'lab', RESEND_TEST_RECIPIENT: notice.email, RESEND_FROM: 'onboarding@resend.dev', RESEND_API_KEY: 're_fake-test-only', FRONTEND_URL: 'https://app.example.test', ...overrides }
    const request = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'provider-test' })))
    return { delivery: new ResendInvitationNoticeDelivery({ get: (key: string) => values[key] } as never), request }
  }

  it('sends only to the resolved administrator with stable idempotency and no invitation token', async () => {
    const { delivery, request } = subject()
    request.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ id: 'provider-test' }))))
    expect(await delivery.send(notice)).toBe('SENT')
    expect(await delivery.send(notice)).toBe('SENT')
    const options = request.mock.calls[0][1]
    expect(JSON.parse(options?.body as string)).toMatchObject({ to: notice.email })
    expect(options?.body).not.toContain('token=')
    const payload = JSON.parse(options?.body as string) as { html: string; text: string }
    expect(payload.html).toContain('/email/main.jpeg')
    expect(payload.html).toContain('Equipe Disciplina PRO')
    expect(payload.text).toContain('Equipe Disciplina PRO')
    expect(options?.headers).toEqual(request.mock.calls[1][1]?.headers)
    expect(options?.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([{ SMTP_DELIVERY_ENABLED: false }, { RESEND_TEST_RECIPIENT: 'another@example.test' }, { RESEND_TEST_RECIPIENT: '' }])('blocks disallowed sending %j', async (settings) => {
    const { delivery, request } = subject(settings)
    expect(await delivery.send(notice)).toBe('BLOCKED')
    expect(request).not.toHaveBeenCalled()
  })

  it.each([400, 403, 429])('records HTTP %s as failed without retry', async (status) => {
    const { delivery, request } = subject()
    request.mockResolvedValue(new Response('private error', { status }))
    expect(await delivery.send(notice)).toBe('FAILED')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it.each([409, 500, 503])('treats HTTP %s as uncertain without retry', async (status) => {
    const { delivery, request } = subject()
    request.mockResolvedValue(new Response('', { status }))
    expect(await delivery.send(notice)).toBe('UNCERTAIN')
  })

  it('preserves uncertainty on timeouts and malformed responses', async () => {
    const { delivery, request } = subject()
    request.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(new Response('{}'))
    expect(await delivery.send(notice)).toBe('UNCERTAIN')
    expect(await delivery.send(notice)).toBe('UNCERTAIN')
  })
})
