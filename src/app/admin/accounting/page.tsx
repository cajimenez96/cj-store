'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  Plus,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart,
  Tag,
  Receipt,
} from 'lucide-react';
import { formatPrice } from '@/utils/formatCurrency';
import { toast } from '@/components/ui/sonner';
import type { ExpenseCategory } from '@/models/Expense';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  mercaderia: 'Mercadería / Stock',
  logistica: 'Logística / Envíos',
  servicios: 'Servicios e Impuestos',
  marketing: 'Publicidad / Marketing',
  alquiler: 'Alquiler / Local',
  sueldos: 'Sueldos / Personal',
  otros: 'Otros Gastos',
};

interface TransactionItem {
  id: string;
  type: 'ingreso' | 'egreso';
  concept: string;
  category: string;
  amount: number;
  paymentMethod: string;
  date: string;
  details?: string;
  notes?: string;
}

interface AccountingData {
  period: {
    month: number;
    year: number;
  };
  summary: {
    incomeTotal: number;
    incomeCash: number;
    incomeTransfer: number;
    expenseTotal: number;
    expenseCash: number;
    expenseTransfer: number;
    netBalance: number;
    netCash: number;
    netTransfer: number;
    totalOrdersCount: number;
    totalPairsSold: number;
    averageTicket: number;
    expensesByCategory: Record<string, number>;
  };
  transactions: TransactionItem[];
}

