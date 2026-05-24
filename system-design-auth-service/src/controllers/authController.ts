import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { findUserByEmail, findUserById, createUser, updateUserById } from '../dao/userDao.js';
import { storeRefreshToken, lookupRefreshToken, deleteRefreshToken } from '../dao/refreshTokenDao.js';
import { signAccessToken } from '../utils/jwt.js';
import { uploadDataUrlToS3 } from '../utils/s3.js';

const signupSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);

export async function signup(req: Request, res: Response) {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const { name, email, password } = parsed.data;
  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, saltRounds);
    const user = await createUser(name, email, passwordHash);
    const token = signAccessToken({ sub: user.id, email: user.email, name: user.name });
    const refreshToken = uuidv4();
    await storeRefreshToken(refreshToken, user.id);

    return res.json({ token, refreshToken, user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const { email, password } = parsed.data;
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const authenticated = await bcrypt.compare(password, user.password_hash ?? '');
    if (!authenticated) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signAccessToken({ sub: user.id, email: user.email, name: user.name });
    const refreshToken = uuidv4();
    await storeRefreshToken(refreshToken, user.id);

    return res.json({ token, refreshToken, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });

  try {
    const userId = await lookupRefreshToken(refreshToken);
    if (!userId) return res.status(401).json({ error: 'Invalid refresh token' });

    await deleteRefreshToken(refreshToken);
    const newRefreshToken = uuidv4();
    await storeRefreshToken(newRefreshToken, userId);

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = signAccessToken({ sub: user.id, email: user.email, name: user.name });
    return res.json({ token, refreshToken: newRefreshToken });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getProfile(req: Request, res: Response) {
  // Auth middleware attaches user id to req.user
  const authReq = req as any;
  const userId = authReq.user?.id as number | undefined;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: (user as any).avatar ?? null } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function updateProfile(req: Request, res: Response) {
  const authReq = req as any;
  const userId = authReq.user?.id as number | undefined;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const schema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    avatar: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  try {
    const updates = parsed.data as { name?: string; email?: string; avatar?: string | null };
    // If email provided, ensure not taken
    if (updates.email) {
      const existing = await findUserByEmail(updates.email);
      if (existing && existing.id !== userId) return res.status(409).json({ error: 'Email already in use' });
    }

    // If avatar is provided as a data URL, upload to S3 and replace with URL
    if (updates.avatar && updates.avatar.startsWith('data:')) {
      try {
        const uploaded = await uploadDataUrlToS3(updates.avatar);
        updates.avatar = uploaded;
      } catch (err) {
        console.error('Failed to upload avatar to S3', err);
        return res.status(500).json({ error: 'Avatar upload failed' });
      }
    }

    const updated = await updateUserById(userId, updates as any);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: { id: updated.id, name: updated.name, email: updated.email, avatar: (updated as any).avatar ?? null } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });

  try {
    await deleteRefreshToken(refreshToken);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}
