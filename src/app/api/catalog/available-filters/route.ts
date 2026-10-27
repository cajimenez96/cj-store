import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getConfiguredGenderLabels } from '@/lib/genderFilter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();

    // Genders come from the active options of the "genero" attribute
    const genders = await getConfiguredGenderLabels();

    return NextResponse.json({
      ok: true,
      data: {
        genders,
      },
    });
  } catch (err) {
    console.error('Error fetching available filters:', err);
    return NextResponse.json(
      { ok: false, message: 'Error al obtener filtros disponibles' },
      { status: 500 }
    );
  }
}
