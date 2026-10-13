import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Product, Brand, Category } from '@/models';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
