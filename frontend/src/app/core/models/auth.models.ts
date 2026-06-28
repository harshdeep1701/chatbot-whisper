// ── Auth Models ──────────────────────────────────────────
// Request / response shapes for /api/auth/login and /api/auth/register

export type UserRole = 'USER' | 'ADMIN';

/** POST /api/auth/login request body (username accepts username or email, case-insensitive) */
export interface LoginRequest {
  username: string;
  password: string;
}

/** POST /api/auth/register request body */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

/** Response from both /api/auth/login and /api/auth/register */
export interface AuthResponse {
  token: string;
  username: string;
  userId: number;
  success: boolean;
  error?: string;
}

/** User info held in memory after successful login */
export interface UserInfo {
  username: string;
  userId: number;
  token: string;
  role: UserRole;
}

/** Decoded JWT payload (claims extracted client-side) */
export interface JwtPayload {
  sub: string;       // username
  userId: number;
  role: UserRole;
  iat: number;       // issued-at (epoch seconds)
  exp: number;       // expiration (epoch seconds)
  [key: string]: unknown;
}
