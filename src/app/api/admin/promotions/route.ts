import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import Promotion from '@/models/Promotion';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const promotions = await Promotion.find({}).sort({ order: 1, createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, data: promotions });
  } catch (error) {
    console.error('Error al consultar promociones en admin:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar promociones' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const { title, description, imageUrl, active, order } = await req.json();

    if (!imageUrl || !imageUrl.trim()) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'La imagen es obligatoria' },
        { status: 400 }
      );
    }

    const newPromotion = await Promotion.create({
      title: title ? title.trim() : '',
      description: description ? description.trim() : '',
      imageUrl: imageUrl.trim(),
      active: active !== undefined ? Boolean(active) : true,
      order: typeof order === 'number' ? order : 0,
    });

    return NextResponse.json({ ok: true, data: newPromotion }, { status: 201 });
  } catch (error) {
    console.error('Error al crear promoción:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al crear promoción' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const body = await req.json();
    const promoId = body._id || body.id;
    const { title, description, imageUrl, active, order } = body;

    if (!promoId) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El ID de la promoción es obligatorio' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl.trim();
    if (active !== undefined) updateData.active = Boolean(active);
    if (order !== undefined) updateData.order = Number(order);

    const updated = await Promotion.findByIdAndUpdate(promoId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Promoción no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    console.error('Error al editar promoción:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: 'INTERNAL_SERVER_ERROR', 
        message: error?.message || 'Error al actualizar la promoción' 
      },
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
        { ok: false, error: 'BAD_REQUEST', message: 'El ID de la promoción es obligatorio' },
        { status: 400 }
      );
    }

    const deleted = await Promotion.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Promoción no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Promoción eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar promoción:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al eliminar promoción' },
      { status: 500 }
    );
  }
}
