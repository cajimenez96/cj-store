import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Product, Brand, FootwearType, Category } from '@/models';
import { calculateDerivedProductFields } from '@/lib/derived';

export const dynamic = 'force-dynamic';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);

    const brandId = searchParams.get('brandId');
    const categoryId = searchParams.get('categoryId');
    const typeId = searchParams.get('typeId');
    const gender = searchParams.get('gender');
    const active = searchParams.get('active');
    const isClearance = searchParams.get('isClearance') || searchParams.get('clearance');
    const search = searchParams.get('search');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const hasPagination = Boolean(limitParam !== null && parseInt(limitParam, 10) > 0);
    const limit = hasPagination ? parseInt(limitParam!, 10) : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (brandId) query.brandId = brandId;
    if (categoryId) query.categoryId = categoryId;
    if (typeId) query.typeId = typeId;
    if (gender) query.gender = gender;
    if (active !== null && active !== undefined && active !== '') {
      query.active = active === 'true';
    }
    if (isClearance !== null && isClearance !== undefined && isClearance !== '') {
      query.isClearance = isClearance === 'true';
    }
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Ensure models are registered
    Brand;
    FootwearType;
    Category;

    const total = await Product.countDocuments(query);
    let productQuery = Product.find(query)
      .populate('brandId', 'name')
      .populate('typeId', 'name')
      .populate('categoryId', 'name slug variantAxes')
      .sort({ createdAt: -1, _id: -1 });

    if (hasPagination) {
      const skip = (page - 1) * limit;
      productQuery = productQuery.skip(skip).limit(limit);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products: any[] = await productQuery.lean();

    // Format total stock and display metrics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedProducts = products.map((prod: any) => {
      let totalStock = prod.totalStock ?? 0;
      if (Array.isArray(prod.variants) && prod.variants.length > 0) {
        totalStock = prod.variants.reduce(
          (acc: number, curr: { stock: number }) => acc + (Number(curr.stock) || 0),
          0
        );
      } else if (typeof prod.stock === 'number') {
        totalStock = prod.stock;
      } else if (Array.isArray(prod.sizesStock) && prod.sizesStock.length > 0) {
        totalStock = prod.sizesStock.reduce(
          (acc: number, curr: { stock: number }) => acc + (Number(curr.stock) || 0),
          0
        );
      }

      return {
        ...prod,
        totalStock,
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
    console.error('Error al obtener productos en admin:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al obtener productos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const {
      name,
      slug: userSlug,
      description,
      retailPrice,
      wholesalePrice,
      brandId,
      categoryId,
      typeId,
      gender,
      active,
      isClearance,
      images,
      variants,
      specs,
      wholesale,
      stock,
      sizesStock,
      displayedSizes,
    } = body;

    // Validations
    if (!name || !name.trim()) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El nombre del producto es obligatorio' },
        { status: 400 }
      );
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Debe incluir al menos una imagen' },
        { status: 400 }
      );
    }

    // Slug generation
    const cleanName = name.trim();
    let productSlug = userSlug ? slugify(userSlug) : slugify(cleanName);
    const existingSlug = await Product.findOne({ slug: productSlug });
    if (existingSlug) {
      productSlug = `${productSlug}-${Date.now().toString().slice(-4)}`;
    }

    // Resolve Category and CategoryAncestors
    let finalCategoryId = categoryId || null;
    let categoryAncestors: any[] = [];

    if (finalCategoryId) {
      const cat = await Category.findById(finalCategoryId);
      if (cat) {
        categoryAncestors = cat.ancestors || [];
      }
    }

    // Prepare variants
    const hasVariants = Array.isArray(variants) && variants.length > 0;
    const hasSizes = Array.isArray(sizesStock) && sizesStock.length > 0;
    const hasDirectStock = stock !== undefined && stock !== null;

    let processedVariants: any[] = [];
    if (hasVariants) {
      processedVariants = variants.map((v: any, idx: number) => ({
        sku: v.sku || `${productSlug.toUpperCase()}-${idx + 1}`,
        options: Array.isArray(v.options) ? v.options : [],
        retailPrice: Number(v.retailPrice) || Number(retailPrice) || 0,
        wholesalePrice: v.wholesalePrice !== undefined && v.wholesalePrice !== null ? Number(v.wholesalePrice) : undefined,
        stock: Math.max(0, Number(v.stock) || 0),
        active: v.active !== undefined ? Boolean(v.active) : true,
      }));
    } else if (hasSizes) {
      processedVariants = sizesStock.map((s: any) => ({
        sku: `${productSlug.toUpperCase()}-T${String(s.size).replace('.', '_')}`,
        options: [{ key: 'talle_calzado', value: String(s.size) }],
        retailPrice: Number(retailPrice) || 0,
        wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
        stock: Math.max(0, Number(s.stock) || 0),
        active: true,
      }));
    } else {
      // Single default variant
      processedVariants = [
        {
          sku: `${productSlug.toUpperCase()}-01`,
          options: [],
          retailPrice: Number(retailPrice) || 0,
          wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
          stock: hasDirectStock ? Math.max(0, Number(stock)) : 0,
          active: true,
        },
      ];
    }

    // Calculate derived fields
    const isWholesaleEnabled = Boolean(wholesale?.enabled);
    const derived = calculateDerivedProductFields(processedVariants, isWholesaleEnabled);

    const newProduct = await Product.create({
      name: cleanName,
      slug: productSlug,
      description: description ? description.trim() : '',
      brandId: brandId || undefined,
      categoryId: finalCategoryId || undefined,
      categoryAncestors,
      typeId: typeId || undefined,
      gender: gender ? gender : null,
      active: active !== undefined ? Boolean(active) : true,
      isClearance: isClearance !== undefined ? Boolean(isClearance) : false,
      images,
      specs: Array.isArray(specs) ? specs : [],
      wholesale: {
        enabled: isWholesaleEnabled,
        minQty: Number(wholesale?.minQty) || 5,
      },
      variants: processedVariants,
      priceRange: derived.priceRange,
      totalStock: derived.totalStock,
      hasWholesale: derived.hasWholesale,

      // Legacy fields
      retailPrice: Number(retailPrice) || derived.priceRange.min,
      wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
      stock: hasDirectStock ? Number(stock) : derived.totalStock,
      sizesStock: hasSizes ? sizesStock : [],
      displayedSizes: displayedSizes || [],
    });

    return NextResponse.json({ ok: true, data: newProduct }, { status: 201 });
  } catch (error) {
    console.error('Error al crear producto:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al crear el producto' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const productId = body._id || body.id;

    if (!productId) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El ID del producto es obligatorio' },
        { status: 400 }
      );
    }

    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const {
      name,
      slug,
      description,
      retailPrice,
      wholesalePrice,
      active,
      isClearance,
      images,
      variants,
      specs,
      wholesale,
      stock,
      sizesStock,
      brandId,
      categoryId,
      typeId,
      gender,
      displayedSizes,
    } = body;

    if (name !== undefined) product.name = name.trim();
    if (description !== undefined) product.description = description.trim();
    if (slug !== undefined && slug.trim()) product.slug = slugify(slug);
    if (brandId !== undefined) product.brandId = brandId || undefined;
    if (typeId !== undefined) product.typeId = typeId || undefined;
    if (gender !== undefined) product.gender = gender ? gender : null;
    if (active !== undefined) product.active = Boolean(active);
    if (isClearance !== undefined) product.isClearance = Boolean(isClearance);
    if (images !== undefined) product.images = images;
    if (specs !== undefined) product.specs = specs;
    if (displayedSizes !== undefined) product.displayedSizes = displayedSizes;

    // Category update
    if (categoryId !== undefined) {
      product.categoryId = categoryId || undefined;
      if (categoryId) {
        const cat = await Category.findById(categoryId);
        product.categoryAncestors = cat?.ancestors || [];
      } else {
        product.categoryAncestors = [];
      }
    }

    // Wholesale update
    if (wholesale !== undefined) {
      product.wholesale = {
        enabled: Boolean(wholesale.enabled),
        minQty: Number(wholesale.minQty) || 5,
      };
    }

    // Variants update
    if (variants !== undefined && Array.isArray(variants)) {
      product.variants = variants.map((v: any, idx: number) => ({
        sku: v.sku || `${(product.slug || 'PROD').toUpperCase()}-${idx + 1}`,
        options: Array.isArray(v.options) ? v.options : [],
        retailPrice: Number(v.retailPrice) || 0,
        wholesalePrice: v.wholesalePrice !== undefined && v.wholesalePrice !== null ? Number(v.wholesalePrice) : undefined,
        stock: Math.max(0, Number(v.stock) || 0),
        active: v.active !== undefined ? Boolean(v.active) : true,
      }));

      const derived = calculateDerivedProductFields(
        product.variants,
        product.wholesale?.enabled ?? false
      );
      product.priceRange = derived.priceRange;
      product.totalStock = derived.totalStock;
      product.hasWholesale = derived.hasWholesale;
    }

    // Legacy fields
    if (retailPrice !== undefined) product.retailPrice = Number(retailPrice);
    if (wholesalePrice !== undefined) product.wholesalePrice = wholesalePrice ? Number(wholesalePrice) : undefined;
    if (stock !== undefined) product.stock = Number(stock);
    if (sizesStock !== undefined) product.sizesStock = sizesStock;

    await product.save();

    return NextResponse.json({ ok: true, data: product });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al actualizar el producto' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El ID del producto es obligatorio' },
        { status: 400 }
      );
    }

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    if (permanent) {
      const orderCount = await (await import('@/models/Order')).default.countDocuments({
        'items.productId': id,
      });

      if (orderCount > 0) {
        await Product.findByIdAndUpdate(id, { active: false });
        return NextResponse.json({
          ok: true,
          mode: 'deactivated',
          message: `El producto tiene ${orderCount} venta(s)/pedido(s) registrado(s). Se desactivó del catálogo para preservar el historial.`,
        });
      }

      await Product.findByIdAndDelete(id);
      return NextResponse.json({
        ok: true,
        mode: 'deleted',
        message: 'Producto eliminado permanentemente de la base de datos.',
      });
    }

    const updated = await Product.findByIdAndUpdate(id, { active: false }, { returnDocument: 'after' });

    return NextResponse.json({
      ok: true,
      mode: 'deactivated',
      message: 'Producto desactivado del catálogo.',
      data: updated,
    });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al procesar la eliminación del producto' },
      { status: 500 }
    );
  }
}
