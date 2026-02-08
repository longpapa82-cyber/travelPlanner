export interface AuthResponse {
  user: {
    id: string;
    email: string | null;
    name: string;
    provider: string;
    profileImage?: string | null;
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
