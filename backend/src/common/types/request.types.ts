import type { Request } from 'express';

/**
 * Shape of req.user after JwtStrategy.validate() runs.
 */
export interface JwtUser {
  userId: string;
  email: string;
  isEmailVerified: boolean;
}

/**
 * Express Request augmented with Passport-injected user.
 */
export interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

/**
 * Extract a human-readable error message from an unknown catch value.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
