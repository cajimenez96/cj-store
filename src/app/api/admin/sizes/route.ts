import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import GenderSize, { DEFAULT_GENDER_SIZES } from '@/models/GenderSize';

export const dynamic = 'force-dynamic';

const INITIAL_DEFAULT_GENDERS = ['Hombre', 'Mujer', 'Niño', 'Unisex'];

async function ensureDefaultGendersIfEmpty() {
  const count = await GenderSize.countDocuments();
  if (count === 0) {
    for (const gender of INITIAL_DEFAULT_GENDERS) {
      await GenderSize.create({
        gender,
        sizes: DEFAULT_GENDER_SIZES[gender] || [],
      });
    }
  }
}

export async function GET() {
  try {
    await connectToDatabase();
    await ensureDefaultGendersIfEmpty();

    const docs = await GenderSize.find({}).sort({ gender: 1 }).lean();
    const sizesByGender: Record<string, number[]> = {};

    for (const doc of docs) {
      sizesByGender[doc.gender] = doc.sizes || [];
    }

    return NextResponse.json({
      ok: true,
      data: sizesByGender,
    });
  } catch (error) {
    console.error('Error al obtener géneros y talles:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar géneros y talles' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const genderName = typeof body.gender === 'string' ? body.gender.trim() : '';
    if (!genderName) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El nombre del género es obligatorio' },
        { status: 400 }
      );
    }

    const existing = await GenderSize.findOne({
      gender: { $regex: new RegExp(`^${genderName}$`, 'i') },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'CONFLICT', message: `El género "${genderName}" ya existe` },
        { status: 409 }
      );
    }

    const rawSizes = Array.isArray(body.sizes) ? body.sizes : [];
    const parsed: number[] = rawSizes
      .map((s: unknown) => Number(s))
      .filter((s: number) => !isNaN(s) && s > 0 && s < 100);
    const cleanSizes = Array.from(new Set(parsed)).sort((a, b) => a - b);

    const created = await GenderSize.create({
      gender: genderName,
      sizes: cleanSizes,
    });

    return NextResponse.json({
      ok: true,
      data: created,
      message: `Género "${genderName}" creado correctamente`,
    });
  } catch (error) {
    console.error('Error al crear género:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al crear género' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    // Check for single gender update
    if (body.gender && Array.isArray(body.sizes)) {
      const gender = String(body.gender).trim();
      if (!gender) {
        return NextResponse.json(
          { ok: false, error: 'BAD_REQUEST', message: 'El género es obligatorio' },
          { status: 400 }
        );
      }

      // Clean & sort sizes (can be empty for perfumes!)
      const parsed: number[] = body.sizes
        .map((s: unknown) => Number(s))
        .filter((s: number) => !isNaN(s) && s > 0 && s < 100);

      const cleanSizes: number[] = Array.from(new Set(parsed)).sort((a, b) => a - b);

      const updated = await GenderSize.findOneAndUpdate(
        { gender },
        { sizes: cleanSizes },
        { returnDocument: 'after', upsert: true, runValidators: true }
      );

      return NextResponse.json({
        ok: true,
        data: updated,
        message: `Talles para ${gender} actualizados correctamente`,
      });
    }

    // Reset to defaults
    if (body.reset && body.gender) {
      const gender = String(body.gender).trim();
      const defaultScale = DEFAULT_GENDER_SIZES[gender] || [];

      const updated = await GenderSize.findOneAndUpdate(
        { gender },
        { sizes: defaultScale },
        { returnDocument: 'after', upsert: true }
      );

      return NextResponse.json({
        ok: true,
        data: updated,
        message: `Talles para ${gender} restablecidos a valores por defecto`,
      });
    }

    return NextResponse.json(
      { ok: false, error: 'BAD_REQUEST', message: 'Formato de datos no válido' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error al actualizar talles:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al actualizar escalas de talles' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const url = new URL(req.url);
    let gender = url.searchParams.get('gender');

    if (!gender) {
      try {
        const body = await req.json();
        gender = body.gender;
      } catch {
        // no body
      }
    }

    const genderName = typeof gender === 'string' ? gender.trim() : '';
    if (!genderName) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Debe especificar el género a eliminar' },
        { status: 400 }
      );
    }

    const deleted = await GenderSize.findOneAndDelete({ gender: genderName });
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: `No se encontró el género "${genderName}"` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Género "${genderName}" eliminado correctamente`,
    });
  } catch (error) {
    console.error('Error al eliminar género:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al eliminar género' },
      { status: 500 }
    );
  }
}
