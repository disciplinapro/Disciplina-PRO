export abstract class PasswordRecoveryRepository {
  abstract issue(input: { email: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<{ email: string } | null>
  abstract clear(tokenHash: string): Promise<void>
  abstract consume(input: { tokenHash: string; passwordHash: string; now: Date }): Promise<boolean>
}
