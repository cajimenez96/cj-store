import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@/lib/permissions';

const SECRET_KEY = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'dev_secret_cj_store_2026_change_in_prod'
);

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

export interface SessionTokenPayload {
  role: Role;
  id?: string;
  user: string;
  name?: string;
}

/** Verifies the JWT for any known role (edge-safe; does not check the DB). */
export async function verifySessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    const role = payload.role;
    if (role !== 'superadmin' && role !== 'admin' && role !== 'seller') return null;
    return {
      role,
      id: typeof payload.id === 'string' ? payload.id : undefined,
      user: typeof payload.user === 'string' ? payload.user : '',
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}
