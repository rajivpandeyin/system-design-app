export const refreshTokenTtlSeconds = 7 * 24 * 3600; // 7 days

export interface RefreshTokenRecord {
  token: string;
  userId: number;
  expiresAt: Date;
}
