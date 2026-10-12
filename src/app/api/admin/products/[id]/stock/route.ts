import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Product } from '@/models';
import { calculateDerivedProductFields } from '@/lib/derived';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Body can be an array [{ variantId, stock }] or { items: [...] } or single { variantId, stock }
    const adjustments: { variantId?: string; sku?: string; stock: number }[] = Array.isArray(body)
      ? body
      : Array.isArray(body.items)
      ? body.items
      : [body];

    if (product.variants && product.variants.length > 0) {
      for (const adj of adjustments) {
        const stockNum = Math.max(0, Number(adj.stock) || 0);

        const variant = product.variants.find(
          (v) =>
            (adj.variantId && v._id?.toString() === adj.variantId) ||
            (adj.sku && v.sku === adj.sku)
        );

        if (variant) {
          variant.stock = stockNum;
        }
      }

      const derived = calculateDerivedProductFields(
        product.variants,
        product.wholesale?.enabled ?? false
      );
      product.priceRange = derived.priceRange;
      product.totalStock = derived.totalStock;
      product.hasWholesale = derived.hasWholesale;
    } else if (body.stock !== undefined) {
      // Legacy simple product stock
      product.stock = Math.max(0, Number(body.stock) || 0);
      product.totalStock = product.stock;
    }

    await product.save();

    return NextResponse.json({
      ok: true,
      data: product,
      message: 'Stock actualizado correctamente',
    });
  } catch (error) {
    console.error('Error al actualizar stock de variantes:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al actualizar stock' },
      { status: 500 }
    );
  }
}
