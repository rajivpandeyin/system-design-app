import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const accessSecret = process.env.JWT_ACCESS_SECRET || 'access-secret';
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret';

export function signAccessToken(payload: object, expiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m') {
  const secret: Secret = accessSecret;
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, secret, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, accessSecret as Secret) as any;
}

export function signRefreshToken(payload: object, expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') {
  const secret: Secret = refreshSecret;
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, secret, options);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, refreshSecret as Secret) as any;
}
