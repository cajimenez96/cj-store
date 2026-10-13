import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Product from '@/models/Product';
import Brand from '@/models/Brand';
import Category from '@/models/Category';
import Settings from '@/models/Settings';
import { calculateDerivedProductFields } from '@/lib/derived';
import { GENDER_ATTRIBUTE_KEY } from '@/lib/genderFilter';
import { buildStockEntries, sumActiveStock } from '@/lib/stock';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const lowStockOnly = searchParams.get('lowStock') === 'true';

    // Retrieve configured minimum stock alert threshold
    const settings = await Settings.findOne({}).lean();
    const minStockAlert = settings?.minStockAlert !== undefined ? settings.minStockAlert : 3;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Ensure models are registered for populate
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    Brand;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    Category;

    const products = await Product.find(query)
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
      .sort({ name: 1 })
      .lean();

    let totalUnitsInStock = 0;
    let outOfStockProductsCount = 0;
    let lowStockProductsCount = 0;

    // Totals come from the live variants, not from the stored derived `totalStock`,
    // which order flows do not recalculate after decrementing a variant.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stockItems = products.map((prod: any) => {
      const entries = buildStockEntries(prod);
      const totalStock = sumActiveStock(entries);

      totalUnitsInStock += totalStock;
      if (totalStock === 0) {
        outOfStockProductsCount++;
      } else if (totalStock <= minStockAlert) {
        lowStockProductsCount++;
      }

      const genderSpec = Array.isArray(prod.specs)
        ? prod.specs.find((s: { key: string }) => s.key === GENDER_ATTRIBUTE_KEY)?.value
        : undefined;

      return {
        _id: prod._id,
        name: prod.name,
        brandName: typeof prod.brandId === 'object' && prod.brandId ? prod.brandId.name : '-',
        categoryName:
          typeof prod.categoryId === 'object' && prod.categoryId ? prod.categoryId.name : '-',
        gender: typeof genderSpec === 'string' ? genderSpec : '',
        active: prod.active,
        image: prod.images?.[0]?.url || '',
        totalStock,
        entries,
        hasLowStock: totalStock <= minStockAlert,
      };
    });

    const filteredStockItems = lowStockOnly
      ? stockItems.filter((item) => item.hasLowStock)
      : stockItems;

    return NextResponse.json({
      ok: true,
      data: {
        totalUnitsInStock,
        totalProductsCount: products.length,
        outOfStockProductsCount,
        lowStockProductsCount,
        minStockAlert,
        items: filteredStockItems,
      },
    });
  } catch (error) {
    console.error('Error al obtener reporte de stock:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar reporte de stock' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();
    const { productId, variantId, newStock } = await req.json();

    const stockNum = Number(newStock);

    if (
      !productId ||
      !variantId ||
      newStock === undefined ||
      !Number.isFinite(stockNum) ||
      stockNum < 0
    ) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'productId, variante y stock válido son obligatorios' },
        { status: 400 }
      );
    }

    if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(variantId)) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Identificador de producto o variante inválido' },
        { status: 400 }
      );
    }

    // Atomic positional update, then refresh the stored derived total
    const updated = await Product.findOneAndUpdate(
      { _id: productId, 'variants._id': variantId },
      { $set: { 'variants.$.stock': Math.floor(stockNum) } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Producto o variante no encontrada' },
        { status: 404 }
      );
    }

    const derived = calculateDerivedProductFields(updated.variants ?? [], updated.wholesale?.enabled);
    await Product.updateOne({ _id: productId }, { $set: { totalStock: derived.totalStock } });

    return NextResponse.json({ ok: true, data: { productId, totalStock: derived.totalStock } });
  } catch (error) {
    console.error('Error al actualizar stock rápido:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al actualizar stock' },
      { status: 500 }
    );
  }
}
