import { Injectable } from '@nestjs/common'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { PrivateDataRepository } from './private-data.repository.js'

const RETENTION_MONTHS = 12

@Injectable()
export class DeleteMyPrivateDataUseCase {
  constructor(private readonly repository: PrivateDataRepository) {}

  async execute(context: CurrentTenantContext) {
    const result = await this.repository.deleteMine(context)
    if (!result) throw new Error('PRIVATE_DATA_CONTEXT_NOT_FOUND')
    return result
  }
}

@Injectable()
export class CleanupExpiredPrivateDataUseCase {
  constructor(private readonly repository: PrivateDataRepository) {}

  execute(now = new Date()) {
    const cutoff = new Date(now)
    cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS)
    return this.repository.cleanupExpired({ cutoff })
  }
}
