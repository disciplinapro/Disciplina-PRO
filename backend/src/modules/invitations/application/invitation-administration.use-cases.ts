import { Injectable } from '@nestjs/common'
import type { CurrentPlatformContext, CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { normalizeInvitationEmail, validateInvitationId, validateTenantInvitation, type InvitationTeamInput } from '../domain/invitation-policy.js'
import { InvitationAdministrationRepository, type InvitationRecord } from './invitation-administration.repository.js'
import { InvitationDelivery } from './invitation-delivery.js'
import { InvitationTokenService } from './invitation-token.js'

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000

function publicInvitation(invitation: InvitationRecord, deliveryStatus?: 'SENT' | 'FAILED') {
  return {
    id: invitation.id,
    tenantId: invitation.tenantId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    teams: invitation.teams,
    deliveryReview: invitation.deliveryReview ?? null,
    ...(deliveryStatus ? { deliveryStatus } : {}),
  }
}

abstract class InvitationWriter {
  constructor(
    protected readonly invitations: InvitationAdministrationRepository,
    protected readonly tokens: InvitationTokenService,
    protected readonly delivery: InvitationDelivery,
  ) {}

  protected issue(now: Date) {
    return { ...this.tokens.generate(), expiresAt: new Date(now.getTime() + INVITATION_TTL_MS) }
  }

  protected async deliver(invitation: InvitationRecord, token: string, includeWelcomeCard = false) {
    const deliveryStatus = await this.delivery.send({
      invitationId: invitation.id,
      email: invitation.email,
      token,
      expiresAt: invitation.expiresAt,
      includeWelcomeCard,
    }).catch(() => 'FAILED' as const)
    return publicInvitation(invitation, deliveryStatus)
  }
}

@Injectable()
export class ListInvitationsUseCase {
  constructor(private readonly invitations: InvitationAdministrationRepository) {}
  async execute(context: CurrentTenantContext) {
    const records = await this.invitations.listTenant({ tenantId: context.tenantId, actorMembershipId: context.membershipId, actorRole: context.tenantRole, now: new Date() })
    return records.map((record) => publicInvitation(record))
  }
}

@Injectable()
export class CreateInvitationUseCase extends InvitationWriter {
  constructor(invitations: InvitationAdministrationRepository, tokens: InvitationTokenService, delivery: InvitationDelivery) {
    super(invitations, tokens, delivery)
  }

  async execute(context: CurrentTenantContext, input: { email: string; role: string; teams?: InvitationTeamInput[] }) {
    const now = new Date()
    const identity = normalizeInvitationEmail(input.email)
    const policy = validateTenantInvitation(input)
    const token = this.issue(now)
    const invitation = await this.invitations.createTenant({
      tenantId: context.tenantId,
      actorMembershipId: context.membershipId,
      actorRole: context.tenantRole,
      ...identity,
      ...policy,
      tokenHash: token.hash,
      expiresAt: token.expiresAt,
      now,
    })
    return this.deliver(invitation, token.plainText, true)
  }
}

@Injectable()
export class ResendInvitationUseCase extends InvitationWriter {
  constructor(invitations: InvitationAdministrationRepository, tokens: InvitationTokenService, delivery: InvitationDelivery) {
    super(invitations, tokens, delivery)
  }

  async execute(context: CurrentTenantContext, invitationId: string) {
    const now = new Date()
    const token = this.issue(now)
    const invitation = await this.invitations.resendTenant({
      tenantId: context.tenantId,
      actorMembershipId: context.membershipId,
      actorRole: context.tenantRole,
      invitationId: validateInvitationId(invitationId),
      tokenHash: token.hash,
      expiresAt: token.expiresAt,
      now,
    })
    return this.deliver(invitation, token.plainText)
  }
}

@Injectable()
export class RevokeInvitationUseCase {
  constructor(private readonly invitations: InvitationAdministrationRepository) {}
  async execute(context: CurrentTenantContext, invitationId: string) {
    return publicInvitation(await this.invitations.revokeTenant({
      tenantId: context.tenantId,
      actorMembershipId: context.membershipId,
      actorRole: context.tenantRole,
      invitationId: validateInvitationId(invitationId),
      now: new Date(),
    }))
  }
}

@Injectable()
export class CreateFirstCeoInvitationUseCase extends InvitationWriter {
  constructor(invitations: InvitationAdministrationRepository, tokens: InvitationTokenService, delivery: InvitationDelivery) {
    super(invitations, tokens, delivery)
  }

  async execute(context: CurrentPlatformContext, tenantId: string, input: { email: string }) {
    const now = new Date()
    const identity = normalizeInvitationEmail(input.email)
    const token = this.issue(now)
    const invitation = await this.invitations.createFirstCeo({
      tenantId,
      actorPlatformAccessId: context.platformAccessId,
      ...identity,
      tokenHash: token.hash,
      expiresAt: token.expiresAt,
      now,
    })
    return this.deliver(invitation, token.plainText, true)
  }
}
