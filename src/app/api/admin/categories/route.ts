import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Category, Product } from '@/models';
import { createCategorySchema } from '@/schemas/category';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();

    const categories = await Category.find({}).sort({ order: 1, name: 1 }).lean();

    // Map product counts per category
    const productCounts = await Product.aggregate([
      { $match: { categoryId: { $exists: true, $ne: null } } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const countsMap = new Map(productCounts.map((p) => [p._id.toString(), p.count]));

    const enriched = categories.map((c) => ({
      ...c,
      productCount: countsMap.get(c._id.toString()) || 0,
    }));

    return NextResponse.json({ ok: true, data: enriched });
  } catch (error) {
    console.error('Error al listar categorías:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar categorías' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const parsed = createCategorySchema.safeParse(body);
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

    // Check slug uniqueness
    const existing = await Category.findOne({ slug });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'CONFLICT', message: `Ya existe una categoría con el slug "${slug}"` },
        { status: 409 }
      );
    }

    // Calculate ancestors
    let ancestors: mongoose.Types.ObjectId[] = [];
    let validParentId: mongoose.Types.ObjectId | null = null;

    if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
      const parent = await Category.findById(parentId);
      if (!parent) {
        return NextResponse.json(
          { ok: false, error: 'BAD_REQUEST', message: 'La categoría padre especificada no existe' },
          { status: 400 }
        );
      }
      validParentId = parent._id as mongoose.Types.ObjectId;
      ancestors = [...(parent.ancestors || []), validParentId];
    }

    const created = await Category.create({
      name,
      slug,
      parentId: validParentId,
      ancestors,
      variantAxes: variantAxes || [],
      imageAxis: imageAxis || undefined,
      specAttributes: specAttributes || [],
      order: order ?? 0,
      active: active ?? true,
    });

    return NextResponse.json(
      { ok: true, data: created, message: `Categoría "${name}" creada correctamente` },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear categoría:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al guardar categoría' },
      { status: 500 }
    );
  }
}
