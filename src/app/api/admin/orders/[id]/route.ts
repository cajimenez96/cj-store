import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';
import SalesRecord from '@/models/SalesRecord';
import { Types } from 'mongoose';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const order = await Order.findById(id).populate('items.productId', 'images name').lean();

    if (!order) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    const formattedOrder = {
      ...order,
      items: ((order as any).items || []).map((item: any) => {
        const prod = item.productId && typeof item.productId === 'object' ? item.productId : null;
        const mainImage =
          item.image ||
          prod?.images?.find((img: any) => img.isPrincipal)?.url ||
          prod?.images?.[0]?.url ||
          '';
        return {
          ...item,
          productId: prod?._id ? prod._id.toString() : item.productId?.toString() || '',
          image: mainImage,
        };
      }),
    };

    return NextResponse.json({ ok: true, data: formattedOrder });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar solicitud' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/orders/:id
 * Update a pending order's items, quantities, pricing, guest data, or notes
 * WITHOUT touching stock — stock only decrements on authorization.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();
    const { guest, items, discount, notes, paymentMethod } = body;

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    if (order.status !== 'pendiente') {
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_STATUS',
          message: `Solo se pueden editar órdenes en estado "pendiente". Estado actual: "${order.status}".`,
        },
        { status: 409 }
      );
    }

    // Update guest data if provided
    if (guest) {
      if (guest.name) order.guest.name = guest.name.trim();
      if (guest.lastName) order.guest.lastName = guest.lastName.trim();
      if (guest.phone) order.guest.phone = guest.phone.trim();
    }

    // Update items if provided — recalculate subtotals
    if (items && Array.isArray(items) && items.length > 0) {
      const productIds = items.map((i: any) => i.productId);
      const dbProducts = await Product.find({
        _id: { $in: productIds.map((pid: string) => new Types.ObjectId(pid)) },
      }).lean();
      const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

      const validatedItems = [];

      for (const item of items as Array<{
        productId: string;
        name: string;
        image?: string;
        variantId?: string;
        variantLabel?: string;
        variantName?: string;
        sku?: string;
        qty: number;
        unitPrice: number;
        appliedPriceType?: string;
      }>) {
        const dbProd = productMap.get(item.productId);

        // Keep the variant link: stock is decremented per variant when the order is authorized
        const dbVariant = item.variantId
          ? dbProd?.variants?.find((v) => v._id?.toString() === item.variantId)
          : undefined;

        if (item.variantId && !dbVariant) {
          return NextResponse.json(
            {
              ok: false,
              error: 'VARIANT_NOT_FOUND',
              message: `La variante de "${item.name}" ya no existe en el producto.`,
            },
            { status: 400 }
          );
        }

        const resolvedImage =
          item.image ||
          dbProd?.images?.find((img) => img.isPrincipal)?.url ||
          dbProd?.images?.[0]?.url ||
          '';

        validatedItems.push({
          productId: new Types.ObjectId(item.productId as string),
          variantId: dbVariant?._id,
          sku: dbVariant?.sku ?? item.sku,
          name: item.name,
          image: resolvedImage,
          variantLabel: item.variantLabel,
          variantName: item.variantName,
          qty: Math.max(1, Number(item.qty)),
          appliedPriceType: (item.appliedPriceType ?? 'custom') as 'retail' | 'wholesale' | 'custom',
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.unitPrice) * Math.max(1, Number(item.qty)),
        });
      }

      order.items = validatedItems as typeof order.items;
    }

    // Recalculate subtotal from items
    const newSubtotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);
    order.subtotal = newSubtotal;

    if (discount !== undefined) {
      order.discount = Math.max(0, Number(discount));
    }

    order.total = Math.max(0, order.subtotal - order.discount);

    if (notes !== undefined) order.notes = notes.trim();
    if (paymentMethod && ['transferencia', 'efectivo', 'tarjeta', 'otro'].includes(paymentMethod)) {
      order.paymentMethod = paymentMethod;
    }

    await order.save();

    return NextResponse.json({ ok: true, data: order });
  } catch (error) {
    console.error('Error al editar orden pendiente:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al actualizar la solicitud' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/orders/:id
 * Cancel a pending order (does not touch stock).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();
    const { action, notes } = body;

    if (action !== 'cancel') {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Acción inválida. Use action: "cancel".' },
        { status: 400 }
      );
    }

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    if (order.status === 'cancelado' || order.status === 'cancelada') {
      return NextResponse.json(
        { ok: false, error: 'INVALID_STATUS', message: 'La orden ya está cancelada.' },
        { status: 409 }
      );
    }

    order.status = 'cancelado';
    if (notes) order.notes = notes.trim();
    await order.save();

    return NextResponse.json({ ok: true, data: order });
  } catch (error) {
    console.error('Error al cancelar orden:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al cancelar la solicitud' },
      { status: 500 }
    );
  }
}

// Silence unused import warning — SalesRecord is used in the authorize route
void SalesRecord;
void Product;
