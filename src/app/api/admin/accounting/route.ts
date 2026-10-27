import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Order from '@/models/Order';
import Expense from '@/models/Expense';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);

    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // 1. Fetch completed/authorized orders in the month
    const orders = await Order.find({
      status: { $in: ['autorizado', 'completada', 'confirmada'] },
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch expenses in the month
    const expenses = await Expense.find({
      date: { $gte: startDate, $lte: endDate },
    })
      .sort({ date: -1 })
      .lean();

    // Calculate Incomes
    let incomeTotal = 0;
    let incomeCash = 0;
    let incomeTransfer = 0;
    let totalPairsSold = 0;

    for (const ord of orders) {
      incomeTotal += ord.total;
      if (ord.paymentMethod === 'efectivo') {
        incomeCash += ord.total;
      } else {
        incomeTransfer += ord.total;
      }

      for (const item of ord.items) {
        totalPairsSold += item.qty;
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
      details: `${o.items.reduce((s: number, i: any) => s + i.qty, 0)} unidades`,
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
