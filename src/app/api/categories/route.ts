import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Category } from '@/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();
    const categories = await Category.find({ active: true })
      .sort({ order: 1, name: 1 })
      .lean();

    return NextResponse.json({ ok: true, data: categories });
  } catch (error) {
    console.error('Error al listar categorías públicas:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar categorías' },
      { status: 500 }
    );
  }
}
