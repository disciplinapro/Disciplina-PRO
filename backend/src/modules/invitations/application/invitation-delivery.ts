export interface InvitationDeliveryMessage {
  invitationId: string
  email: string
  token: string
  expiresAt: Date
  includeWelcomeCard?: boolean
  retryJobId?: string
}

export abstract class InvitationDelivery {
  abstract send(message: InvitationDeliveryMessage): Promise<'SENT' | 'FAILED'>
}
