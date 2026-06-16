import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Re-authentication payload. An already-logged-in user re-confirms a live
 * factor before entering a sensitive area (service admin). `credential` is
 * either a password (2FA off, email account) or a TOTP/backup code (2FA on) —
 * the server decides which by account state (see AuthService.verifyReauth), so
 * the client never dictates the verification method. The 200-char cap covers
 * both a password and a 6-digit / backup code.
 */
export class ReauthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  credential: string;
}
