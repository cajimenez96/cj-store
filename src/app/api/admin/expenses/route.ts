import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import Expense from '@/models/Expense';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const startDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(y, m, 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const expenses = await Expense.find(query).sort({ date: -1 }).lean();
    return NextResponse.json({ ok: true, data: expenses });
  } catch (error) {
    console.error('Error al consultar gastos:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al consultar egresos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const body = await req.json();
    const { concept, category, amount, paymentMethod, date, notes } = body;

    if (!concept || !concept.trim()) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El concepto del gasto es obligatorio' },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El monto debe ser un número mayor a 0' },
        { status: 400 }
      );
    }

    const newExpense = await Expense.create({
      concept: concept.trim(),
      category: category || 'otros',
      amount: numericAmount,
      paymentMethod: paymentMethod || 'efectivo',
      date: date ? new Date(date) : new Date(),
      notes: notes ? notes.trim() : '',
    });

    return NextResponse.json({ ok: true, data: newExpense }, { status: 201 });
  } catch (error) {
    console.error('Error al registrar gasto:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al registrar el egreso' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ('response' in auth) return auth.response;
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El ID del egreso es obligatorio' },
        { status: 400 }
      );
    }

    const deleted = await Expense.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Egreso no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Egreso eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar gasto:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error al eliminar el egreso' },
      { status: 500 }
    );
  }
}
