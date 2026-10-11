import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';
import User, { IUserDocument } from '@/models/User';

const SECRET_KEY = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'dev_secret_cj_store_2026_change_in_prod'
);

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

export async function signAdminToken(user?: {
  id?: string;
  username?: string;
  role?: string;
  name?: string;
}): Promise<string> {
  const payload = {
    role: user?.role || 'admin',
    user: user?.username || 'admin',
    id: user?.id,
    name: user?.name,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return Boolean(
      payload &&
        (payload.role === 'superadmin' || payload.role === 'admin')
    );
  } catch {
    return false;
  }
}

export async function decodeToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch {
    return null;
  }
}
