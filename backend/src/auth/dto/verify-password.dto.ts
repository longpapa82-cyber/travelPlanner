import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Re-authentication payload. An already-logged-in user re-confirms their own
 * password before entering a sensitive area (service admin). The password is
 * verified server-side against the stored bcrypt hash — the client never sees
 * the hash. Mirrors LoginDto's password constraints (200-char cap) so the same
 * inputs that were accepted at login are accepted here.
 */
export class VerifyPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}
