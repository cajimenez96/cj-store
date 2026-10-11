import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { decodeToken } from '@/lib/auth';

async function getRequester(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  if (!token) return null;
  return await decodeToken(token);
}

// GET /api/admin/users - List users
export async function GET(req: NextRequest) {
  try {
    const requester = await getRequester(req);
    if (!requester || (requester.role !== 'superadmin' && requester.role !== 'admin')) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    await connectToDatabase();
    const users = await User.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ ok: true, data: users });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', message: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create new user
export async function POST(req: NextRequest) {
  try {
    const requester = await getRequester(req);
    if (!requester || (requester.role !== 'superadmin' && requester.role !== 'admin')) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const { username, password, name, email, role, active } = await req.json();

    if (!username || !password || !name) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Usuario, contraseña y nombre son obligatorios' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El usuario debe tener al menos 3 caracteres' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    const assignedRole = role || 'admin';
    if (!['superadmin', 'admin', 'seller'].includes(assignedRole)) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Rol inválido' },
        { status: 400 }
      );
    }

    // Only a superadmin can create another superadmin
    if (assignedRole === 'superadmin' && requester.role !== 'superadmin') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: 'Solo un Superadmin puede asignar el rol Superadmin' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return NextResponse.json(
        { ok: false, error: 'CONFLICT', message: 'El nombre de usuario ya está registrado' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: cleanUsername,
      passwordHash,
      name: name.trim(),
      email: email?.trim().toLowerCase() || undefined,
      role: assignedRole,
      active: active !== undefined ? Boolean(active) : true,
    });

    const userObj = newUser.toObject();
    delete (userObj as { passwordHash?: string }).passwordHash;

    return NextResponse.json(
      { ok: true, message: 'Usuario creado exitosamente', data: userObj },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', message: 'Error al crear el usuario' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/users - Update user
export async function PUT(req: NextRequest) {
  try {
    const requester = await getRequester(req);
    if (!requester || (requester.role !== 'superadmin' && requester.role !== 'admin')) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, email, role, active, password } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(id);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Only superadmin can edit another superadmin or change roles
    if (user.role === 'superadmin' && requester.role !== 'superadmin') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: 'No tienes permisos para modificar a un Superadmin' },
        { status: 403 }
      );
    }

    // Safety check: protect the last active superadmin
    if (user.role === 'superadmin' && (active === false || (role && role !== 'superadmin'))) {
      const activeSuperadmins = await User.countDocuments({
        role: 'superadmin',
        active: true,
        _id: { $ne: user._id },
      });
      if (activeSuperadmins === 0) {
        return NextResponse.json(
          { ok: false, error: 'BAD_REQUEST', message: 'No puedes desactivar ni degradar al único Superadmin activo del sistema' },
          { status: 400 }
        );
      }
    }

    if (name) user.name = name.trim();
    if (email !== undefined) user.email = email ? email.trim().toLowerCase() : '';
    if (active !== undefined) user.active = Boolean(active);

    if (role && ['superadmin', 'admin', 'seller'].includes(role)) {
      if (role === 'superadmin' && requester.role !== 'superadmin') {
        return NextResponse.json(
          { ok: false, error: 'FORBIDDEN', message: 'Solo un Superadmin puede asignar dicho rol' },
          { status: 403 }
        );
      }
      user.role = role;
    }

    if (password && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return NextResponse.json(
          { ok: false, error: 'BAD_REQUEST', message: 'La contraseña debe tener al menos 6 caracteres' },
          { status: 400 }
        );
      }
      user.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    await user.save();

    const userObj = user.toObject();
    delete (userObj as { passwordHash?: string }).passwordHash;

    return NextResponse.json({
      ok: true,
      message: 'Usuario actualizado exitosamente',
      data: userObj,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', message: 'Error al actualizar el usuario' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users - Delete user
export async function DELETE(req: NextRequest) {
  try {
    const requester = await getRequester(req);
    if (!requester || requester.role !== 'superadmin') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: 'Solo un Superadmin puede eliminar usuarios definitivamente' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    if (requester.id === id) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'No puedes eliminar tu propio usuario en sesión' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(id);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (user.role === 'superadmin') {
      const otherSuperadmins = await User.countDocuments({
        role: 'superadmin',
        _id: { $ne: user._id },
      });
      if (otherSuperadmins === 0) {
        return NextResponse.json(
          { ok: false, error: 'BAD_REQUEST', message: 'No puedes eliminar al único Superadmin' },
          { status: 400 }
        );
      }
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({
      ok: true,
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', message: 'Error al eliminar el usuario' },
      { status: 500 }
    );
  }
}
