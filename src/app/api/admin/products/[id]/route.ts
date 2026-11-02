import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Product, Brand, Category } from '@/models';
import { getSession, sessionError } from '@/lib/session';
import { isAdminRole } from '@/lib/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin-only: the full product document includes cost data sellers must not see.
    const session = await getSession(req);
    if (!session) return sessionError(401);
    if (!isAdminRole(session.role)) return sessionError(403);

    await connectToDatabase();
    const { id } = await params;

    // Ensure models registered
    Brand;
    Category;

    const product = await Product.findById(id)
      .populate('brandId', 'name')
      .populate('categoryId', 'name slug variantAxes imageAxis specAttributes ancestors')
      .lean();

    if (!product) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: product });
  } catch (error) {
    console.error('Error al consultar producto:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar producto' },
      { status: 500 }
    );
  }
}
