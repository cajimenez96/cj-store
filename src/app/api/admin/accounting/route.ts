import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Order from '@/models/Order';
import Expense from '@/models/Expense';
import { getSession, sessionError } from '@/lib/session';
import { ordersScope } from '@/lib/order-access';
import { isAdminRole } from '@/lib/permissions';
import { sellerKey, sellerLabel } from '@/lib/seller-label';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getSession(req);
    if (!session) return sessionError(401);
    const isAdmin = isAdminRole(session.role);
    if (!isAdmin && session.role !== 'seller') return sessionError(403);

    const { searchParams } = new URL(req.url);

    // Strict parsing: anything that is not a plain in-range number falls back to now.
    const now = new Date();
    const rawMonth = searchParams.get('month') ?? '';
    const rawYear = searchParams.get('year') ?? '';
    const parsedMonth = /^\d{1,2}$/.test(rawMonth) ? parseInt(rawMonth, 10) : NaN;
    const parsedYear = /^\d{4}$/.test(rawYear) ? parseInt(rawYear, 10) : NaN;
    const month = parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getMonth() + 1;
    const year = parsedYear >= 1970 ? parsedYear : now.getFullYear();

    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // 1. Fetch completed/authorized orders in the month
    const orders = await Order.find({
      ...ordersScope(session, searchParams.get('userId') ?? undefined),
      status: { $in: ['autorizado', 'completada', 'confirmada'] },
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch expenses in the month (admin only; sellers never read them)
    const expenses = isAdmin
      ? await Expense.find({
          date: { $gte: startDate, $lte: endDate },
        })
          .sort({ date: -1 })
          .lean()
      : [];

    // Calculate Incomes
    let incomeTotal = 0;
    let incomeCash = 0;
    let incomeTransfer = 0;
    let totalPairsSold = 0;
    const deviation = { above: 0, below: 0 };
    const sellers = new Map<
      string,
      { userId: string; name: string; totalSold: number; salesCount: number; units: number; above: number; below: number }
    >();

    for (const ord of orders) {
      // Web orders under 'web'; direct sales recorded before attribution under 'legacy'.
      const key = sellerKey(ord);
      let row = sellers.get(key);
      if (!row) {
        row = {
          userId: key,
          name: ord.soldBy?.userId ? ord.soldBy.name ?? '' : sellerLabel(ord),
          totalSold: 0,
          salesCount: 0,
          units: 0,
          above: 0,
          below: 0,
        };
        sellers.set(key, row);
      }
      row.totalSold += ord.total;
      row.salesCount += 1;

      incomeTotal += ord.total;
      if (ord.paymentMethod === 'efectivo') {
        incomeCash += ord.total;
      } else {
        incomeTransfer += ord.total;
      }

      for (const item of ord.items) {
        totalPairsSold += item.qty;
        row.units += item.qty;
        // Price deviation vs catalog; legacy items without listPrice are ignored.
        if (typeof item.listPrice === 'number') {
          const diff = (item.unitPrice - item.listPrice) * item.qty;
          if (diff > 0) {
            deviation.above += diff;
            row.above += diff;
          } else if (diff < 0) {
            deviation.below += -diff;
            row.below += -diff;
          }
        }
      }
    }

    // Calculate Expenses
    let expenseTotal = 0;
    let expenseCash = 0;
    let expenseTransfer = 0;
    const expensesByCategory: Record<string, number> = {
      mercaderia: 0,
      logistica: 0,
      servicios: 0,
      marketing: 0,
      alquiler: 0,
      sueldos: 0,
      otros: 0,
    };

    for (const exp of expenses) {
      expenseTotal += exp.amount;
      if (exp.paymentMethod === 'efectivo') {
        expenseCash += exp.amount;
      } else {
        expenseTransfer += exp.amount;
      }

      const cat = exp.category || 'otros';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + exp.amount;
    }

    const netBalance = incomeTotal - expenseTotal;
    const netCash = incomeCash - expenseCash;
    const netTransfer = incomeTransfer - expenseTransfer;
    const averageTicket = orders.length > 0 ? incomeTotal / orders.length : 0;

    // Combined unified transactions for the monthly ledger
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderEntries = orders.map((o: any) => ({
      id: o._id.toString(),
      type: 'ingreso' as const,
      concept: `Venta #${o.orderNumber} - ${o.guest.name} ${o.guest.lastName}`,
      category: 'Venta de Productos',
      amount: o.total,
      paymentMethod: o.paymentMethod || 'transferencia',
      date: o.createdAt,
      details: `${o.items.reduce((s: number, i: { qty: number }) => s + i.qty, 0)} unidades`,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expenseEntries = expenses.map((e: any) => ({
      id: e._id.toString(),
      type: 'egreso' as const,
      concept: e.concept,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      date: e.date,
      notes: e.notes,
    }));

    const transactions = [...orderEntries, ...expenseEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (!isAdmin) {
      // Seller: own income only. No expenses, net, per-seller breakdown or expense entries.
      return NextResponse.json({
        ok: true,
        data: {
          period: { month, year, startDate, endDate },
          summary: {
            incomeTotal,
            incomeCash,
            incomeTransfer,
            totalOrdersCount: orders.length,
            totalPairsSold,
            averageTicket,
          },
          deviation,
          transactions: orderEntries,
        },
      });
    }

    const bySeller = [...sellers.values()].sort((a, b) => b.totalSold - a.totalSold);

    return NextResponse.json({
      ok: true,
      data: {
        period: {
          month,
          year,
          startDate,
          endDate,
        },
        summary: {
          incomeTotal,
          incomeCash,
          incomeTransfer,
          expenseTotal,
          expenseCash,
          expenseTransfer,
          netBalance,
          netCash,
          netTransfer,
          totalOrdersCount: orders.length,
          totalPairsSold,
          averageTicket,
          expensesByCategory,
        },
        transactions,
        expenses,
        deviation,
        bySeller,
      },
    });
  } catch (error) {
    console.error('Error al generar balance contable:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al generar reporte contable' },
      { status: 500 }
    );
  }
}
