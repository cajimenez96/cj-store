import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Product from '@/models/Product';
import Brand from '@/models/Brand';
import FootwearType from '@/models/FootwearType';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);

    const brandId = searchParams.get('brandId');
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
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    Brand;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    FootwearType;

    const total = await Product.countDocuments(query);
    let productQuery = Product.find(query)
      .populate('brandId', 'name')
      .populate('typeId', 'name')
      .sort({ createdAt: -1, _id: -1 });

    if (hasPagination) {
      const skip = (page - 1) * limit;
      productQuery = productQuery.skip(skip).limit(limit);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const products: any[] = await productQuery.lean();

    // Format total stock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedProducts = products.map((prod: any) => {
      let totalStock = 0;
      if (Array.isArray(prod.variants) && prod.variants.length > 0) {
        totalStock = prod.variants.reduce(
          (acc: number, curr: { stock: number }) => acc + curr.stock,
          0
        );
      } else if (typeof prod.stock === 'number') {
        totalStock = prod.stock;
      } else if (Array.isArray(prod.sizesStock) && prod.sizesStock.length > 0) {
        totalStock = prod.sizesStock.reduce(
          (acc: number, curr: { stock: number }) => acc + curr.stock,
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
      description,
      retailPrice,
      wholesalePrice,
      brandId,
      typeId,
      gender,
      active,
      isClearance,
      images,
      variants,
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

    if (!description || !description.trim()) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'La descripción es obligatoria' },
        { status: 400 }
      );
    }

    if (retailPrice === undefined || retailPrice === null || Number(retailPrice) < 0) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El precio minorista debe ser un número mayor o igual a 0' },
        { status: 400 }
      );
    }

    if (wholesalePrice === undefined || wholesalePrice === null || Number(wholesalePrice) < 0) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El precio mayorista debe ser un número mayor o igual a 0' },
        { status: 400 }
      );
    }

    if (!brandId || !typeId) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Marca y categoría son obligatorios' },
        { status: 400 }
      );
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Debe incluir al menos una imagen' },
        { status: 400 }
      );
    }

    const hasVariants = Array.isArray(variants) && variants.length > 0;
    const hasSizes = Array.isArray(sizesStock) && sizesStock.length > 0;
    const hasDirectStock = stock !== undefined && stock !== null;

    if (!hasVariants && !hasSizes && !hasDirectStock) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Debe cargar stock para el producto o sus variantes' },
        { status: 400 }
      );
    }

    const newProduct = await Product.create({
      name: name.trim(),
      description: description.trim(),
      retailPrice: Number(retailPrice),
      wholesalePrice: Number(wholesalePrice),
      brandId,
      typeId,
      gender: gender ? gender : null,
      active: active !== undefined ? Boolean(active) : true,
      isClearance: isClearance !== undefined ? Boolean(isClearance) : false,
      images,
      variants: hasVariants ? variants : [],
      stock: hasDirectStock ? Number(stock) : 0,
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
    const {
      name,
      description,
      retailPrice,
      wholesalePrice,
      active,
      isClearance,
      images,
      variants,
      stock,
      sizesStock,
      brandId,
      typeId,
      gender,
      displayedSizes,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El ID del producto es obligatorio' },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateFields: Record<string, any> = {};

    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (retailPrice !== undefined) updateFields.retailPrice = Number(retailPrice);
    if (wholesalePrice !== undefined) updateFields.wholesalePrice = Number(wholesalePrice);
    if (brandId !== undefined) updateFields.brandId = brandId;
    if (typeId !== undefined) updateFields.typeId = typeId;
    if (gender !== undefined) updateFields.gender = gender ? gender : null;
    if (active !== undefined) updateFields.active = Boolean(active);
    if (isClearance !== undefined) updateFields.isClearance = Boolean(isClearance);
    if (images !== undefined) updateFields.images = images;
    if (variants !== undefined) updateFields.variants = variants;
    if (stock !== undefined) updateFields.stock = Number(stock);
    if (sizesStock !== undefined) updateFields.sizesStock = sizesStock;
    if (displayedSizes !== undefined) updateFields.displayedSizes = displayedSizes;

    const updatedProduct = await Product.findByIdAndUpdate(productId, updateFields, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!updatedProduct) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: updatedProduct });
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
      // Check if product is in any existing orders
      const orderCount = await (await import('@/models/Order')).default.countDocuments({
        'items.productId': id,
      });

      if (orderCount > 0) {
        // Deactivate instead to preserve historical records
        await Product.findByIdAndUpdate(id, { active: false });
        return NextResponse.json({
          ok: true,
          mode: 'deactivated',
          message: `El producto tiene ${orderCount} venta(s)/pedido(s) registrado(s). Se desactivó del catálogo para preservar el historial.`,
        });
      }

      // Hard delete if never sold/ordered
      await Product.findByIdAndDelete(id);
      return NextResponse.json({
        ok: true,
        mode: 'deleted',
        message: 'Producto eliminado permanentemente de la base de datos.',
      });
    }

    // Standard toggle / soft delete
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
