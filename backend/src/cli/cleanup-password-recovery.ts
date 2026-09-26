import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module.js'
import { CleanupExpiredPasswordRecoveryUseCase } from '../modules/identity-access/application/cleanup-expired-password-recovery.use-case.js'

const app = await NestFactory.createApplicationContext(AppModule, { logger: false })
try {
  const result = await app.get(CleanupExpiredPasswordRecoveryUseCase).execute()
  process.stdout.write(`Solicitações expiradas elegíveis: ${result.eligible}; solicitações limpas: ${result.processed}\n`)
} finally {
  await app.close()
}
