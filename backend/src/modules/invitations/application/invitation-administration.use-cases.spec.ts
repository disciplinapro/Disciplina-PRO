import { jest } from '@jest/globals'
import { CreateFirstCeoInvitationUseCase, CreateInvitationUseCase, ListInvitationsUseCase, ResendInvitationUseCase, RevokeInvitationUseCase } from './invitation-administration.use-cases.js'
import { InvitationAdministrationRepository } from './invitation-administration.repository.js'
import { InvitationDelivery } from './invitation-delivery.js'
import { InvitationTokenService } from './invitation-token.js'

const NOW = new Date('2026-07-23T12:00:00.000Z')
const TENANT_ID = '019f854f-1e79-7cb5-ab4e-392158644046'
const MEMBERSHIP_ID = '019f854f-1e79-7cb5-ab4e-392158644047'
const INVITATION_ID = '019f854f-1e79-7cb5-ab4e-392158644048'
const context = { tenantId: TENANT_ID, membershipId: MEMBERSHIP_ID, userId: 'user-1', tenantRole: 'CEO' as const }

const record = {
  id: INVITATION_ID,
  tenantId: TENANT_ID,
  email: 'member@example.test',
  role: 'USER' as const,
  status: 'PENDING' as const,
  expiresAt: new Date('2026-07-26T12:00:00.000Z'),
  createdAt: NOW,
  updatedAt: NOW,
  teams: [],
}

function collaborators() {
  return {
    repository: {
      listTenant: jest.fn<InvitationAdministrationRepository['listTenant']>(),
      createTenant: jest.fn<InvitationAdministrationRepository['createTenant']>(),
      resendTenant: jest.fn<InvitationAdministrationRepository['resendTenant']>(),
      revokeTenant: jest.fn<InvitationAdministrationRepository['revokeTenant']>(),
      createFirstCeo: jest.fn<InvitationAdministrationRepository['createFirstCeo']>(),
    },
    tokens: {
      generate: jest.fn<InvitationTokenService['generate']>(() => ({ plainText: 'plain-secret', hash: 'a'.repeat(64) })),
      hash: jest.fn<InvitationTokenService['hash']>(() => 'a'.repeat(64)),
    },
    delivery: { send: jest.fn<InvitationDelivery['send']>(() => Promise.resolve('SENT' as const)) },
  }
}

describe('invitation administration use cases', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW))
  afterEach(() => jest.useRealTimers())

  it('lists only public invitation data returned by the repository', async () => {
    const { repository } = collaborators()
    repository.listTenant.mockResolvedValue([record])
    const result = await new ListInvitationsUseCase(repository).execute(context)
    expect(repository.listTenant).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT_ID, actorMembershipId: MEMBERSHIP_ID, now: NOW }))
    expect(result).toEqual([expect.objectContaining({ id: INVITATION_ID, teams: [] })])
    expect(JSON.stringify(result)).not.toMatch(/token/i)
  })

  it('creates, commits, and only then sends the plain token to delivery', async () => {
    const { repository, tokens, delivery } = collaborators()
    repository.createTenant.mockResolvedValue(record)
    const result = await new CreateInvitationUseCase(repository, tokens, delivery)
      .execute(context, { email: ' Member@Example.test ', role: 'USER' })
    expect(repository.createTenant).toHaveBeenCalledWith(expect.objectContaining({
      normalizedEmail: 'member@example.test',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2026-07-26T12:00:00.000Z'),
    }))
    expect(delivery.send).toHaveBeenCalledWith(expect.objectContaining({ invitationId: INVITATION_ID, token: 'plain-secret', includeWelcomeCard: true }))
    expect(result).toMatchObject({ id: INVITATION_ID, deliveryStatus: 'SENT' })
    expect(JSON.stringify(result)).not.toContain('plain-secret')
  })

  it('reports delivery failure without rolling back a created invitation', async () => {
    const { repository, tokens, delivery } = collaborators()
    repository.createTenant.mockResolvedValue(record)
    delivery.send.mockRejectedValue(new Error('SMTP unavailable'))
    await expect(new CreateInvitationUseCase(repository, tokens, delivery)
      .execute(context, { email: record.email, role: 'USER' })).resolves.toMatchObject({ deliveryStatus: 'FAILED' })
  })

  it('rotates a pending invitation and delivers the new token', async () => {
    const { repository, tokens, delivery } = collaborators()
    repository.resendTenant.mockResolvedValue(record)
    const result = await new ResendInvitationUseCase(repository, tokens, delivery).execute(context, INVITATION_ID)
    expect(delivery.send).toHaveBeenCalledWith(expect.objectContaining({ includeWelcomeCard: false }))
    expect(repository.resendTenant).toHaveBeenCalledWith(expect.objectContaining({ invitationId: INVITATION_ID, tokenHash: 'a'.repeat(64) }))
    expect(result).toMatchObject({ deliveryStatus: 'SENT' })
  })

  it('revokes without generating or delivering a token', async () => {
    const { repository } = collaborators()
    repository.revokeTenant.mockResolvedValue({ ...record, status: 'REVOKED' as const })
    await expect(new RevokeInvitationUseCase(repository).execute(context, INVITATION_ID)).resolves.toMatchObject({ status: 'REVOKED' })
  })

  it('creates the first CEO through platform context without teams', async () => {
    const { repository, tokens, delivery } = collaborators()
    repository.createFirstCeo.mockResolvedValue({ ...record, role: 'CEO' as const })
    const useCase = new CreateFirstCeoInvitationUseCase(repository, tokens, delivery)
    await expect(useCase.execute({ platformAccessId: 'access-1', userId: 'user-1', platformRole: 'SUPER_ADMIN' }, TENANT_ID, {
      email: record.email,
    })).resolves.toMatchObject({ role: 'CEO', deliveryStatus: 'SENT' })
    expect(delivery.send).toHaveBeenCalledWith(expect.objectContaining({ includeWelcomeCard: true }))
    expect(repository.createFirstCeo).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT_ID, actorPlatformAccessId: 'access-1' }))
  })
})
