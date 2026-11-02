import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { verifySessionToken } from '@/lib/jwt';
import type { Role } from '@/lib/permissions';
import User from '@/models/User';

export interface Session {
  id: string;
  username: string;
  name: string;
  role: Role;
}

/** Verifies the JWT, then re-validates against the DB (active flag and current role). */
export async function getSession(req: NextRequest): Promise<Session | null> {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload?.id || !mongoose.isValidObjectId(payload.id)) return null;

  await connectToDatabase();
  const user = await User.findById(payload.id).lean();
  if (!user || !user.active) return null;

  return {
    id: String(user._id),
    username: user.username,
    name: user.name,
    role: user.role,
  };
}

const MESSAGES = {
  401: { error: 'UNAUTHORIZED', message: 'Acceso no autorizado al API de administración' },
  403: { error: 'FORBIDDEN', message: 'No tienes permisos para realizar esta acción' },
  404: { error: 'NOT_FOUND', message: 'Recurso no encontrado' },
} as const;

export function sessionError(status: 401 | 403 | 404): NextResponse {
  return NextResponse.json({ ok: false, ...MESSAGES[status] }, { status });
}
