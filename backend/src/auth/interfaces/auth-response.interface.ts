export interface AuthResponse {
  user: {
    id: string;
    email: string | null;
    name: string;
    provider: string;
    profileImage?: string | null;
    isEmailVerified?: boolean;
    subscriptionTier?: string;
    subscriptionPlatform?: string | null;
    subscriptionExpiresAt?: Date | string | null;
    subscriptionStartedAt?: Date | string | null;
    subscriptionPlanType?: 'monthly' | 'yearly' | null;
    aiTripsUsedThisMonth?: number;
  };
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
