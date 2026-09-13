import { BadRequestException, Body, Controller, ForbiddenException, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import type { Environment } from '../../../config/environment.js'
import { CsrfTokenService } from '../application/csrf-token.js'
import { LoginUseCase } from '../application/login.use-case.js'
import { ResolveRefreshSessionUseCase } from '../application/resolve-refresh-session.use-case.js'
import { RevokeSessionUseCase } from '../application/revoke-session.use-case.js'
import { RotateSessionUseCase } from '../application/rotate-session.use-case.js'
import { InvalidCredentialsError, WeakPasswordError } from '../domain/identity.errors.js'
import { InvalidPasswordResetError, PasswordRecoveryUseCase } from '../application/password-recovery.use-case.js'
import { RequestPasswordRecoveryDto, ResetPasswordDto } from './password-recovery.dto.js'
import { InvalidRefreshTokenError, RefreshTokenReuseError } from '../domain/session.errors.js'
import { LoginDto } from './login.dto.js'
import { Public } from './public.decorator.js'

const PRODUCTION_REFRESH_COOKIE = '__Host-dp_refresh'
const PRODUCTION_CSRF_COOKIE = '__Host-dp_csrf'
const LOGIN_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 100 : 10

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly login: LoginUseCase,
    private readonly rotate: RotateSessionUseCase,
    private readonly revoke: RevokeSessionUseCase,
    private readonly resolveSession: ResolveRefreshSessionUseCase,
    private readonly csrf: CsrfTokenService,
    private readonly recovery: PasswordRecoveryUseCase,
  ) {}

  @Post('forgot-password')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body() input: RequestPasswordRecoveryDto, @Req() request: Request) {
    this.assertAllowedOrigin(request)
    await this.recovery.request(input.email)
    return { message: 'Se houver uma conta ativa para este e-mail, enviaremos um link para redefinir sua senha.' }
  }

  @Post('reset-password')
  @Public()
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(@Body() input: ResetPasswordDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertAllowedOrigin(request)
    try {
      await this.recovery.reset(input.token, input.password)
      this.clearSessionCookies(response)
    } catch (error) {
      if (error instanceof InvalidPasswordResetError) throw new BadRequestException({ code: 'INVALID_RESET_TOKEN', message: error.message })
      if (error instanceof WeakPasswordError) throw new BadRequestException({ code: 'WEAK_PASSWORD', message: error.message })
      throw error
    }
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cria uma sessão' })
  @ApiResponse({ status: 200, description: 'Access token no corpo e refresh em cookie HttpOnly' })
  async create(@Body() input: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertAllowedOrigin(request)
    try {
      const session = await this.login.execute(input)
      this.setSessionCookies(response, session)
      return this.accessResponse(session)
    } catch (error) {
      if (error instanceof InvalidCredentialsError) throw this.unauthorized('INVALID_CREDENTIALS', error.message)
      throw error
    }
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotaciona o refresh token uma única vez' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertAllowedOrigin(request)
    try {
      const refreshToken = this.cookie(request, this.refreshCookieName())
      const sessionId = await this.resolveSession.execute(refreshToken)
      this.assertCsrf(request, sessionId)
      const session = await this.rotate.execute({ refreshToken })
      this.setSessionCookies(response, session)
      return this.accessResponse(session)
    } catch (error) {
      if (error instanceof RefreshTokenReuseError) {
        this.clearSessionCookies(response)
        throw this.unauthorized('SESSION_REVOKED', 'Sessão revogada')
      }
      if (error instanceof InvalidRefreshTokenError) {
        this.clearSessionCookies(response)
        throw this.unauthorized('INVALID_SESSION', 'Sessão inválida ou expirada')
      }
      throw error
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoga a sessão atual' })
  @ApiResponse({ status: 204 })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertAllowedOrigin(request)
    try {
      const refreshToken = this.cookie(request, this.refreshCookieName())
      const sessionId = await this.resolveSession.execute(refreshToken)
      this.assertCsrf(request, sessionId)
      await this.revoke.execute({ sessionId })
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) throw this.unauthorized('INVALID_SESSION', 'Sessão inválida ou expirada')
      throw error
    } finally {
      this.clearSessionCookies(response)
    }
  }

  private assertAllowedOrigin(request: Request) {
    if (request.headers.origin !== this.config.get('FRONTEND_URL', { infer: true })) {
      throw new ForbiddenException({ code: 'ORIGIN_NOT_ALLOWED', message: 'Origem não permitida' })
    }
  }
  private assertCsrf(request: Request, sessionId: string) {
    const cookieToken = this.cookie(request, this.csrfCookieName())
    const header = request.headers['x-csrf-token']
    if (typeof header !== 'string' || header !== cookieToken || !this.csrf.verify(header, sessionId)) {
      throw new ForbiddenException({ code: 'CSRF_INVALID', message: 'Token CSRF inválido' })
    }
  }
  private cookie(request: Request, name: string) {
    const value = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
    if (!value) throw new InvalidRefreshTokenError()
    try { return decodeURIComponent(value) } catch { throw new InvalidRefreshTokenError() }
  }
  private setSessionCookies(response: Response, session: { sessionId: string; refreshToken: string; refreshExpiresAt: Date }) {
    response.cookie(this.refreshCookieName(), session.refreshToken, { ...this.cookieOptions(), httpOnly: true, expires: session.refreshExpiresAt })
    response.cookie(this.csrfCookieName(), this.csrf.issue(session.sessionId), { ...this.cookieOptions(), httpOnly: false, expires: session.refreshExpiresAt })
  }
  private clearSessionCookies(response: Response) {
    response.clearCookie(this.refreshCookieName(), this.cookieOptions())
    response.clearCookie(this.csrfCookieName(), this.cookieOptions())
  }
  private cookieOptions() { return { secure: this.isProduction(), sameSite: 'lax' as const, path: '/' } }
  private isProduction() { return this.config.get('NODE_ENV', { infer: true }) === 'production' }
  private refreshCookieName() { return this.isProduction() ? PRODUCTION_REFRESH_COOKIE : 'dp_refresh' }
  private csrfCookieName() { return this.isProduction() ? PRODUCTION_CSRF_COOKIE : 'dp_csrf' }
  private accessResponse(session: { accessToken: string; accessExpiresAt: Date }) {
    return { accessToken: session.accessToken, tokenType: 'Bearer', expiresAt: session.accessExpiresAt.toISOString() }
  }
  private unauthorized(code: string, message: string) { return new UnauthorizedException({ code, message }) }
}
