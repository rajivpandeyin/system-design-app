import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const redis = new Redis(redisUrl);
const tokenTtl = 7 * 24 * 3600; // 7 days

export async function storeRefreshToken(token: string, userId: number) {
  await redis.setex(`refresh:${token}`, tokenTtl, String(userId));
}

export async function lookupRefreshToken(token: string): Promise<number | null> {
  const userId = await redis.get(`refresh:${token}`);
  return userId ? Number(userId) : null;
}

export async function deleteRefreshToken(token: string) {
  await redis.del(`refresh:${token}`);
}
