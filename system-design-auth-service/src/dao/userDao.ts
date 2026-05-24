import User from '../models/user.js';

export async function findUserByEmail(email: string): Promise<User | null> {
  return await User.findOne({ where: { email } });
}

export async function findUserById(id: number): Promise<User | null> {
  return await User.findByPk(id, { attributes: ['id', 'name', 'email'] });
}

export async function createUser(name: string, email: string, passwordHash: string): Promise<User> {
  return await User.create({ name, email, password_hash: passwordHash });
}

export async function updateUserById(
  id: number,
  updates: Partial<{ name: string; email: string; password_hash: string; avatar: string | null }>
): Promise<User | null> {
  const user = await User.findByPk(id);
  if (!user) return null;
  if (updates.name !== undefined) user.name = updates.name as string;
  if (updates.email !== undefined) user.email = updates.email as string;
  if (updates.password_hash !== undefined) user.password_hash = updates.password_hash as string;
  if (updates.avatar !== undefined) user.avatar = updates.avatar as string | null;
  await user.save();
  return user;
}
