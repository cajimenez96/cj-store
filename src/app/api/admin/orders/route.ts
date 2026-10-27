import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const hasPagination = Boolean(limitParam !== null && parseInt(limitParam, 10) > 0);
    const limit = hasPagination ? parseInt(limitParam!, 10) : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    const VALID_STATUSES = ['pendiente', 'autorizado', 'cancelado', 'confirmada', 'completada', 'cancelada'];
    if (status && VALID_STATUSES.includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'guest.name': { $regex: search, $options: 'i' } },
        { 'guest.lastName': { $regex: search, $options: 'i' } },
        { 'guest.phone': { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Order.countDocuments(query);
    let orderQuery = Order.find(query)
      .populate('items.productId', 'images name')
      .sort({ createdAt: -1, _id: -1 });

    if (hasPagination) {
      const skip = (page - 1) * limit;
      orderQuery = orderQuery.skip(skip).limit(limit);
    }

    const orders = await orderQuery.lean();

    const formattedOrders = orders.map((order: any) => ({
      ...order,
      items: (order.items || []).map((item: any) => {
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
    }));

    return NextResponse.json({
      ok: true,
      data: formattedOrders,
      pagination: {
        page,
        limit: hasPagination ? limit : total,
        total,
        totalPages: hasPagination && limit > 0 ? Math.ceil(total / limit) : 1,
      },
    });
  } catch (error) {
    console.error('Error al consultar solicitudes en admin:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar solicitudes' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();
    const { id, status, notes } = await req.json();

    if (!id || !status || !['pendiente', 'completada', 'cancelada'].includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'ID y estado válido son obligatorios' },
        { status: 400 }
      );
    }

    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    const previousStatus = existingOrder.status;

    // Handle stock decrement when moving to 'completada'
    if (previousStatus !== 'completada' && status === 'completada') {
      for (const item of existingOrder.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          if (item.variantName && product.variants) {
            product.variants = product.variants.map((v) => {
              if (v.name === item.variantName) {
                return { ...v, stock: Math.max(0, v.stock - item.qty) };
              }
              return v;
            });
          } else if (product.stock !== undefined) {
            product.stock = Math.max(0, product.stock - item.qty);
          }
          await product.save();
        }
      }
    }

    // Restore stock if previously completed order is cancelled
    if (previousStatus === 'completada' && status === 'cancelada') {
      for (const item of existingOrder.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          if (item.variantName && product.variants) {
            product.variants = product.variants.map((v) => {
              if (v.name === item.variantName) {
                return { ...v, stock: v.stock + item.qty };
              }
              return v;
            });
          } else if (product.stock !== undefined) {
            product.stock = product.stock + item.qty;
          }
          await product.save();
        }
      }
    }

    existingOrder.status = status;
    if (notes !== undefined) existingOrder.notes = notes.trim();

    await existingOrder.save();

    return NextResponse.json({ ok: true, data: existingOrder });
  } catch (error) {
    console.error('Error al actualizar estado de orden:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al actualizar la solicitud' },
      { status: 500 }
    );
  }
}
