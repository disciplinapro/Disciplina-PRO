import { Module } from '@nestjs/common'
import { SmtpClient } from '../invitations/application/smtp-client.js'
import { NodemailerSmtpClient } from '../invitations/infrastructure/nodemailer-smtp.client.js'
import { PasswordRecoveryUseCase } from './application/password-recovery.use-case.js'
import { CleanupExpiredPasswordRecoveryUseCase } from './application/cleanup-expired-password-recovery.use-case.js'
import { PasswordRecoveryRepository } from './application/password-recovery.repository.js'
import { PasswordRecoveryDelivery } from './application/password-recovery.delivery.js'
import { PrismaPasswordRecoveryRepository } from './infrastructure/prisma-password-recovery.repository.js'
import { PasswordRecoveryEmailDelivery } from './infrastructure/password-recovery-email.delivery.js'
import { BootstrapSuperAdminUseCase } from './application/bootstrap-super-admin.use-case.js'
import { AccessTokenService } from './application/access-token.js'
import { AuthenticatedPrincipalRepository } from './application/authenticated-principal.repository.js'
import { Clock, SystemClock } from './application/clock.js'
import { CleanupSessionsUseCase } from './application/cleanup-sessions.use-case.js'
import { CreateUserUseCase } from './application/create-user.use-case.js'
import { CreateSessionUseCase } from './application/create-session.use-case.js'
import { IdentityRepository } from './application/identity.repository.js'
import { LoginUseCase } from './application/login.use-case.js'
import { PasswordHasher } from './application/password-hasher.js'
import { RefreshTokenService } from './application/refresh-token.js'
import { ResolveRefreshSessionUseCase } from './application/resolve-refresh-session.use-case.js'
import { RevokeAllSessionsUseCase } from './application/revoke-all-sessions.use-case.js'
import { RevokeSessionUseCase } from './application/revoke-session.use-case.js'
import { RotateSessionUseCase } from './application/rotate-session.use-case.js'
import { SessionRepository } from './application/session.repository.js'
import { CsrfTokenService } from './application/csrf-token.js'
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js'
import { JoseAccessTokenService } from './infrastructure/jose-access-token.service.js'
import { OpaqueRefreshTokenService } from './infrastructure/opaque-refresh-token.service.js'
import { HmacCsrfTokenService } from './infrastructure/hmac-csrf-token.service.js'
import { PrismaIdentityRepository } from './infrastructure/prisma-identity.repository.js'
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository.js'
import { PrismaAuthenticatedPrincipalRepository } from './infrastructure/prisma-authenticated-principal.repository.js'
import { AuthController } from './http/auth.controller.js'
import { AuthenticationGuard } from './http/authentication.guard.js'

@Module({
  controllers: [AuthController],
  providers: [
    PasswordRecoveryUseCase,
    CleanupExpiredPasswordRecoveryUseCase,
    { provide: PasswordRecoveryRepository, useClass: PrismaPasswordRecoveryRepository },
    { provide: PasswordRecoveryDelivery, useClass: PasswordRecoveryEmailDelivery },
    { provide: SmtpClient, useClass: NodemailerSmtpClient },
    CreateUserUseCase,
    BootstrapSuperAdminUseCase,
    CreateSessionUseCase,
    RotateSessionUseCase,
    RevokeSessionUseCase,
    RevokeAllSessionsUseCase,
    LoginUseCase,
    ResolveRefreshSessionUseCase,
    CleanupSessionsUseCase,
    AuthenticationGuard,
    { provide: IdentityRepository, useClass: PrismaIdentityRepository },
    { provide: SessionRepository, useClass: PrismaSessionRepository },
    { provide: AuthenticatedPrincipalRepository, useClass: PrismaAuthenticatedPrincipalRepository },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: AccessTokenService, useClass: JoseAccessTokenService },
    { provide: RefreshTokenService, useClass: OpaqueRefreshTokenService },
    { provide: CsrfTokenService, useClass: HmacCsrfTokenService },
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [
    CreateUserUseCase,
    BootstrapSuperAdminUseCase,
    CreateSessionUseCase,
    RotateSessionUseCase,
    RevokeSessionUseCase,
    RevokeAllSessionsUseCase,
    CleanupSessionsUseCase,
    CleanupExpiredPasswordRecoveryUseCase,
    AccessTokenService,
    PasswordHasher,
    AuthenticationGuard,
  ],
})
export class IdentityAccessModule {}
