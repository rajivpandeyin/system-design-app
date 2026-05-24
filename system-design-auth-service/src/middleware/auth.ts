import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; name?: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub as number, email: payload.email, name: payload.name };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
