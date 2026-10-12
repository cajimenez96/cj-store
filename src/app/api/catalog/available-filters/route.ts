import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Product from '@/models/Product';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const typeId = searchParams.get('typeId');
    const gender = searchParams.get('gender');
    const size = searchParams.get('size');

    const query: Record<string, any> = { active: true };

    if (brandId) {
      const brands = brandId.split(',').filter(Boolean);
      if (brands.length > 0) {
        query.brandId = { $in: brands };
      }
    }

    if (typeId) {
      const types = typeId.split(',').filter(Boolean);
      if (types.length > 0) {
        query.typeId = { $in: types };
      }
    }

    if (gender) {
      query.gender = gender;
    }

    const products = await Product.find(query)
      .select('gender sizesStock displayedSizes')
      .lean();

    const availableSizes = new Set<number>();
    const availableGenders = new Set<string>();

    products.forEach((prod: any) => {
      if (prod.gender && typeof prod.gender === "string" && prod.gender.trim()) {
        availableGenders.add(prod.gender.trim());
      }

      const sizesStock = (prod.sizesStock as { size: number; stock: number }[]) || [];
      const displayedSizes = (prod.displayedSizes as number[]) || [];

      sizesStock.forEach((s) => {
        if (s.stock > 0) {
          if (displayedSizes.length === 0 || displayedSizes.includes(s.size)) {
            availableSizes.add(s.size);
          }
        }
      });
    });

    const sizes = Array.from(availableSizes).sort((a, b) => a - b);
    const genders = Array.from(availableGenders).sort();

    return NextResponse.json({
      ok: true,
      data: {
        sizes,
        genders,
      },
    });
  } catch (err) {
    console.error('Error fetching available filters:', err);
    return NextResponse.json(
      { ok: false, message: 'Error al obtener filtros disponibles' },
      { status: 500 }
    );
  }
}
