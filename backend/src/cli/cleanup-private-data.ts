import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module.js'
import { CleanupExpiredPrivateDataUseCase } from '../modules/privacy/application/private-data.use-cases.js'

const app = await NestFactory.createApplicationContext(AppModule, { logger: false })
try {
  const result = await app.get(CleanupExpiredPrivateDataUseCase).execute()
  process.stdout.write(`Dados privados expurgados: ${JSON.stringify(result)}\n`)
} finally {
  await app.close()
}
