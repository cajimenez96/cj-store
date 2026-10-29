'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AdminNav } from '@/components/admin/AdminNav';
import {
  Plus,
  Edit2,
  Package,
  Search,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

import { formatPrice } from '@/utils/formatCurrency';
import { toast } from '@/components/ui/sonner';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

interface AdminProductItem {
  _id: string;
  name: string;
  price?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  active: boolean;
  brandId: { _id: string; name: string } | string;
  categoryId?: { _id: string; name: string } | string;
  specs?: Array<{ key: string; value: string | number | boolean }>;
  images: Array<{ url: string; isPrincipal: boolean }>;
  totalStock: number;
  isClearance?: boolean;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [genderOptions, setGenderOptions] = useState<{ value: string; label: string }[]>([]);

  // Delete modal state
  const [productToDelete, setProductToDelete] = useState<AdminProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PAGE_SIZE = 25;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildParams = useCallback((targetPage: number) => {
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (selectedGender) params.append('gender', selectedGender);
    if (selectedStatus) params.append('active', selectedStatus);
    params.append('page', targetPage.toString());
    params.append('limit', PAGE_SIZE.toString());
    return params;
  }, [searchTerm, selectedGender, selectedStatus]);

  // Gender filter options come from the "genero" attribute
  useEffect(() => {
    fetch('/api/admin/attributes')
      .then((res) => res.json())
      .then((json) => {
        const genderAttr = json.ok
          ? json.data.find((a: { key: string }) => a.key === 'genero')
          : null;
        setGenderOptions(
          (genderAttr?.options ?? []).filter((o: { active: boolean }) => o.active)
        );
      })
      .catch((err) => console.error('Error cargando opciones de género:', err));
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams(1);
      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setProducts(json.data);
        setPage(1);
        setHasMore(json.pagination.page < json.pagination.totalPages);
      }
    } catch (err) {
      console.error('Error cargando productos:', err);
      toast.error('Error al cargar productos del catálogo');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = buildParams(nextPage);
      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p._id));
          const uniqueIncoming = (json.data || []).filter((p: AdminProductItem) => !existingIds.has(p._id));
          return [...prev, ...uniqueIncoming];
        });
        setPage(nextPage);
        setHasMore(json.pagination.page < json.pagination.totalPages);
      }
    } catch (err) {
      console.error('Error al cargar más productos:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, page, loadingMore, hasMore]);

  const onLoadMoreRef = useRef(fetchMoreProducts);
  useEffect(() => {
    onLoadMoreRef.current = fetchMoreProducts;
  }, [fetchMoreProducts]);

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
    fetchProducts();
  }, [fetchProducts]);

  const toggleStatus = async (product: AdminProductItem) => {
    try {
      const res = await fetch(`/api/admin/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: product._id,
          active: !product.active,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        const msg = !product.active
          ? `Producto "${product.name}" activado`
          : `Producto "${product.name}" desactivado`;
        toast.success(msg, {
          description: !product.active ? 'Visible en catálogo.' : 'Oculto del catálogo.',
        });
        fetchProducts();
      } else {
        throw new Error(json.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/products?id=${productToDelete._id}&permanent=true`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (json.ok) {
        if (json.mode === 'deleted') {
          toast.success('Producto eliminado permanentemente');
        } else {
          toast.info(json.message || 'Producto desactivado');
        }
        setProductToDelete(null);
        fetchProducts();
      } else {
        throw new Error(json.message || 'No se pudo eliminar el producto');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar producto');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#111111] font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Header & Main Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-[#111111] flex items-center gap-2">
              <Package className="w-7 h-7" /> Catálogo de Productos
            </h1>
            <p className="text-xs text-[#707072] mt-1">
              Administrá los productos, precios, imágenes y stock por variante.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/products/new"
              className="py-2.5 px-5 bg-[#111111] hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" /> Nuevo Producto
            </Link>
          </div>
        </div>

        {/* Filters & Search Controls Bar */}
        <div className="bg-white border border-[#e5e5e5] p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium py-2.5 pl-9 pr-4 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
            />
            <Search className="w-4 h-4 text-[#707072] absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {genderOptions.length > 0 && (
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="bg-[#f5f5f5] text-[#111111] text-xs font-bold py-2.5 px-3 rounded-none border border-[#e5e5e5]"
              >
                <option value="">-- Todos los Géneros --</option>
                {genderOptions.map((option) => (
                  <option key={option.value} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#f5f5f5] text-[#111111] text-xs font-bold py-2.5 px-3 rounded-none border border-[#e5e5e5]"
            >
              <option value="">-- Estado --</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Products List Table */}
        <div className="bg-white border border-[#e5e5e5] shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-xs text-[#707072] animate-pulse">
              Cargando catálogo de productos...
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#707072]">
              No se encontraron productos registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f5f5f5] text-[#111111] uppercase font-extrabold border-b border-[#e5e5e5]">
                  <tr>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Marca / Categoría</th>
                    <th className="py-3 px-4 text-center">Género</th>
                    <th className="py-3 px-4 text-right">Precio</th>
                    <th className="py-3 px-4 text-center">Stock Total</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5]">
                  {products.map((prod) => {
                    const brandName =
                      typeof prod.brandId === 'object' && prod.brandId !== null
                        ? prod.brandId.name
                        : '-';
                    const categoryName =
                      typeof prod.categoryId === 'object' && prod.categoryId !== null
                        ? prod.categoryId.name
                        : '-';
                    const genderValue = prod.specs?.find((s) => s.key === 'genero')?.value;
                    const genderLabel =
                      genderOptions.find((o) => o.value === genderValue)?.label ??
                      (typeof genderValue === 'string' ? genderValue : '-');
                    const mainImage =
                      prod.images.find((img) => img.isPrincipal)?.url ||
                      prod.images[0]?.url ||
                      '';

                    return (
                      <tr key={prod._id} className="hover:bg-[#f5f5f5]/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 bg-[#f5f5f5] flex-shrink-0 border border-[#e5e5e5]">
                              {mainImage && (
                                <Image
                                  src={mainImage}
                                  alt={prod.name}
                                  fill
                                  sizes="48px"
                                  className="object-cover object-center"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-extrabold text-sm text-[#111111] truncate">
                                {prod.name}
                              </span>
                              {prod.isClearance && (
                                <span className="bg-[#d30005] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                                  🔥 LIQ
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-[#707072] font-semibold">
                          <div>{brandName}</div>
                          <div className="text-[10px] text-[#707072]">{categoryName}</div>
                        </td>

                        <td className="py-3 px-4 text-center font-bold text-[#111111]">
                          {genderLabel}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {prod.isClearance ? (
                            <div>
                              <div className="font-extrabold text-sm text-[#d30005]">
                                {formatPrice(prod.wholesalePrice ?? prod.retailPrice ?? prod.price)}
                              </div>
                              <div className="text-[10px] font-extrabold text-[#d30005] uppercase">
                                Liquidación
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="font-extrabold text-sm text-[#111111]">
                                {formatPrice(prod.retailPrice ?? prod.price)}
                              </div>
                              {(prod.wholesalePrice !== undefined && prod.wholesalePrice !== null) && (
                                <div className="text-[10px] font-bold text-[#007d48]">
                                  May: {formatPrice(prod.wholesalePrice)}
                                </div>
                              )}
                            </>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-extrabold px-2.5 py-1 rounded-full text-[11px] border ${
                              prod.totalStock > 0
                                ? 'bg-[#f5f5f5] text-[#111111] border-[#e5e5e5]'
                                : 'bg-[#d30005]/10 text-[#d30005] border-[#d30005]'
                            }`}
                          >
                            {prod.totalStock} unidades
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {prod.active ? (
                            <span className="bg-[#007d48] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                              ACTIVO
                            </span>
                          ) : (
                            <span className="bg-[#707072] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                              INACTIVO
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => toggleStatus(prod)}
                              className={`p-1.5 rounded-full transition-colors ${
                                prod.active
                                  ? 'bg-[#007d48] text-white'
                                  : 'bg-[#f5f5f5] text-[#707072] border border-[#e5e5e5]'
                              }`}
                              title={prod.active ? 'Desactivar producto' : 'Activar producto'}
                            >
                              {prod.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>

                            <Link
                              href={`/admin/products/${prod._id}/edit`}
                              className="p-1.5 bg-[#f5f5f5] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
                              title="Editar producto"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Link>

                            <button
                              onClick={() => setProductToDelete(prod)}
                              className="p-1.5 bg-[#f5f5f5] text-[#707072] hover:bg-[#d30005] hover:text-white transition-colors cursor-pointer"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {hasMore && (
                <div ref={sentinelRef} className="py-4 text-center border-t border-[#e5e5e5] bg-[#fafafa]">
                  {loadingMore ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-[#707072]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#111111]" />
                      <span>Cargando más productos...</span>
                    </div>
                  ) : (
                    <button
                      onClick={fetchMoreProducts}
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

      {/* Confirmation Modal for Product Deletion */}
      {productToDelete && (
        <ResponsiveModal
          open
          onOpenChange={(open) => !open && setProductToDelete(null)}
          title="Eliminar producto"
          hideTitle
          className="sm:max-w-md p-6 gap-4"
        >
          <div className="flex items-center gap-3 text-[#d30005]">
            <div className="p-2 bg-[#d30005]/10 rounded-full">
              <AlertTriangle className="w-6 h-6 text-[#d30005]" />
            </div>
            <h3 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
              ¿Eliminar Producto?
            </h3>
          </div>

          <div className="space-y-2 text-xs text-[#707072]">
            <p>
              Estás a punto de eliminar{' '}
              <strong className="text-[#111111] font-bold">{productToDelete.name}</strong>.
            </p>
            <p>
              Si este producto no tiene ventas registradas, se eliminará permanentemente de la base de datos.
              Si ya cuenta con historial de pedidos, se desactivará automáticamente para preservar los reportes.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setProductToDelete(null)}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-bold text-[#111111] bg-[#f5f5f5] hover:bg-[#e5e5e5] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteProduct}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-bold text-white bg-[#d30005] hover:bg-[#b00004] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
            </button>
          </div>
        </ResponsiveModal>
      )}
    </div>
  );
}
