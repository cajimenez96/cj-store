'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Tag,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface BrandItem {
  _id: string;
  name: string;
  productCount: number;
}

const ITEMS_PER_PAGE = 10;

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('');

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/brands');
      const json = await res.json();
      if (json.ok) {
        setBrands(json.data);
      }
    } catch (err) {
      console.error('Error al cargar marcas:', err);
      toast.error('Error al cargar marcas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  // Reset pagination when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Filtered brands
  const filteredBrands = useMemo(() => {
    if (!searchTerm.trim()) return brands;
    const term = searchTerm.toLowerCase().trim();
    return brands.filter((brand) => brand.name.toLowerCase().includes(term));
  }, [brands, searchTerm]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBrands = useMemo(() => {
    return filteredBrands.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredBrands, startIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) {
      toast.error('El nombre de la marca es obligatorio');
      return;
    }

    setSaving(true);

    try {
      const url = '/api/admin/brands';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, name: brandName } : { name: brandName };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || 'Error al guardar la marca');
      }

      toast.success(
        editingId ? 'Marca actualizada correctamente' : 'Marca creada exitosamente'
      );
      setBrandName('');
      setEditingId(null);
      fetchBrands();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error procesando solicitud');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (brand: BrandItem) => {
    setEditingId(brand._id);
    setBrandName(brand.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setBrandName('');
  };

  const handleDelete = async (brand: BrandItem) => {
    if (brand.productCount > 0) {
      toast.error(
        `No se puede eliminar "${brand.name}" porque tiene ${brand.productCount} productos asociados.`
      );
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la marca "${brand.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/brands?id=${brand._id}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || 'No se pudo eliminar la marca');
      }

      toast.success('Marca eliminada correctamente');
      fetchBrands();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#111111] font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-[#111111] flex items-center gap-2">
              <Tag className="w-7 h-7" /> Gestión de Marcas
            </h1>
            <p className="text-xs text-[#707072] mt-1">
              Administrá las marcas expuestas en el catálogo general.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create / Edit Form */}
          <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 h-fit shadow-xs">
            <h2 className="text-lg font-extrabold uppercase tracking-tight text-[#111111]">
              {editingId ? 'Editar Marca' : 'Nueva Marca'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                  Nombre de la Marca *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Chanel, Dior, Tom Ford..."
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-3 px-3 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !brandName.trim()}
                  className="flex-1 py-3 bg-[#111111] hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-98"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingId ? (
                    'Guardar Cambios'
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Crear Marca
                    </>
                  )}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-3 bg-[#f5f5f5] text-[#111111] font-bold text-xs uppercase tracking-wider rounded-full hover:bg-[#e5e5e5] cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Brands Table List with Search and Pagination */}
          <div className="lg:col-span-2 bg-white border border-[#e5e5e5] p-6 shadow-xs space-y-4">
            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e5e5e5]">
              <div>
                <h2 className="text-lg font-extrabold uppercase tracking-tight text-[#111111]">
                  Marcas Registradas ({brands.length})
                </h2>
                {searchTerm && (
                  <p className="text-xs text-[#707072] mt-0.5">
                    {filteredBrands.length} coincidencias encontradas
                  </p>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#707072] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar marcas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium py-2 pl-9 pr-8 border border-[#e5e5e5] rounded-full focus:outline-none focus:ring-1 focus:ring-[#111111]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#707072] hover:text-[#111111] cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-[#707072] animate-pulse">
                Cargando marcas...
              </div>
            ) : filteredBrands.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#707072] space-y-2">
                <p>
                  {searchTerm
                    ? `No se encontraron marcas con "${searchTerm}".`
                    : 'No hay marcas registradas aún.'}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-xs text-[#111111] font-bold underline cursor-pointer"
                  >
                    Limpiar filtro de búsqueda
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f5f5f5] text-[#111111] uppercase font-extrabold border-b border-[#e5e5e5]">
                      <tr>
                        <th className="py-3 px-4">Nombre</th>
                        <th className="py-3 px-4 text-center">Productos Asociados</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e5e5]">
                      {paginatedBrands.map((brand) => (
                        <tr
                          key={brand._id}
                          className="hover:bg-[#f5f5f5]/60 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-[#111111] text-sm">
                            {brand.name}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-[#f5f5f5] text-[#111111] font-extrabold px-2.5 py-1 rounded-full border border-[#e5e5e5]">
                              {brand.productCount} productos
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEdit(brand)}
                                className="p-1.5 bg-[#f5f5f5] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(brand)}
                                className="p-1.5 bg-[#f5f5f5] text-[#d30005] hover:bg-[#d30005] hover:text-white transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#e5e5e5] text-xs">
                  <span className="text-[#707072]">
                    Mostrando{' '}
                    <strong className="text-[#111111]">
                      {startIndex + 1} -{' '}
                      {Math.min(startIndex + ITEMS_PER_PAGE, filteredBrands.length)}
                    </strong>{' '}
                    de <strong className="text-[#111111]">{filteredBrands.length}</strong> marcas
                  </span>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={safeCurrentPage === 1}
                        className="p-1.5 rounded-full border border-[#e5e5e5] hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // Show first page, last page, current page, and immediate neighbors
                          if (
                            page === 1 ||
                            page === totalPages ||
                            Math.abs(page - safeCurrentPage) <= 1
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-7 h-7 text-xs font-bold rounded-full transition-colors cursor-pointer flex items-center justify-center ${
                                  safeCurrentPage === page
                                    ? 'bg-[#111111] text-white'
                                    : 'text-[#111111] hover:bg-[#f5f5f5]'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          }
                          // Render ellipsis if adjacent
                          if (page === 2 || page === totalPages - 1) {
                            return (
                              <span key={page} className="px-1 text-[#707072]">
                                ...
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={safeCurrentPage === totalPages}
                        className="p-1.5 rounded-full border border-[#e5e5e5] hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        aria-label="Página siguiente"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
