import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/jwt';
import { canAccess, deniedPageRedirect } from '@/lib/permissions';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Bypass public admin auth endpoints
  if (
    pathname === '/admin/login' ||
    pathname === '/api/admin/auth/login' ||
    pathname === '/api/admin/auth/logout'
  ) {
    return NextResponse.next();
  }

  // 2. Protect Admin API Routes (/api/admin/*)
  if (pathname.startsWith('/api/admin')) {
    const token = req.cookies.get('admin_token')?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHORIZED',
          message: 'Acceso no autorizado al API de administración',
        },
        { status: 401 }
      );
    }
    if (!canAccess(session.role, req.method, pathname)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'FORBIDDEN',
          message: 'No tienes permisos para realizar esta acción',
        },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // 3. Protect Admin Web Pages (/admin/*)
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('admin_token')?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!canAccess(session.role, req.method, pathname)) {
      return NextResponse.redirect(
        new URL(deniedPageRedirect(session.role, pathname), req.url)
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
