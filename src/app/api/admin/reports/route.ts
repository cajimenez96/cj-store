import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import Order from '@/models/Order';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();

    const orders = await Order.find({}).lean();

    let totalRevenue = 0;
    let pendingRevenue = 0;
    let totalOrders = 0;
    let pendingOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;

    let transferSales = 0;
    let cashSales = 0;

    const productSalesMap = new Map<
      string,
      { name: string; qty: number; totalAmount: number }
    >();

    for (const order of orders) {
      totalOrders++;

      const isCompleted = order.status === 'completada' || order.status === 'autorizado';
      const isPending = order.status === 'pendiente';
      const isCancelled = order.status === 'cancelada' || order.status === 'cancelado';

      if (isCompleted) {
        completedOrders++;
        totalRevenue += order.total;

        if (order.paymentMethod === 'efectivo') {
          cashSales += order.total;
        } else {
          transferSales += order.total;
        }

        // Product sales aggregation
        for (const item of order.items) {
          const key = item.name;
          const current = productSalesMap.get(key) || {
            name: item.name,
            qty: 0,
            totalAmount: 0,
          };
          current.qty += item.qty;
          current.totalAmount += item.subtotal;
          productSalesMap.set(key, current);
        }
      } else if (isPending) {
        pendingOrders++;
        pendingRevenue += order.total;
      } else if (isCancelled) {
        cancelledOrders++;
      }
    }

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return NextResponse.json({
      ok: true,
      data: {
        totalRevenue,
        pendingRevenue,
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        transferSales,
        cashSales,
        topProducts,
      },
    });
  } catch (error) {
    console.error('Error al generar métricas de reportes:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al generar reportes' },
      { status: 500 }
    );
  }
}
