export abstract class PasswordRecoveryDelivery {
  abstract send(email: string, token: string): Promise<void>
}