export default function AdminAccountingPage() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter for transactions table
  const [typeFilter, setTypeFilter] = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'efectivo' | 'transferencia'>('all');

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseConcept, setExpenseConcept] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('mercaderia');
  const [expenseMethod, setExpenseMethod] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [expenseDate, setExpenseDate] = useState(today.toISOString().split('T')[0]);
  const [expenseNotes, setExpenseNotes] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);

  const fetchAccounting = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/accounting?month=${selectedMonth}&year=${selectedYear}`
      );
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        toast.error(json.message || 'Error al cargar balance contable');
      }
    } catch (err) {
      console.error('Error cargando contabilidad:', err);
      toast.error('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchAccounting();
  }, [fetchAccounting]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseConcept.trim() || !expenseAmount || Number(expenseAmount) <= 0) {
      toast.error('Completá el concepto y un monto válido');
      return;
    }

    setSavingExpense(true);
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: expenseConcept.trim(),
          category: expenseCategory,
          amount: Number(expenseAmount),
          paymentMethod: expenseMethod,
          date: expenseDate,
          notes: expenseNotes.trim(),
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Error al guardar egreso');

      toast.success('Egreso registrado correctamente');
      setIsExpenseModalOpen(false);
      // Reset form
      setExpenseConcept('');
      setExpenseAmount('');
      setExpenseCategory('mercaderia');
      setExpenseMethod('efectivo');
      setExpenseNotes('');
      fetchAccounting();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar egreso');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('¿Estás seguro de anular/eliminar este egreso de caja?')) return;

    try {
      const res = await fetch(`/api/admin/expenses?id=${expenseId}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Error al eliminar');

      toast.success('Egreso eliminado de la contabilidad');
      fetchAccounting();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const filteredTransactions = data?.transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (methodFilter !== 'all' && tx.paymentMethod !== methodFilter) return false;
    return true;
  }) || [];

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#111111] font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Header & Month Navigator */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#e5e5e5] pb-6">
          <div>
            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-[#111111] flex items-center gap-2">
              <DollarSign className="w-7 h-7" /> Control Contable & Caja Mensual
            </h1>
            <p className="text-xs text-[#707072] mt-1">
              Arqueo de ingresos y egresos, balance neto operativo y flujo de efectivo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Period Selector Controls */}
            <div className="flex items-center bg-white border border-[#e5e5e5] p-1 shadow-xs">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-[#f5f5f5] text-[#111111] transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-4 py-1 text-center min-w-[150px]">
                <span className="text-xs font-black uppercase tracking-wider text-[#111111] block">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </span>
              </div>

              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-[#f5f5f5] text-[#111111] transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Button to Current Month */}
            {(selectedMonth !== today.getMonth() + 1 || selectedYear !== today.getFullYear()) && (
              <button
                onClick={() => {
                  setSelectedMonth(today.getMonth() + 1);
                  setSelectedYear(today.getFullYear());
                }}
                className="py-2 px-3 bg-white border border-[#e5e5e5] text-xs font-bold text-[#707072] hover:text-[#111111] hover:border-[#111111] transition-colors cursor-pointer"
              >
                Mes Actual
              </button>
            )}

            {/* New Expense Button */}
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="py-2.5 px-5 bg-[#111111] hover:bg-black text-white text-xs font-extrabold uppercase tracking-wider rounded-none flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Registrar Egreso
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-xs text-[#707072] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#111111]" /> Calculando balance del período...
          </div>
        ) : data ? (
          <>
            {/* Top Financial KPI Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Ingresos Totales */}
              <div className="bg-white p-5 border border-[#e5e5e5] space-y-2 shadow-xs">
                <div className="flex justify-between items-center text-[#707072]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">
                    Total Ingresos (Ventas)
                  </span>
                  <div className="p-1.5 bg-[#007d48]/10 text-[#007d48] rounded-full">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-[#007d48]">
                  {formatPrice(data.summary.incomeTotal)}
                </div>
                <p className="text-[11px] text-[#707072] font-semibold">
                  {data.summary.totalOrdersCount} ventas ({data.summary.totalPairsSold} unidades)
                </p>
              </div>

              {/* 2. Egresos Totales */}
              <div className="bg-white p-5 border border-[#e5e5e5] space-y-2 shadow-xs">
                <div className="flex justify-between items-center text-[#707072]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">
                    Total Egresos (Gastos)
                  </span>
                  <div className="p-1.5 bg-[#d30005]/10 text-[#d30005] rounded-full">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-[#d30005]">
                  {formatPrice(data.summary.expenseTotal)}
                </div>
                <p className="text-[11px] text-[#707072] font-semibold">
                  Gastos operativos registrados
                </p>
              </div>

              {/* 3. Balance Neto */}
              <div
                className={`p-5 border space-y-2 shadow-xs ${
                  data.summary.netBalance >= 0
                    ? 'bg-[#007d48]/5 border-[#007d48]/30'
                    : 'bg-[#d30005]/5 border-[#d30005]/30'
                }`}
              >
                <div className="flex justify-between items-center text-[#707072]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#111111]">
                    Balance Neto Mensual
                  </span>
                  {data.summary.netBalance >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-[#007d48]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[#d30005]" />
                  )}
                </div>
                <div
                  className={`text-2xl font-black ${
                    data.summary.netBalance >= 0 ? 'text-[#007d48]' : 'text-[#d30005]'
                  }`}
                >
                  {formatPrice(data.summary.netBalance)}
                </div>
                <p className="text-[11px] font-bold text-[#707072]">
                  {data.summary.netBalance >= 0 ? '✓ Superávit operativo' : '⚠ Déficit en el mes'}
                </p>
              </div>

              {/* 4. Ticket Promedio */}
              <div className="bg-white p-5 border border-[#e5e5e5] space-y-2 shadow-xs">
                <div className="flex justify-between items-center text-[#707072]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">
                    Ticket Promedio
                  </span>
                  <Receipt className="w-4 h-4 text-[#111111]" />
                </div>
                <div className="text-2xl font-black text-[#111111]">
                  {formatPrice(data.summary.averageTicket)}
                </div>
                <p className="text-[11px] text-[#707072] font-semibold">
                  Promedio por venta completada
                </p>
              </div>
            </div>

            {/* Cash vs Bank Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Caja Efectivo Física */}
              <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-[#007d48]" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#111111]">
                      Caja Efectivo (En Mano)
                    </h3>
                  </div>
                  <span
                    className={`text-sm font-black ${
                      data.summary.netCash >= 0 ? 'text-[#007d48]' : 'text-[#d30005]'
                    }`}
                  >
                    Saldo: {formatPrice(data.summary.netCash)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#f5f5f5] border border-[#e5e5e5]">
                    <span className="text-[10px] text-[#707072] uppercase font-bold block">
                      Ingresos en Efectivo
                    </span>
                    <span className="font-extrabold text-[#007d48] text-base block mt-0.5">
                      +{formatPrice(data.summary.incomeCash)}
                    </span>
                  </div>
                  <div className="p-3 bg-[#f5f5f5] border border-[#e5e5e5]">
                    <span className="text-[10px] text-[#707072] uppercase font-bold block">
                      Egresos en Efectivo
                    </span>
                    <span className="font-extrabold text-[#d30005] text-base block mt-0.5">
                      -{formatPrice(data.summary.expenseCash)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Caja Banco / Transferencias */}
              <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#111111]" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#111111]">
                      Caja Banco / Transferencias
                    </h3>
                  </div>
                  <span
                    className={`text-sm font-black ${
                      data.summary.netTransfer >= 0 ? 'text-[#007d48]' : 'text-[#d30005]'
                    }`}
                  >
                    Saldo: {formatPrice(data.summary.netTransfer)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#f5f5f5] border border-[#e5e5e5]">
                    <span className="text-[10px] text-[#707072] uppercase font-bold block">
                      Cobros por Transferencia
                    </span>
                    <span className="font-extrabold text-[#007d48] text-base block mt-0.5">
                      +{formatPrice(data.summary.incomeTransfer)}
                    </span>
                  </div>
                  <div className="p-3 bg-[#f5f5f5] border border-[#e5e5e5]">
                    <span className="text-[10px] text-[#707072] uppercase font-bold block">
                      Pagos por Transferencia
                    </span>
                    <span className="font-extrabold text-[#d30005] text-base block mt-0.5">
                      -{formatPrice(data.summary.expenseTransfer)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses By Category Section */}
            {data.summary.expenseTotal > 0 && (
              <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-[#e5e5e5] pb-3">
                  <PieChart className="w-5 h-5 text-[#111111]" />
                  <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
                    Desglose de Gastos por Rubro
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => {
                    const amount = data.summary.expensesByCategory[cat] || 0;
                    const pct =
                      data.summary.expenseTotal > 0
                        ? Math.round((amount / data.summary.expenseTotal) * 100)
                        : 0;

                    return (
                      <div
                        key={cat}
                        className={`p-3 border space-y-1 ${
                          amount > 0 ? 'bg-white border-[#111111]' : 'bg-[#fafafa] border-[#e5e5e5]'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-[#707072] uppercase block truncate">
                          {CATEGORY_LABELS[cat]}
                        </span>
                        <span className="text-sm font-extrabold text-[#111111] block">
                          {formatPrice(amount)}
                        </span>
                        <span className="text-[10px] text-[#707072] block">{pct}% del total</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Monthly Journal / Ledger Table */}
            <div className="bg-white border border-[#e5e5e5] shadow-sm space-y-4 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#e5e5e5] pb-4">
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111] flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" /> Libro Diario de Movimientos ({filteredTransactions.length})
                  </h2>
                  <p className="text-xs text-[#707072]">
                    Registro cronológico de todas las ventas cobradas y gastos del mes.
                  </p>
                </div>

                {/* Table Filters */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="bg-[#f5f5f5] text-[#111111] text-xs font-bold py-2 px-3 border border-[#e5e5e5]"
                  >
                    <option value="all">Todos los Movimientos</option>
                    <option value="ingreso">Solo Ingresos (+)</option>
                    <option value="egreso">Solo Egresos (-)</option>
                  </select>

                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value as any)}
                    className="bg-[#f5f5f5] text-[#111111] text-xs font-bold py-2 px-3 border border-[#e5e5e5]"
                  >
                    <option value="all">Todos los Medios de Pago</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#707072]">
                  No se encontraron movimientos registrados para el período seleccionado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#e5e5e5] bg-[#f5f5f5] text-[#707072] uppercase text-[10px] font-extrabold tracking-wider">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Concepto</th>
                        <th className="py-3 px-4">Rubro / Categoría</th>
                        <th className="py-3 px-4">Medio de Pago</th>
                        <th className="py-3 px-4 text-right">Monto</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e5e5]">
                      {filteredTransactions.map((tx) => {
                        const isIncome = tx.type === 'ingreso';
                        const dateFormatted = new Date(tx.date).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={`${tx.type}-${tx.id}`} className="hover:bg-[#fafafa] transition-colors">
                            <td className="py-3 px-4 text-[#707072] font-mono text-[11px]">
                              {dateFormatted}
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 ${
                                  isIncome
                                    ? 'bg-[#007d48]/10 text-[#007d48]'
                                    : 'bg-[#d30005]/10 text-[#d30005]'
                                }`}
                              >
                                {isIncome ? (
                                  <>
                                    <ArrowUpRight className="w-3 h-3" /> Ingreso
                                  </>
                                ) : (
                                  <>
                                    <ArrowDownLeft className="w-3 h-3" /> Egreso
                                  </>
                                )}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-extrabold text-[#111111] block">
                                {tx.concept}
                              </span>
                              {tx.details && (
                                <span className="text-[11px] text-[#707072]">{tx.details}</span>
                              )}
                              {tx.notes && (
                                <span className="text-[11px] text-[#707072] italic block">
                                  Nota: {tx.notes}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-semibold text-[#707072] capitalize">
                                {CATEGORY_LABELS[tx.category as ExpenseCategory] || tx.category}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 font-bold text-[#111111] capitalize">
                                {tx.paymentMethod === 'efectivo' ? (
                                  <Banknote className="w-3.5 h-3.5 text-[#007d48]" />
                                ) : (
                                  <CreditCard className="w-3.5 h-3.5 text-[#111111]" />
                                )}
                                {tx.paymentMethod}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <span
                                className={`font-black text-sm ${
                                  isIncome ? 'text-[#007d48]' : 'text-[#d30005]'
                                }`}
                              >
                                {isIncome ? '+' : '-'}
                                {formatPrice(tx.amount)}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center">
                              {!isIncome ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(tx.id)}
                                  className="p-1.5 text-[#707072] hover:text-[#d30005] hover:bg-[#d30005]/10 rounded-full transition-colors cursor-pointer"
                                  title="Eliminar egreso"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-[11px] text-[#9e9ea0] font-mono">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>

      {/* Modal Registrar Nuevo Egreso */}
      {isExpenseModalOpen && (
        <ResponsiveModal
          open
          onOpenChange={(open) => !open && setIsExpenseModalOpen(false)}
          title="Registrar Egreso de Caja"
          hideTitle
          className="sm:max-w-lg p-6 gap-6"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="py-2.5 px-4 bg-[#f5f5f5] text-[#111111] text-xs font-bold uppercase transition-colors hover:bg-[#e5e5e5] cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="accounting-form"
                disabled={savingExpense}
                className="py-2.5 px-6 bg-[#111111] hover:bg-black text-white text-xs font-extrabold uppercase tracking-wider transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingExpense ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  'Guardar Egreso'
                )}
              </button>
            </div>
          }
        >
          {/* Modal Header */}
          <div className="flex justify-between items-center border-b border-[#e5e5e5] pb-3">
            <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111] flex items-center gap-2">
              <Plus className="w-5 h-5" /> Registrar Egreso de Caja
            </h2>
          </div>

          {/* Form */}
          <form id="accounting-form" onSubmit={handleCreateExpense} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                Concepto / Descripción del Gasto *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Pago a Proveedor Lote Nike, Flete Andreani, Factura de Luz..."
                value={expenseConcept}
                onChange={(e) => setExpenseConcept(e.target.value)}
                className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-semibold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                  Monto ($ ARS) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) =>
                    setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-extrabold py-2.5 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                  Rubro / Categoría *
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                  className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold py-2.5 px-3 border border-[#e5e5e5]"
                >
                  {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                  Medio de Pago Saliente *
                </label>
                <select
                  value={expenseMethod}
                  onChange={(e) => setExpenseMethod(e.target.value as 'efectivo' | 'transferencia')}
                  className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold py-2.5 px-3 border border-[#e5e5e5]"
                >
                  <option value="efectivo">Efectivo (Caja Física)</option>
                  <option value="transferencia">Transferencia Bancaria (CBU/Alias)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                  Fecha del Movimiento *
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-semibold py-2.5 px-3 border border-[#e5e5e5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                Notas / Observaciones (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Detalles adicionales, número de comprobante o remito..."
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium py-2 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111]"
              />
            </div>

          </form>
        </ResponsiveModal>
      )}
    </div>
  );
}
