import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';
import User, { IUserDocument } from '@/models/User';

export * from '@/lib/jwt';

export async function verifyUserCredentials(
  username: string,
  password?: string
): Promise<IUserDocument | null> {
  if (!username || !password) return null;
  await connectToDatabase();

  const user = await User.findOne({
    username: username.toLowerCase().trim(),
    active: true,
  });

  if (!user) return null;

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return null;

  return user;
}

export async function verifyAdminCredentials(
  username: string,
  password?: string
): Promise<boolean> {
  const user = await verifyUserCredentials(username, password);
  return Boolean(user && (user.role === 'superadmin' || user.role === 'admin'));
}
