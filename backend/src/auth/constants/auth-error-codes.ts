/**
 * Discriminated error codes for auth flow responses (V112 fix #3).
 *
 * Backend throws HttpException with `{ code, message }` body so the frontend
 * can branch on a stable machine-readable field instead of parsing i18n strings.
 */
export const AUTH_ERROR_CODES = {
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  REFRESH_REVOKED: 'REFRESH_REVOKED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  INVALID_TWO_FACTOR: 'INVALID_TWO_FACTOR',
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

/**
 * JWT scope field for tokens issued during email verification flow.
 * A token with this scope is only accepted by PendingVerificationGuard
 * (send-verification-code, verify-email-code). All other authenticated
 * endpoints reject it via JwtStrategy / EmailVerifiedGuard.
 */
export const JWT_SCOPE_PENDING_VERIFICATION = 'pending_verification';
