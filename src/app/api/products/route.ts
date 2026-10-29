import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Product from '@/models/Product';
import Brand from '@/models/Brand';
import Category from '@/models/Category';
import { calculateDerivedProductFields } from '@/lib/derived';
import { buildCategoryCondition } from '@/lib/categoryFilter';
import { buildGenderCondition } from '@/lib/genderFilter';
import { attachOptionDisplay } from '@/lib/attributeDisplay';

// Force dynamic server route
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const categoryId = searchParams.get('categoryId');
    const gender = searchParams.get('gender');
    const search = searchParams.get('search');
    const clearance = searchParams.get('clearance') || searchParams.get('isClearance');
    const wholesale = searchParams.get('wholesale');
    const sort = searchParams.get('sort');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const hasPagination = Boolean(limitParam !== null && parseInt(limitParam, 10) > 0);
    const limit = hasPagination ? parseInt(limitParam!, 10) : 0;

    // Build filter query for active products
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { active: true };

    if (clearance === 'true') {
      query.isClearance = true;
    }

    if (wholesale === 'true') {
      query['wholesale.enabled'] = true;
    }

    if (categoryId) {
      const categories = categoryId.split(',').filter(Boolean);
      if (categories.length > 0) {
        query.$and = [...(query.$and ?? []), buildCategoryCondition(categories)];
      }
    }

    if (brandId) {
      const brands = brandId.split(',').filter(Boolean);
      if (brands.length > 0) {
        query.brandId = { $in: brands };
      }
    }

    if (gender) {
      query.$and = [...(query.$and ?? []), await buildGenderCondition(gender)];
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Ensure models are registered for populate
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    Brand;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    Category;

    // _id as tiebreaker keeps skip/limit pagination stable across pages
    // when many products share the same sort value.
    const sortQuery: Record<string, 1 | -1> =
      sort === 'price_asc'
        ? { retailPrice: 1, _id: 1 }
        : sort === 'price_desc'
          ? { retailPrice: -1, _id: 1 }
          : { createdAt: -1, _id: 1 };

    const total = await Product.countDocuments(query);
    let productQuery = Product.find(query)
      .populate('brandId', 'name')
      .populate('categoryId', 'name slug variantAxes imageAxis')
      .sort(sortQuery);

    if (hasPagination) {
      const skip = (page - 1) * limit;
      productQuery = productQuery.skip(skip).limit(limit);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products: any[] = await productQuery.lean();
    await attachOptionDisplay(products);

    // Map products to include totalStock and isOutOfStock flags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedProducts = products.map((prod: any) => {
      let derived: { priceRange: { min: number; max: number }; totalStock: number; hasWholesale: boolean };

      if (Array.isArray(prod.variants) && prod.variants.length > 0) {
        derived = calculateDerivedProductFields(
          prod.variants,
          Boolean(prod.wholesale?.enabled)
        );
      } else {
        const fallbackRetail = Number(prod.retailPrice ?? prod.price ?? 0);
        const fallbackStock = typeof prod.stock === 'number' ? prod.stock : 0;
        const fallbackWholesale =
          Boolean(prod.wholesale?.enabled) &&
          prod.wholesalePrice != null &&
          prod.wholesalePrice < fallbackRetail;

        derived = {
          priceRange: { min: fallbackRetail, max: fallbackRetail },
          totalStock: fallbackStock,
          hasWholesale: fallbackWholesale,
        };
      }

      return {
        ...prod,
        priceRange: prod.priceRange || derived.priceRange,
        totalStock: derived.totalStock,
        hasWholesale: prod.hasWholesale ?? derived.hasWholesale,
        isOutOfStock: derived.totalStock === 0,
      };
    });

    return NextResponse.json({
      ok: true,
      data: formattedProducts,
      pagination: {
        page,
        limit: hasPagination ? limit : total,
        total,
        totalPages: hasPagination && limit > 0 ? Math.ceil(total / limit) : 1,
      },
    });
  } catch (error) {
    console.error('Error al consultar catálogo de productos:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error al consultar catálogo de productos',
      },
      { status: 500 }
    );
  }
}
