import { NextRequest, NextResponse } from 'next/server';
import { getSession, sessionError } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return sessionError(401);

  return NextResponse.json({
    ok: true,
    user: {
      id: session.id,
      username: session.username,
      name: session.name,
      role: session.role,
    },
  });
}
