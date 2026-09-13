import { createHash, randomBytes } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { assertPasswordPolicy, normalizeEmail } from '../domain/identity-policy.js'
import { Clock } from './clock.js'
import { PasswordHasher } from './password-hasher.js'
import { PasswordRecoveryRepository } from './password-recovery.repository.js'
import { PasswordRecoveryDelivery } from './password-recovery.delivery.js'

export class InvalidPasswordResetError extends Error {
  constructor() { super('Link inválido ou expirado. Solicite um novo link.') }
}

@Injectable()
export class PasswordRecoveryUseCase {
  private readonly logger = new Logger(PasswordRecoveryUseCase.name)

  constructor(
    private readonly repository: PasswordRecoveryRepository,
    private readonly delivery: PasswordRecoveryDelivery,
    private readonly passwords: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async request(email: string) {
    const now = this.clock.now()
    const token = randomBytes(32).toString('base64url')
    const tokenHash = this.hash(token)
    const recipient = await this.repository.issue({ email: normalizeEmail(email), tokenHash, now, expiresAt: new Date(now.getTime() + 30 * 60_000) })
    if (!recipient) return
    try {
      await this.delivery.send(recipient.email, token)
    } catch {
      await this.repository.clear(tokenHash)
      // Do not expose account existence or log the token, address or provider body.
      this.logger.warn('PASSWORD_RECOVERY_DELIVERY_FAILED')
    }
  }

  async reset(token: string, password: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new InvalidPasswordResetError()
    assertPasswordPolicy(password)
    const passwordHash = await this.passwords.hash(password.normalize('NFC'))
    if (!await this.repository.consume({ tokenHash: this.hash(token), passwordHash, now: this.clock.now() })) {
      throw new InvalidPasswordResetError()
    }
  }

  private hash(token: string) { return createHash('sha256').update(token).digest('hex') }
}
