import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { TENANT_PERMISSIONS } from '../../organizations/domain/tenant-permissions.js'
import { CurrentTenant } from '../../organizations/http/current-organization-context.decorators.js'
import { RequireTenantPermissions } from '../../organizations/http/organization-route.decorators.js'
import { GetInactiveParticipantsReportUseCase, GetPersonalReportUseCase, GetTeamReportUseCase, GetTenantReportUseCase } from '../application/reporting.use-cases.js'
import { InactiveParticipantsReportResponseDto, PersonalReportResponseDto, TeamReportResponseDto, TenantReportResponseDto } from './reporting-response.dto.js'

@ApiTags('Reporting')
@Controller('reports')
export class ReportingController {
  constructor(
    private readonly getPersonalReport: GetPersonalReportUseCase,
    private readonly getTeamReport: GetTeamReportUseCase,
    private readonly getTenantReport: GetTenantReportUseCase,
    private readonly getInactiveParticipantsReport: GetInactiveParticipantsReportUseCase,
  ) {}

  @Get('me')
  @RequireTenantPermissions(TENANT_PERMISSIONS.REPORT_READ_SELF)
  @ApiOperation({ summary: 'Retorna métricas detalhadas apenas para a própria pessoa' })
  @ApiOkResponse({ type: PersonalReportResponseDto })
  mine(@CurrentTenant() context: CurrentTenantContext) {
    return this.getPersonalReport.execute(context)
  }

  @Get('teams/:teamId')
  @RequireTenantPermissions(TENANT_PERMISSIONS.REPORT_READ_TEAM)
  @ApiOperation({ summary: 'Retorna indicadores agregados e protegidos de um time' })
  @ApiOkResponse({ type: TeamReportResponseDto })
  async team(
    @CurrentTenant() context: CurrentTenantContext,
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ) {
    const report = await this.getTeamReport.execute(context, teamId)
    if (!report) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Recurso não encontrado' })
    return report
  }

  @Get('tenant')
  @RequireTenantPermissions(TENANT_PERMISSIONS.REPORT_READ_TENANT)
  @ApiOperation({ summary: 'Retorna indicadores agregados e protegidos da organização' })
  @ApiOkResponse({ type: TenantReportResponseDto })
  tenant(@CurrentTenant() context: CurrentTenantContext) {
    return this.getTenantReport.execute(context)
  }

  @Get('inactive-members')
  @RequireTenantPermissions(TENANT_PERMISSIONS.REPORT_READ_TENANT)
  @ApiOperation({ summary: 'Retorna somente a quantidade agregada de participantes inativos há 30 dias' })
  @ApiOkResponse({ type: InactiveParticipantsReportResponseDto })
  inactiveParticipants(@CurrentTenant() context: CurrentTenantContext) {
    return this.getInactiveParticipantsReport.execute(context)
  }
}
