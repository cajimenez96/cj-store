import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { imagekit } from '@/lib/imagekit';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || '/products';

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'No se envió ningún archivo de imagen' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await imagekit.upload({
      file: buffer,
      fileName: `fp_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`,
      folder,
      useUniqueFileName: true,
    });

    return NextResponse.json({
      ok: true,
      url: result.url,
      fileId: result.fileId,
      name: result.name,
    });
  } catch (error) {
    console.error('Error al subir imagen a ImageKit:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al subir la imagen a la CDN' },
      { status: 500 }
    );
  }
}
