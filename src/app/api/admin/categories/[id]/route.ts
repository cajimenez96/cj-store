import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Category, Product } from '@/models';
import { updateCategorySchema } from '@/schemas/category';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const category = await Category.findById(id).lean();
    if (!category) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: category });
  } catch (error) {
    console.error('Error al obtener categoría:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar categoría' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();

    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Datos de categoría inválidos',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    const {
      name,
      slug,
      parentId,
      variantAxes,
      imageAxis,
      specAttributes,
      order,
      active,
    } = parsed.data;

    // Slug uniqueness check if changed
    if (slug && slug !== category.slug) {
      const existing = await Category.findOne({ slug });
      if (existing) {
        return NextResponse.json(
          { ok: false, error: 'CONFLICT', message: `El slug "${slug}" ya está en uso` },
          { status: 409 }
        );
      }
      category.slug = slug;
    }

    // Check variantAxes change with existing products
    if (variantAxes !== undefined) {
      const currentAxes = [...(category.variantAxes || [])].sort().join(',');
      const newAxes = [...variantAxes].sort().join(',');

      if (currentAxes !== newAxes) {
        const productCount = await Product.countDocuments({ categoryId: category._id });
        if (productCount > 0) {
          return NextResponse.json(
            {
              ok: false,
              error: 'AXES_LOCKED',
              message: `Esta categoría tiene ${productCount} productos asociados. Para utilizar otros ejes de variantes, creá una categoría nueva o transferí los productos.`,
            },
            { status: 409 }
          );
        }
      }
      category.variantAxes = variantAxes;
    }

    // Check hierarchy change
    if (parentId !== undefined) {
      const newParentId =
        parentId && mongoose.Types.ObjectId.isValid(parentId)
          ? new mongoose.Types.ObjectId(parentId)
          : null;

      const currentParentIdStr = category.parentId?.toString() || null;
      const newParentIdStr = newParentId?.toString() || null;

      if (currentParentIdStr !== newParentIdStr) {
        // Prevent setting itself or a descendant as parent
        if (newParentIdStr === category._id.toString()) {
          return NextResponse.json(
            { ok: false, error: 'BAD_REQUEST', message: 'Una categoría no puede ser su propio padre' },
            { status: 400 }
          );
        }

        let newAncestors: mongoose.Types.ObjectId[] = [];
        if (newParentId) {
          const parent = await Category.findById(newParentId);
          if (!parent) {
            return NextResponse.json(
              { ok: false, error: 'BAD_REQUEST', message: 'La categoría padre no existe' },
              { status: 400 }
            );
          }
          if (parent.ancestors?.some((a) => a.toString() === category._id.toString())) {
            return NextResponse.json(
              { ok: false, error: 'BAD_REQUEST', message: 'No podés mover una categoría dentro de uno de sus descendientes' },
              { status: 400 }
            );
          }
          newAncestors = [...(parent.ancestors || []), newParentId];
        }

        category.parentId = newParentId;
        category.ancestors = newAncestors;

        // Update product categoryAncestors
        await Product.updateMany(
          { categoryId: category._id },
          { $set: { categoryAncestors: newAncestors } }
        );
      }
    }

    if (name !== undefined) category.name = name;
    if (imageAxis !== undefined) category.imageAxis = imageAxis || undefined;
    if (specAttributes !== undefined) category.specAttributes = specAttributes as any;
    if (order !== undefined) category.order = order;
    if (active !== undefined) category.active = active;

    await category.save();

    return NextResponse.json({
      ok: true,
      data: category,
      message: `Categoría "${category.name}" actualizada con éxito`,
    });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al actualizar categoría' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    // 1. Check if category has subcategories
    const childrenCount = await Category.countDocuments({ parentId: category._id });
    if (childrenCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'HAS_CHILDREN',
          message: `No se puede eliminar la categoría "${category.name}" porque tiene ${childrenCount} subcategorías asociadas. Eliminalas o movelas primero.`,
        },
        { status: 409 }
      );
    }

    // 2. Check if category has products
    const productCount = await Product.countDocuments({ categoryId: category._id });
    if (productCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'HAS_PRODUCTS',
          message: `No se puede eliminar la categoría "${category.name}" porque tiene ${productCount} productos asociados. Reasignalos o desactivala en su lugar.`,
        },
        { status: 409 }
      );
    }

    await Category.findByIdAndDelete(id);

    return NextResponse.json({
      ok: true,
      message: `Categoría "${category.name}" eliminada correctamente`,
    });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al eliminar categoría' },
      { status: 500 }
    );
  }
}
