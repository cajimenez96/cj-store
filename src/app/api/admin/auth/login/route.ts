import { NextRequest, NextResponse } from 'next/server';
import { verifyUserCredentials, signAdminToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: 'BAD_REQUEST',
          message: 'Debe proporcionar usuario y contraseña',
        },
        { status: 400 }
      );
    }

    const user = await verifyUserCredentials(username, password);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHORIZED',
          message: 'Credenciales inválidas o usuario inactivo',
        },
        { status: 401 }
      );
    }

    const token = await signAdminToken({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      name: user.name,
    });

    const response = NextResponse.json({
      ok: true,
      message: 'Autenticado exitosamente',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });

    // Set secure HTTP-only cookie
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error en login de administrador:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error al procesar el inicio de sesión',
      },
      { status: 500 }
    );
  }
}
