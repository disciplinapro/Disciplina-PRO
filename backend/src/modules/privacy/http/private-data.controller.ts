import { Controller, Delete, HttpCode, NotFoundException } from '@nestjs/common'
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { CurrentTenantContext } from '../../organizations/application/organization-context.repository.js'
import { CurrentTenant } from '../../organizations/http/current-organization-context.decorators.js'
import { TenantRoute } from '../../organizations/http/organization-route.decorators.js'
import { DeleteMyPrivateDataUseCase } from '../application/private-data.use-cases.js'

@ApiTags('Private data')
@TenantRoute()
@Controller('privacy')
export class PrivateDataController {
  constructor(private readonly deleteMine: DeleteMyPrivateDataUseCase) {}

  @Delete('me/private-data')
  @HttpCode(204)
  @ApiOperation({ summary: 'Exclui respostas privadas, hábitos, justificativas e rastros derivados do titular' })
  @ApiNoContentResponse()
  async deletePrivateData(@CurrentTenant() context: CurrentTenantContext) {
    try {
      await this.deleteMine.execute(context)
    } catch (error) {
      if (error instanceof Error && error.message === 'PRIVATE_DATA_CONTEXT_NOT_FOUND') {
        throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Recurso não encontrado' })
      }
      throw error
    }
  }
}
