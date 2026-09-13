import { Transform } from 'class-transformer'
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class RequestPasswordRecoveryDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().normalize('NFC').toLowerCase() : value)
  @IsEmail()
  @MaxLength(320)
  email!: string
}

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string

  @IsString()
  @MinLength(15)
  @MaxLength(128)
  password!: string
}
