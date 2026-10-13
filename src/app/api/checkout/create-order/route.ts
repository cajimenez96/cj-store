import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { Types } from 'mongoose';

const WHOLESALE_THRESHOLD = 5;

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const { guest, paymentMethod, notes, items } = body;

    // 1. Basic Payload Validation
    if (!guest || !guest.name || !guest.lastName || !guest.phone) {
      return NextResponse.json(
        {
          ok: false,
          error: 'BAD_REQUEST',
          message: 'Los datos del cliente (nombre, apellido y teléfono) son obligatorios.',
        },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'BAD_REQUEST',
          message: 'El pedido debe incluir al menos un producto.',
        },
        { status: 400 }
      );
    }

    // 2. Fetch real products from DB to prevent client-side price tampering
    const productIds = items.map((item: { productId: string }) => item.productId);
    const dbProducts = await Product.find({
      _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
      active: true,
    }).lean();

    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    // 3. Calculate unit counts per product for wholesale evaluation
    const productUnitsMap = new Map<string, number>();
    for (const item of items) {
      const pId = String(item.productId);
      const qty = Math.max(1, parseInt(String(item.qty), 10) || 1);
      productUnitsMap.set(pId, (productUnitsMap.get(pId) || 0) + qty);
    }
    const totalOrderUnits = Array.from(productUnitsMap.values()).reduce((a, b) => a + b, 0);

    let calculatedSubtotal = 0;
    const validatedItems = [];

    // 4. Verify stock and calculate server-side pricing for each item
    for (const item of items) {
      const dbProd = productMap.get(item.productId);
      if (!dbProd) {
        return NextResponse.json(
          {
            ok: false,
            error: 'PRODUCT_NOT_FOUND',
            message: `El producto con ID ${item.productId} ya no está disponible.`,
          },
          { status: 400 }
        );
      }

      const itemQty = Math.max(1, parseInt(String(item.qty), 10) || 1);
      const parsedSize = item.size ? parseInt(String(item.size), 10) : undefined;

      // Locate variant if present
      let matchedVariant: any = null;
      let availableStock = 0;
      let variantLabel = item.variantLabel || item.variantName;

      if (item.variantId && Array.isArray(dbProd.variants) && dbProd.variants.length > 0) {
        matchedVariant = dbProd.variants.find((v: any) => v._id?.toString() === item.variantId);
      } else if (item.sku && Array.isArray(dbProd.variants) && dbProd.variants.length > 0) {
        matchedVariant = dbProd.variants.find((v: any) => v.sku?.toLowerCase() === item.sku.toLowerCase());
      } else if (item.variantName && Array.isArray(dbProd.variants) && dbProd.variants.length > 0) {
        matchedVariant = dbProd.variants.find((v: any) => v.name?.toLowerCase() === item.variantName.toLowerCase());
      }

      if (matchedVariant) {
        availableStock = matchedVariant.stock ?? 0;
        if (!variantLabel && Array.isArray(matchedVariant.options)) {
          variantLabel = matchedVariant.options.map((o: any) => o.value).join(' / ');
        }
      } else if (parsedSize !== undefined && Array.isArray(dbProd.sizesStock) && dbProd.sizesStock.length > 0) {
        const sizeEntry = dbProd.sizesStock.find((s: any) => s.size === parsedSize);
        availableStock = sizeEntry?.stock ?? 0;
        variantLabel = variantLabel || `Talle ${parsedSize}`;
      } else {
        availableStock = dbProd.stock ?? dbProd.totalStock ?? 0;
      }

      // Requirement 1: No soft reserves. Return 409 Conflict if stock is insufficient
      if (availableStock < itemQty) {
        return NextResponse.json(
          {
            ok: false,
            error: 'INSUFFICIENT_STOCK',
            message: `Stock insuficiente para "${dbProd.name}" (${variantLabel || 'Sin variante'}). Disponible: ${availableStock}, solicitado: ${itemQty}.`,
            details: {
              productId: dbProd._id.toString(),
              variantId: matchedVariant?._id?.toString(),
              availableStock,
              requestedQty: itemQty,
            },
          },
          { status: 409 }
        );
      }

      // Price calculation
      const pUnits = productUnitsMap.get(dbProd._id.toString()) || itemQty;
      const wholesaleMinUnits = dbProd.wholesale?.minQty ?? (dbProd.wholesale as any)?.minUnits ?? WHOLESALE_THRESHOLD;
      const vRetail = Number(matchedVariant?.retailPrice ?? dbProd.retailPrice ?? dbProd.price ?? 0);
      const vWholesale = matchedVariant?.wholesalePrice != null && Number(matchedVariant.wholesalePrice) > 0
        ? Number(matchedVariant.wholesalePrice)
        : (dbProd.wholesalePrice != null && Number(dbProd.wholesalePrice) > 0 ? Number(dbProd.wholesalePrice) : vRetail);

      const isWholesaleItem =
        (Boolean(dbProd.wholesale?.enabled) && pUnits >= wholesaleMinUnits && vWholesale < vRetail) ||
        (totalOrderUnits >= WHOLESALE_THRESHOLD && vWholesale < vRetail);

      const unitPrice = isWholesaleItem ? vWholesale : vRetail;
      const itemSubtotal = unitPrice * itemQty;
      calculatedSubtotal += itemSubtotal;

      const principalImage =
        dbProd.images?.find((img: any) => img.isPrincipal)?.url || dbProd.images?.[0]?.url || '';

      validatedItems.push({
        productId: dbProd._id,
        variantId: matchedVariant?._id,
        sku: matchedVariant?.sku || item.sku,
        name: dbProd.name,
        image: principalImage,
        variantLabel: variantLabel || (item.variantName ? String(item.variantName) : undefined),
        variantName: item.variantName || (parsedSize !== undefined ? String(parsedSize) : undefined),
        size: !isNaN(Number(parsedSize)) ? parsedSize : undefined,
        qty: itemQty,
        appliedPriceType: (isWholesaleItem ? 'wholesale' : 'retail') as 'retail' | 'wholesale',
        unitPrice,
        subtotal: itemSubtotal,
      });
    }

    // 5. Generate Sequential Order Number (PED-YYYY-XXXXX)
    const currentYear = new Date().getFullYear();
    const countToday = await Order.countDocuments();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `PED-${currentYear}-${(countToday + 1).toString().padStart(4, '0')}${randomSuffix.toString().slice(-2)}`;

    const total = calculatedSubtotal;
    const hasAnyWholesale = validatedItems.some((i) => i.appliedPriceType === 'wholesale');

    // 6. Create and Save Pending Order
    const newOrder = await Order.create({
      orderNumber,
      origin: 'web',
      guest: {
        name: guest.name.trim(),
        lastName: guest.lastName.trim(),
        phone: guest.phone.trim(),
      },
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discount: 0,
      total,
      paymentMethod: ['transferencia', 'efectivo', 'tarjeta', 'otro'].includes(paymentMethod)
        ? paymentMethod
        : 'transferencia',
      status: 'pendiente',
      notes: notes ? notes.trim() : '',
    });

    return NextResponse.json(
      {
        ok: true,
        orderId: newOrder._id.toString(),
        orderNumber: newOrder.orderNumber,
        appliedPriceType: hasAnyWholesale ? 'wholesale' : 'retail',
        isWholesale: hasAnyWholesale,
        subtotal: newOrder.subtotal,
        discount: newOrder.discount,
        total: newOrder.total,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al registrar orden de compra:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'No se pudo registrar la solicitud de venta',
      },
      { status: 500 }
    );
  }
}
