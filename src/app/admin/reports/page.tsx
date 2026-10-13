'use client';

import React, { useState, useEffect } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import { BarChart3, DollarSign, ShoppingBag, TrendingUp, CreditCard, Banknote, Loader2 } from 'lucide-react';
import { formatPrice } from '@/utils/formatCurrency';

interface ReportData {
  totalRevenue: number;
  pendingRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  transferSales: number;
  cashSales: number;
  topProducts: Array<{ name: string; qty: number; totalAmount: number }>;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('/api/admin/reports');
        const json = await res.json();
        if (json.ok) {
          setReports(json.data);
        }
      } catch (err) {
        console.error('Error al cargar reportes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#111111] font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-[#111111] flex items-center gap-2">
            <BarChart3 className="w-7 h-7" /> Panel de Reportes & Métricas
          </h1>
          <p className="text-xs text-[#707072] mt-1">
            Resumen estadístico de ventas facturadas, volumen de pedidos y productos estrella.
          </p>
        </div>

        {loading ? (
          <div className="py-24 text-center text-xs text-[#707072] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Generando reportes estadísticos...
          </div>
        ) : reports ? (
          <>
            {/* KPI Metrics Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Facturado */}
              <div className="bg-white p-5 border border-[#e5e5e5] space-y-2 shadow-sm">
                <div className="flex justify-between items-center text-[#707072]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">
                    Ventas Facturadas
                  </span>
                  <DollarSign className="w-5 h-5 text-[#007d48]" />
                </div>
                <div className="text-2xl font-extrabold text-[#111111]">
                  {formatPrice(reports.totalRevenue)}
                </div>
                <p className="text-[11px] text-[#007d48] font-bold">
                  {reports.completedOrders} pedidos completados
                </p>
              </div>

              {/* Pendiente de Cobro */}
              <div className="bg-white p-5 border border-[#e5e5e5] space-y-2 shadow-sm">
                <div className="flex justify-between items-center text-[#707072]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">
                    Monto Pendiente
                  </span>
                  <TrendingUp className="w-5 h-5 text-[#f59e0b]" />
                </div>
                <div className="text-2xl font-extrabold text-[#111111]">
                  {formatPrice(reports.pendingRevenue)}
                </div>
                <p className="text-[11px] text-[#f59e0b] font-bold">
                  {reports.pendingOrders} pedidos pendientes
                </p>
              </div>

              {/* Total Solicitudes */}
              <div className="bg-white p-5 border border-[#e5e5e5] space-y-2 shadow-sm">
                <div className="flex justify-between items-center text-[#707072]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">
                    Total Solicitudes
                  </span>
                  <ShoppingBag className="w-5 h-5 text-[#111111]" />
                </div>
                <div className="text-2xl font-extrabold text-[#111111]">
                  {reports.totalOrders}
                </div>
                <p className="text-[11px] text-[#707072] font-semibold">
                  {reports.cancelledOrders} canceladas
                </p>
              </div>

              {/* Efectividad de Conversión */}
              <div className="bg-white p-5 border border-[#e5e5e5] space-y-2 shadow-sm">
                <div className="flex justify-between items-center text-[#707072]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">
                    Tasa de Cierre
                  </span>
                  <BarChart3 className="w-5 h-5 text-[#111111]" />
                </div>
                <div className="text-2xl font-extrabold text-[#111111]">
                  {reports.totalOrders > 0
                    ? Math.round((reports.completedOrders / reports.totalOrders) * 100)
                    : 0}%
                </div>
                <p className="text-[11px] text-[#707072] font-semibold">
                  De conversión a venta
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Top Selling Products List */}
              <div className="lg:col-span-2 bg-white border border-[#e5e5e5] p-6 shadow-sm space-y-4">
                <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
                  Top 5 Modelos más Vendidos
                </h2>

                {reports.topProducts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#707072]">
                    No hay ventas completadas registradas para calcular el ranking.
                  </div>
                ) : (
                  <div className="divide-y divide-[#e5e5e5]">
                    {reports.topProducts.map((prod, idx) => (
                      <div key={idx} className="py-3 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#111111] text-white font-extrabold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-[#111111]">{prod.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-sm text-[#111111] block">
                            {formatPrice(prod.totalAmount)}
                          </span>
                          <span className="text-[10px] text-[#707072] font-semibold">
                            {prod.qty} unidades vendidas
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Methods Breakdown */}
              <div className="bg-white border border-[#e5e5e5] p-6 shadow-sm space-y-4">
                <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
                  Ventas por Medio de Pago
                </h2>

                <div className="space-y-4">
                  <div className="p-4 bg-[#f5f5f5] border border-[#e5e5e5] flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-[#111111]" />
                      <div>
                        <span className="text-xs font-bold text-[#111111] block">
                          Transferencia Bancaria
                        </span>
                        <span className="text-[10px] text-[#707072]">CBU / Alias</span>
                      </div>
                    </div>
                    <span className="font-extrabold text-base text-[#111111]">
                      {formatPrice(reports.transferSales)}
                    </span>
                  </div>

                  <div className="p-4 bg-[#f5f5f5] border border-[#e5e5e5] flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Banknote className="w-5 h-5 text-[#007d48]" />
                      <div>
                        <span className="text-xs font-bold text-[#111111] block">
                          Efectivo
                        </span>
                        <span className="text-[10px] text-[#707072]">Pago en mano</span>
                      </div>
                    </div>
                    <span className="font-extrabold text-base text-[#111111]">
                      {formatPrice(reports.cashSales)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
