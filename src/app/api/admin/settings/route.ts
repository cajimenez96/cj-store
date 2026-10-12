import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Settings from '@/models/Settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();
    let settings = await Settings.findOne({}).lean();

    if (!settings) {
      settings = await Settings.create({});
    }

    return NextResponse.json({ ok: true, data: settings });
  } catch (error) {
    console.error('Error al obtener ajustes en admin:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar ajustes' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const {
      storeName,
      storePhone,
      storeEmail,
      businessHours,
      whatsappInquiryMessage,
      instagramUrl,
      facebookUrl,
      metaTitle,
      metaDescription,
      metaKeywords,
      footerDescription,
      bankAlias,
      bankCbu,
      bankHolder,
      bankCuit,
      bankName,
      minStockAlert,
      wholesaleMinPairs,
      shippingInfo,
      enableGenders,
    } = body;

    // Basic required validations
    if (!storePhone || !storePhone.trim()) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El teléfono de WhatsApp es obligatorio.' },
        { status: 400 }
      );
    }

    if (!bankAlias || !bankAlias.trim()) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El alias bancario es obligatorio.' },
        { status: 400 }
      );
    }

    let settings = await Settings.findOne({});

    if (!settings) {
      settings = new Settings({});
    }

    // Update Identity & Contact
    if (storeName !== undefined) settings.storeName = storeName.trim();
    if (storePhone !== undefined) settings.storePhone = storePhone.trim().replace(/[^0-9]/g, '');
    if (storeEmail !== undefined) settings.storeEmail = storeEmail.trim();
    if (businessHours !== undefined) settings.businessHours = businessHours.trim();
    if (whatsappInquiryMessage !== undefined) settings.whatsappInquiryMessage = whatsappInquiryMessage.trim();
    if (instagramUrl !== undefined) settings.instagramUrl = instagramUrl.trim();
    if (facebookUrl !== undefined) settings.facebookUrl = facebookUrl.trim();

    // Update SEO & Social Meta
    if (metaTitle !== undefined) settings.metaTitle = metaTitle.trim();
    if (metaDescription !== undefined) settings.metaDescription = metaDescription.trim();
    if (metaKeywords !== undefined) settings.metaKeywords = metaKeywords.trim();
    if (footerDescription !== undefined) settings.footerDescription = footerDescription.trim();

    // Update Bank Data
    if (bankAlias !== undefined) settings.bankAlias = bankAlias.trim();
    if (bankCbu !== undefined) settings.bankCbu = bankCbu.trim();
    if (bankHolder !== undefined) settings.bankHolder = bankHolder.trim();
    if (bankCuit !== undefined) settings.bankCuit = bankCuit.trim();
    if (bankName !== undefined) settings.bankName = bankName.trim();

    // Update Inventory & Commercial
    if (minStockAlert !== undefined) settings.minStockAlert = Math.max(0, Number(minStockAlert));
    if (wholesaleMinPairs !== undefined) settings.wholesaleMinPairs = Math.max(1, Number(wholesaleMinPairs));
    if (shippingInfo !== undefined) settings.shippingInfo = shippingInfo.trim();
    if (enableGenders !== undefined) settings.enableGenders = Boolean(enableGenders);

    await settings.save();

    return NextResponse.json({ ok: true, data: settings });
  } catch (error) {
    console.error('Error al actualizar ajustes en admin:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al guardar ajustes' },
      { status: 500 }
    );
  }
}
