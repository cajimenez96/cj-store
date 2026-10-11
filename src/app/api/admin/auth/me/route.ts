import { NextRequest, NextResponse } from 'next/server';
import { decodeToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const payload = await decodeToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'INVALID_TOKEN' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: payload.id,
      username: payload.user,
      name: payload.name,
      role: payload.role,
    },
  });
}
