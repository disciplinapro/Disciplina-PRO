import { Module } from '@nestjs/common'
import { ReportingRepository } from './application/reporting.repository.js'
import { GetInactiveParticipantsReportUseCase, GetPersonalReportUseCase, GetTeamReportUseCase, GetTenantReportUseCase } from './application/reporting.use-cases.js'
import { ReportingController } from './http/reporting.controller.js'
import { PrismaReportingRepository } from './infrastructure/prisma-reporting.repository.js'

@Module({
  controllers: [ReportingController],
  providers: [
    PrismaReportingRepository,
    { provide: ReportingRepository, useExisting: PrismaReportingRepository },
    GetPersonalReportUseCase,
    GetTeamReportUseCase,
    GetTenantReportUseCase,
    GetInactiveParticipantsReportUseCase,
  ],
})
export class ReportingModule {}
