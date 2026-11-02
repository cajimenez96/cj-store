import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import Brand from '@/models/Brand';
import Product from '@/models/Product';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const brands = await Brand.find({}).sort({ name: 1 }).lean();

    // Get count of products associated with each brand
    const brandsWithCounts = await Promise.all(
      brands.map(async (brand) => {
        const productCount = await Product.countDocuments({ brandId: brand._id });
        return {
          ...brand,
          productCount,
        };
      })
    );

    return NextResponse.json({ ok: true, data: brandsWithCounts });
  } catch (error) {
    console.error('Error al consultar marcas en admin:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar marcas' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const { name } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El nombre de la marca es obligatorio' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const existing = await Brand.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'DUPLICATE', message: 'Ya existe una marca registrada con este nombre' },
        { status: 400 }
      );
    }

    const newBrand = await Brand.create({ name: trimmedName });

    return NextResponse.json({ ok: true, data: newBrand }, { status: 201 });
  } catch (error) {
    console.error('Error al crear marca:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al crear marca' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const { id, name } = await req.json();

    if (!id || !name || !name.trim()) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'ID y nombre son obligatorios' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const updatedBrand = await Brand.findByIdAndUpdate(
      id,
      { name: trimmedName },
      { new: true, runValidators: true }
    );

    if (!updatedBrand) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Marca no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: updatedBrand });
  } catch (error) {
    console.error('Error al editar marca:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al actualizar la marca' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El ID de la marca es obligatorio' },
        { status: 400 }
      );
    }

    // Check if products exist for this brand
    const linkedProducts = await Product.countDocuments({ brandId: id });
    if (linkedProducts > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'LINKED_PRODUCTS_EXIST',
          message: `No se puede eliminar la marca porque tiene ${linkedProducts} productos asociados.`,
        },
        { status: 400 }
      );
    }

    const deleted = await Brand.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Marca no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Marca eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar marca:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al eliminar marca' },
      { status: 500 }
    );
  }
}
