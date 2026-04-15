import { IsBoolean, Equals } from 'class-validator';
import { RegisterDto } from './register.dto';

/**
 * V115 (V114-8, Gate 10 CRITICAL-2 fix): dedicated DTO for the
 * destructive register-force path.
 *
 * The global ValidationPipe runs with `whitelist: true, forbidNonWhitelisted:
 * true`, which strips + rejects any field lacking a class-validator decorator.
 * The previous inline `RegisterDto & { confirmReset?: boolean }` did not
 * declare `confirmReset` as a DTO property at all, so every request was
 * returning `400 property confirmReset should not exist` — the hard-reset
 * path was dead on arrival.
 *
 * We extend RegisterDto so email/password/name validators still apply,
 * and add a required `@Equals(true)` check on `confirmReset` so the pipe
 * itself enforces the "explicit opt-in" contract — no need for a controller-
 * level runtime check anymore.
 */
export class RegisterForceDto extends RegisterDto {
  @IsBoolean()
  @Equals(true, { message: 'confirmReset must be explicitly true' })
  confirmReset: boolean;
}
