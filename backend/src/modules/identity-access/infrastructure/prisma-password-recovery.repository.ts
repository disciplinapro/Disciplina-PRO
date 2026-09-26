import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service.js'
import { PasswordRecoveryRepository } from '../application/password-recovery.repository.js'

@Injectable()
export class PrismaPasswordRecoveryRepository extends PasswordRecoveryRepository {
  constructor(private readonly prisma: PrismaService) { super() }

  issue(input: { email: string; tokenHash: string; now: Date; expiresAt: Date }) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          normalizedEmail: input.email, status: 'ACTIVE',
          OR: [{ passwordResetRequestedAt: null }, { passwordResetRequestedAt: { lte: new Date(input.now.getTime() - 60_000) } }],
        },
        data: { passwordResetHash: input.tokenHash, passwordResetExpiresAt: input.expiresAt, passwordResetRequestedAt: input.now },
      })
      if (!updated.count) return null
      return tx.user.findUnique({ where: { normalizedEmail: input.email }, select: { email: true } })
    })
  }

  async clear(tokenHash: string) {
    await this.prisma.user.updateMany({ where: { passwordResetHash: tokenHash }, data: { passwordResetHash: null, passwordResetExpiresAt: null } })
  }

  consume(input: { tokenHash: string; passwordHash: string; now: Date }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { passwordResetHash: input.tokenHash }, select: { id: true } })
      if (!user) return false
      // The conditional update locks the user and admits exactly one consumer.
      const updated = await tx.user.updateMany({
        where: { id: user.id, status: 'ACTIVE', passwordResetHash: input.tokenHash, passwordResetExpiresAt: { gt: input.now } },
        data: { passwordHash: input.passwordHash, passwordResetHash: null, passwordResetExpiresAt: null },
      })
      if (!updated.count) return false
      await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: input.now, revocationReason: 'PASSWORD_RESET' } })
      await tx.refreshToken.updateMany({ where: { session: { userId: user.id }, revokedAt: null }, data: { revokedAt: input.now } })
      await tx.auditEvent.create({ data: { actorType: 'SYSTEM', entityType: 'User', entityId: user.id, action: 'PASSWORD_RESET_COMPLETED', metadata: {} } })
      return true
    })
  }

  cleanupExpired(input: { now: Date }): Promise<{ eligible: number; processed: number }> {
    return this.prisma.$transaction(async (tx) => {
      const where = { passwordResetExpiresAt: { lt: input.now } }
      const eligible = await tx.user.count({ where })
      const processed = await tx.user.updateMany({
        where,
        data: { passwordResetHash: null, passwordResetExpiresAt: null },
      })
      return { eligible, processed: processed.count }
    })
  }
}
