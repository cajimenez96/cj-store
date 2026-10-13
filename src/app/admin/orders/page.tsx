'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import { OrderDetailModal, AdminOrderItem } from '@/components/admin/OrderDetailModal';
import { OrderEditModal } from '@/components/admin/OrderEditModal';
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  Clock,
  ShieldCheck,
  Ban,
  Plus,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_STYLES: Record<string, string> = {
  pendiente: 'bg-[#f59e0b] text-white border-[#f59e0b]',
  autorizado: 'bg-[#007d48] text-white border-[#007d48]',
  cancelado: 'bg-[#d30005] text-white border-[#d30005]',
  completada: 'bg-[#007d48] text-white border-[#007d48]',
  confirmada: 'bg-[#007d48] text-white border-[#007d48]',
  cancelada: 'bg-[#d30005] text-white border-[#d30005]',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pendiente: <Clock className="w-3 h-3" />,
  autorizado: <ShieldCheck className="w-3 h-3" />,
  cancelado: <Ban className="w-3 h-3" />,
  completada: <ShieldCheck className="w-3 h-3" />,
  cancelada: <Ban className="w-3 h-3" />,
};

import { formatPrice } from '@/utils/formatCurrency';
import { toast } from '@/components/ui/sonner';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const [selectedOrder, setSelectedOrder] = useState<AdminOrderItem | null>(null);
  const [editingOrder, setEditingOrder] = useState<AdminOrderItem | null>(null);

  const PAGE_SIZE = 25;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildParams = useCallback((targetPage: number) => {
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (selectedStatus) params.append('status', selectedStatus);
    params.append('page', targetPage.toString());
    params.append('limit', PAGE_SIZE.toString());
    return params;
  }, [searchTerm, selectedStatus]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams(1);
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setOrders(json.data);
        setPage(1);
        setHasMore(json.pagination.page < json.pagination.totalPages);
      }
    } catch (err) {
      console.error('Error al cargar solicitudes de pedidos:', err);
      toast.error('Error al cargar la lista de pedidos');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchMoreOrders = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = buildParams(nextPage);
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o._id));
          const uniqueIncoming = (json.data || []).filter((o: AdminOrderItem) => !existingIds.has(o._id));
          return [...prev, ...uniqueIncoming];
        });
        setPage(nextPage);
        setHasMore(json.pagination.page < json.pagination.totalPages);
      }
    } catch (err) {
      console.error('Error al cargar más solicitudes de pedidos:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, page, loadingMore, hasMore]);

  const onLoadMoreRef = useRef(fetchMoreOrders);
  useEffect(() => {
    onLoadMoreRef.current = fetchMoreOrders;
  }, [fetchMoreOrders]);

  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMoreRef.current?.();
        }
      },
      { rootMargin: '300px' }
    );
    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);
    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [hasMore]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleAuthorize = async (id: string, paymentMethod: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordedPaymentMethod: paymentMethod }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Error al autorizar la orden');

      toast.success(`Venta #${json.orderNumber} autorizada con éxito`, {
        description: 'El stock fue descontado automáticamente.',
      });
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al autorizar la orden');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Error al cancelar la orden');

      toast.warning(`Solicitud #${json.data.orderNumber} cancelada`, {
        description: 'La orden quedó marcada como cancelada.',
      });
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar la orden');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#111111] font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-[#111111] flex items-center gap-2">
              <ShoppingBag className="w-7 h-7" /> Solicitudes de Pedido
            </h1>
            <p className="text-xs text-[#707072] mt-1">
              Gestioná los pedidos, autorizá ventas y descontá stock en tiempo real.
            </p>
          </div>

          <Link
            href="/admin/pos"
            className="py-3 px-5 bg-[#111111] hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" /> Nueva Venta Directa
          </Link>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white border border-[#e5e5e5] p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar por #orden, cliente o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium py-2.5 pl-9 pr-4 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
            />
            <Search className="w-4 h-4 text-[#707072] absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Todas', value: '' },
              { label: 'Pendientes', value: 'pendiente' },
              { label: 'Autorizadas', value: 'autorizado' },
              { label: 'Canceladas', value: 'cancelado' },
            ].map((st) => (
              <button
                key={st.value}
                onClick={() => setSelectedStatus(st.value)}
                className={`py-2 px-3.5 text-xs font-bold uppercase tracking-wider rounded-full border transition-all ${
                  selectedStatus === st.value
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-[#f5f5f5] text-[#111111] border-[#e5e5e5] hover:border-[#111111]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-[#e5e5e5] shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-xs text-[#707072] animate-pulse">
              Cargando solicitudes de pedido...
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#707072]">
              No se encontraron solicitudes registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f5f5f5] text-[#111111] uppercase font-extrabold border-b border-[#e5e5e5]">
                  <tr>
                    <th className="py-3 px-4">N° Solicitud</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4 text-center">Ítems</th>
                    <th className="py-3 px-4 text-center">Origen</th>
                    <th className="py-3 px-4 text-right">Total ($)</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5]">
                  {orders.map((ord) => (
                    <tr key={ord._id} className="hover:bg-[#f5f5f5]/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-extrabold text-sm text-[#111111] block">
                          #{ord.orderNumber}
                        </span>
                        <span className="text-[10px] text-[#707072]">
                          {new Date(ord.createdAt).toLocaleDateString('es-AR')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-[#111111] block">
                          {ord.guest.name} {ord.guest.lastName}
                        </span>
                        <span className="text-[11px] text-[#707072]">
                          📱 {ord.guest.phone}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-[#111111]">
                        {ord.items.reduce((acc, curr) => acc + curr.qty, 0)} unidades
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ord.origin === 'admin_direct'
                            ? 'bg-[#111111] text-white'
                            : 'bg-[#f5f5f5] text-[#707072] border border-[#e5e5e5]'
                        }`}>
                          {ord.origin === 'admin_direct' ? 'Directa' : 'Web'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-extrabold text-sm text-[#111111]">
                        {formatPrice(ord.total)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold py-1 px-2.5 rounded-full border ${STATUS_STYLES[ord.status] ?? STATUS_STYLES['pendiente']}`}>
                          {STATUS_ICON[ord.status]}
                          {ord.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className="py-1.5 px-3 bg-[#f5f5f5] text-[#111111] hover:bg-[#111111] hover:text-white font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasMore && (
                <div ref={sentinelRef} className="py-4 text-center border-t border-[#e5e5e5] bg-[#fafafa]">
                  {loadingMore ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-[#707072]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#111111]" />
                      <span>Cargando más pedidos...</span>
                    </div>
                  ) : (
                    <button
                      onClick={fetchMoreOrders}
                      className="text-xs font-bold text-[#111111] hover:underline cursor-pointer"
                    >
                      Cargar más
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onAuthorize={handleAuthorize}
        onCancel={handleCancel}
        onEdit={(order) => {
          setEditingOrder(order);
          setSelectedOrder(null);
        }}
      />

      {/* Order Edit Modal */}
      <OrderEditModal
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onSaved={() => {
          toast.success('Pedido actualizado correctamente.');
          fetchOrders();
        }}
      />
    </div>
  );
}
