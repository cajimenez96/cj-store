import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/jwt';

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
    const isValid = token ? await verifyAdminToken(token) : false;

    if (!isValid) {
      return NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHORIZED',
          message: 'Acceso no autorizado al API de administración',
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 3. Protect Admin Web Pages (/admin/*)
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('admin_token')?.value;
    const isValid = token ? await verifyAdminToken(token) : false;

    if (!isValid) {
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
