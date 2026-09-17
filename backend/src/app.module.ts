import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LoggerModule } from 'nestjs-pino'
import { type Environment, validateEnvironment } from './config/environment.js'
import { PrismaModule } from './database/prisma.module.js'
import { HealthController } from './health/health.controller.js'
import { HealthService } from './health/health.service.js'
import { LOG_REDACTION_PATHS, sanitizeLoggedRequest } from './logging/log-redaction.js'
import { IdentityAccessModule } from './modules/identity-access/identity-access.module.js'
import { AuthenticationGuard } from './modules/identity-access/http/authentication.guard.js'
import { OrganizationsModule } from './modules/organizations/organizations.module.js'
import { TenantContextGuard } from './modules/organizations/http/tenant-context.guard.js'
import { PlatformAccessGuard } from './modules/organizations/http/platform-access.guard.js'
import { PermissionGuard } from './modules/organizations/http/permission.guard.js'
import { InvitationsModule } from './modules/invitations/invitations.module.js'
import { ProgramsModule } from './modules/programs/programs.module.js'
import { ExecutionModule } from './modules/execution/execution.module.js'
import { EventsModule } from './modules/events/events.module.js'
import { GamificationModule } from './modules/gamification/gamification.module.js'
import { AuditModule } from './modules/audit/audit.module.js'
import { ReportingModule } from './modules/reporting/reporting.module.js'
import { TrackerModule } from './modules/tracker/tracker.module.js'
import { RitualModule } from './modules/ritual/ritual.module.js'
import { MissionsModule } from './modules/missions/missions.module.js'
import { PrivacyModule } from './modules/privacy/privacy.module.js'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const sourceEnvironmentPath = resolve(moduleDirectory, '../../.env')
const compiledEnvironmentPath = resolve(moduleDirectory, '../../../.env')
const environmentPath = existsSync(sourceEnvironmentPath) ? sourceEnvironmentPath : compiledEnvironmentPath

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: environmentPath, validate: validateEnvironment }),
    PrismaModule,
    IdentityAccessModule,
    OrganizationsModule,
    InvitationsModule,
    ProgramsModule,
    EventsModule,
    GamificationModule,
    AuditModule,
    ReportingModule,
    TrackerModule,
    RitualModule,
    MissionsModule,
    ExecutionModule,
    PrivacyModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => [{ ttl: config.get('RATE_LIMIT_TTL_MS', { infer: true }), limit: config.get('RATE_LIMIT_MAX', { infer: true }) }],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          genReqId: (request) => request.headers['x-request-id']?.toString() ?? randomUUID(),
          serializers: { req: sanitizeLoggedRequest },
          redact: { paths: LOG_REDACTION_PATHS, censor: '[REDACTED]' },
        },
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthenticationGuard },
    { provide: APP_GUARD, useExisting: TenantContextGuard },
    { provide: APP_GUARD, useExisting: PlatformAccessGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
  ],
})
export class AppModule {}
