import { Module } from '@nestjs/common'
import { PrivateDataRepository } from './application/private-data.repository.js'
import { CleanupExpiredPrivateDataUseCase, DeleteMyPrivateDataUseCase } from './application/private-data.use-cases.js'
import { PrivateDataController } from './http/private-data.controller.js'
import { PrismaPrivateDataRepository } from './infrastructure/prisma-private-data.repository.js'

@Module({
  controllers: [PrivateDataController],
  providers: [
    PrismaPrivateDataRepository,
    { provide: PrivateDataRepository, useExisting: PrismaPrivateDataRepository },
    DeleteMyPrivateDataUseCase,
    CleanupExpiredPrivateDataUseCase,
  ],
  exports: [CleanupExpiredPrivateDataUseCase],
})
export class PrivacyModule {}
