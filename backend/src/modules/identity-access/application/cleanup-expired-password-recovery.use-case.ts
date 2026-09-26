import { Injectable } from '@nestjs/common'
import { Clock } from './clock.js'
import { PasswordRecoveryRepository } from './password-recovery.repository.js'

@Injectable()
export class CleanupExpiredPasswordRecoveryUseCase {
  constructor(private readonly repository: PasswordRecoveryRepository, private readonly clock: Clock) {}

  execute() {
    return this.repository.cleanupExpired({ now: this.clock.now() })
  }
}
