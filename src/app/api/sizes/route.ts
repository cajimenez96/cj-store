import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import GenderSize, { DEFAULT_GENDER_SIZES } from '@/models/GenderSize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();
    const docs = await GenderSize.find({}).sort({ gender: 1 }).lean();
    const sizesByGender: Record<string, number[]> = {};

    if (docs.length === 0) {
      return NextResponse.json({
        ok: true,
        data: DEFAULT_GENDER_SIZES,
      });
    }

    for (const doc of docs) {
      sizesByGender[doc.gender] = doc.sizes || [];
    }

    return NextResponse.json({
      ok: true,
      data: sizesByGender,
    });
  } catch (error) {
    console.error('Error al consultar talles públicos:', error);
    return NextResponse.json(
      { ok: true, data: DEFAULT_GENDER_SIZES },
      { status: 200 }
    );
  }
}
