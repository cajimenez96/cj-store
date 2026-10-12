import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Attribute, Category, Product } from '@/models';
import { updateAttributeSchema } from '@/schemas/attribute';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const attribute = await Attribute.findById(id).lean();
    if (!attribute) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Atributo no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: attribute });
  } catch (error) {
    console.error('Error al obtener atributo:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar atributo' },
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

    const parsed = updateAttributeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Datos de actualización inválidos',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const attribute = await Attribute.findById(id);
    if (!attribute) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Atributo no encontrado' },
        { status: 404 }
      );
    }

    const { label, options, unit, filterable } = parsed.data;

    if (label !== undefined) attribute.label = label;
    if (unit !== undefined) attribute.unit = unit;
    if (filterable !== undefined) attribute.filterable = filterable;

    // Check if any deleted options are currently used in products
    if (options !== undefined) {
      const currentValues = new Set(attribute.options.map((o) => o.value));
      const newValues = new Set(options.map((o) => o.value));

      const removedValues = Array.from(currentValues).filter((v) => !newValues.has(v));

      if (removedValues.length > 0) {
        // Query if any variant in products uses these removed options
        const inUseProducts = await Product.find({
          'variants.options': {
            $elemMatch: {
              key: attribute.key,
              value: { $in: removedValues },
            },
          },
        })
          .select('name')
          .limit(5)
          .lean();

        if (inUseProducts.length > 0) {
          const names = inUseProducts.map((p) => p.name).join(', ');
          return NextResponse.json(
            {
              ok: false,
              error: 'IN_USE',
              message: `No se pueden eliminar las opciones [${removedValues.join(', ')}] porque están en uso en los productos: ${names}. Podés desactivar las opciones en lugar de eliminarlas.`,
            },
            { status: 409 }
          );
        }
      }

      attribute.options = options as any;
    }

    await attribute.save();

    return NextResponse.json({
      ok: true,
      data: attribute,
      message: `Atributo "${attribute.label}" actualizado con éxito`,
    });
  } catch (error) {
    console.error('Error al actualizar atributo:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al actualizar atributo' },
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

    const attribute = await Attribute.findById(id);
    if (!attribute) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Atributo no encontrado' },
        { status: 404 }
      );
    }

    // 1. Verify not used in any Category
    const categoriesUsing = await Category.find({
      $or: [
        { variantAxes: attribute.key },
        { 'specAttributes.key': attribute.key },
      ],
    })
      .select('name')
      .lean();

    if (categoriesUsing.length > 0) {
      const names = categoriesUsing.map((c) => c.name).join(', ');
      return NextResponse.json(
        {
          ok: false,
          error: 'IN_USE',
          message: `El atributo "${attribute.label}" no se puede eliminar porque está en uso en las categorías: ${names}. Quitalo de esas categorías primero.`,
        },
        { status: 409 }
      );
    }

    // 2. Verify not used in any Product variants or specs
    const productsUsing = await Product.find({
      $or: [
        { 'variants.options.key': attribute.key },
        { 'specs.key': attribute.key },
      ],
    })
      .select('name')
      .limit(3)
      .lean();

    if (productsUsing.length > 0) {
      const names = productsUsing.map((p) => p.name).join(', ');
      return NextResponse.json(
        {
          ok: false,
          error: 'IN_USE',
          message: `El atributo está en uso en productos existentes (${names}). Desactivalo en su lugar.`,
        },
        { status: 409 }
      );
    }

    await Attribute.findByIdAndDelete(id);

    return NextResponse.json({
      ok: true,
      message: `Atributo "${attribute.label}" eliminado correctamente`,
    });
  } catch (error) {
    console.error('Error al eliminar atributo:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al eliminar atributo' },
      { status: 500 }
    );
  }
}
