import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Attribute, Category } from '@/models';
import { createAttributeSchema } from '@/schemas/attribute';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();

    const attributes = await Attribute.find({}).sort({ label: 1 }).lean();
    const categories = await Category.find({}).select('name variantAxes specAttributes').lean();

    // Calculate usage count in categories
    const enriched = attributes.map((attr) => {
      const usedInCategories = categories
        .filter(
          (c) =>
            c.variantAxes?.includes(attr.key) ||
            c.specAttributes?.some((s) => s.key === attr.key)
        )
        .map((c) => c.name);

      return {
        ...attr,
        usedInCount: usedInCategories.length,
        usedInCategories,
      };
    });

    return NextResponse.json({ ok: true, data: enriched });
  } catch (error) {
    console.error('Error al listar atributos:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar atributos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const parsed = createAttributeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Datos de atributo inválidos',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { key, label, type, options, unit, filterable } = parsed.data;

    // Check key uniqueness
    const existing = await Attribute.findOne({ key });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: 'CONFLICT',
          message: `Ya existe un atributo con el identificador "${key}"`,
        },
        { status: 409 }
      );
    }

    const created = await Attribute.create({
      key,
      label,
      type,
      options: options || [],
      unit: unit || '',
      filterable: Boolean(filterable),
    });

    return NextResponse.json(
      { ok: true, data: created, message: `Atributo "${label}" creado correctamente` },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al crear atributo:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al guardar atributo' },
      { status: 500 }
    );
  }
}
