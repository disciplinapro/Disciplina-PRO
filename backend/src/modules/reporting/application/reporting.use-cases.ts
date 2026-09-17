import { Injectable } from '@nestjs/common'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { ReportingRepository } from './reporting.repository.js'

@Injectable()
export class GetPersonalReportUseCase {
  constructor(private readonly repository: ReportingRepository) {}

  execute(context: CurrentTenantContext) {
    return this.repository.findPersonal(context)
  }
}

@Injectable()
export class GetTeamReportUseCase {
  constructor(private readonly repository: ReportingRepository) {}

  execute(context: CurrentTenantContext, teamId: string) {
    return this.repository.findTeam(context, teamId)
  }
}

@Injectable()
export class GetTenantReportUseCase {
  constructor(private readonly repository: ReportingRepository) {}

  execute(context: CurrentTenantContext) {
    return this.repository.findTenant(context)
  }
}

@Injectable()
export class GetInactiveParticipantsReportUseCase {
  constructor(private readonly repository: ReportingRepository) {}

  execute(context: CurrentTenantContext, now = new Date()) {
    const cutoff = new Date(now.getTime() - 30 * 86_400_000)
    return this.repository.findInactiveParticipants(context, cutoff)
  }
}
