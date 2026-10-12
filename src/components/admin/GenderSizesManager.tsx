'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, X, RotateCcw, Save, Loader2, Trash2, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

export const GenderSizesManager: React.FC = () => {
  const [sizesByGender, setSizesByGender] = useState<Record<string, number[]>>({});
  const [newSizeInputs, setNewSizeInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingGender, setSavingGender] = useState<string | null>(null);
  const [deletingGender, setDeletingGender] = useState<string | null>(null);

  // New Gender creation state
  const [showAddGender, setShowAddGender] = useState(false);
  const [newGenderName, setNewGenderName] = useState('');
  const [creatingGender, setCreatingGender] = useState(false);

  const fetchSizes = async () => {
    try {
      const res = await fetch('/api/admin/sizes');
      const json = await res.json();
      if (json.ok && json.data) {
        setSizesByGender(json.data);
      }
    } catch (err) {
      console.error('Error al cargar géneros y talles:', err);
      toast.error('Error al cargar escalas de talles y géneros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSizes();
  }, []);

  const handleCreateGender = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGenderName.trim();
    if (!name) {
      toast.error('Ingresá el nombre del género (ej: Unisex, Hombre, Kids)');
      return;
    }

    if (sizesByGender[name]) {
      toast.error(`El género "${name}" ya existe`);
      return;
    }

    setCreatingGender(true);
    try {
      const res = await fetch('/api/admin/sizes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender: name, sizes: [] }),
      });
      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || 'Error al crear género');
      }

      setSizesByGender((prev) => ({ ...prev, [name]: [] }));
      setNewGenderName('');
      setShowAddGender(false);
      toast.success(`Género "${name}" creado exitosamente`, {
        description: 'Podés dejarlo sin talles para perfumes o sumarle talles numéricos.',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear género');
    } finally {
      setCreatingGender(false);
    }
  };

  const handleDeleteGender = async (gender: string) => {
    if (!confirm(`¿Estás seguro de eliminar el género "${gender}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingGender(gender);
    try {
      const res = await fetch(`/api/admin/sizes?gender=${encodeURIComponent(gender)}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || 'Error al eliminar género');
      }

      setSizesByGender((prev) => {
        const copy = { ...prev };
        delete copy[gender];
        return copy;
      });
      toast.success(`Género "${gender}" eliminado correctamente`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeletingGender(null);
    }
  };

  const handleAddSize = (gender: string) => {
    const rawVal = (newSizeInputs[gender] || '').trim();
    if (!rawVal) return;

    const num = Number(rawVal);
    if (isNaN(num) || num <= 0 || num > 70) {
      toast.error('Ingresá un número de talle válido (ej: 38, 41.5)');
      return;
    }

    const current = sizesByGender[gender] || [];
    if (current.includes(num)) {
      toast.error(`El talle ${num} ya existe en ${gender}`);
      return;
    }

    const updated = [...current, num].sort((a, b) => a - b);
    setSizesByGender((prev) => ({ ...prev, [gender]: updated }));
    setNewSizeInputs((prev) => ({ ...prev, [gender]: '' }));
  };

  const handleRemoveSize = (gender: string, sizeToRemove: number) => {
    const current = sizesByGender[gender] || [];
    const updated = current.filter((s) => s !== sizeToRemove);
    setSizesByGender((prev) => ({ ...prev, [gender]: updated }));
  };

  const handleClearAllSizes = (gender: string) => {
    setSizesByGender((prev) => ({ ...prev, [gender]: [] }));
    toast.info(`Talles de ${gender} vaciados. Guardá para aplicar.`);
  };

  const handleSaveGender = async (gender: string) => {
    setSavingGender(gender);
    try {
      const res = await fetch('/api/admin/sizes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender,
          sizes: sizesByGender[gender] || [],
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Error al guardar');

      toast.success(`Configuración de ${gender} guardada con éxito`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingGender(null);
    }
  };

  const handleResetGender = async (gender: string) => {
    if (!confirm(`¿Restablecer los talles de ${gender} a los valores predeterminados?`)) return;

    setSavingGender(gender);
    try {
      const res = await fetch('/api/admin/sizes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender,
          reset: true,
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.message || 'Error al restablecer');

      if (json.data && Array.isArray(json.data.sizes)) {
        setSizesByGender((prev) => ({ ...prev, [gender]: json.data.sizes }));
      } else {
        await fetchSizes();
      }

      toast.success(`Talles de ${gender} restablecidos`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al restablecer');
    } finally {
      setSavingGender(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#e5e5e5] p-6 text-center text-xs text-[#707072] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando gestión de géneros y talles...
      </div>
    );
  }

  const genderList = Object.keys(sizesByGender).sort();

  return (
    <div className="bg-white border border-[#e5e5e5] p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="border-b border-[#e5e5e5] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-[#007d48]" />
          <div>
            <h2 className="text-base font-extrabold uppercase tracking-wider text-[#111111]">
              Gestión de Géneros y Escalas de Talles (ABM)
            </h2>
            <p className="text-xs text-[#707072]">
              Configurá los géneros de tu catálogo. Un género puede usarse con talles numéricos (calzado) o <strong>sin ningún talle</strong> (perfumes y cosmética).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddGender(!showAddGender)}
          className="self-start sm:self-auto py-2 px-3.5 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo Género
        </button>
      </div>

      {/* New Gender Inline Form */}
      {showAddGender && (
        <form
          onSubmit={handleCreateGender}
          className="p-4 bg-[#f9f9f9] border border-[#e5e5e5] flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="flex-1 w-full">
            <label className="block text-[11px] font-bold uppercase text-[#707072] mb-1">
              Nombre del Nuevo Género
            </label>
            <input
              type="text"
              placeholder="Ej: Unisex, Kids, Hogar, Edición Limitada"
              value={newGenderName}
              onChange={(e) => setNewGenderName(e.target.value)}
              className="w-full bg-white text-xs font-bold text-[#111111] p-2.5 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111]"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto pt-1 sm:pt-4">
            <button
              type="submit"
              disabled={creatingGender}
              className="flex-1 sm:flex-none py-2.5 px-4 bg-[#007d48] hover:bg-[#00663a] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {creatingGender ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Crear Género
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddGender(false);
                setNewGenderName('');
              }}
              className="py-2.5 px-3 bg-white hover:bg-[#f0f0f0] text-[#707072] text-xs font-bold border border-[#e5e5e5] cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Genders Grid */}
      {genderList.length === 0 ? (
        <div className="text-center py-8 text-xs text-[#707072] border border-dashed border-[#e5e5e5]">
          No hay géneros creados. Hacé clic en <strong>Nuevo Género</strong> para añadir uno.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {genderList.map((gender) => {
            const sizes = sizesByGender[gender] || [];
            const isSaving = savingGender === gender;
            const isDeleting = deletingGender === gender;
            const hasNoSizes = sizes.length === 0;

            return (
              <div
                key={gender}
                className="border border-[#e5e5e5] bg-[#fafafa] p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between border-b border-[#e5e5e5] pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold uppercase text-[#111111]">
                          {gender}
                        </h3>
                        {hasNoSizes ? (
                          <span className="inline-flex items-center gap-1 bg-[#e6f4ea] text-[#007d48] text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-[#ceead6]">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Sin talles (Perfumes)
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#707072] lowercase">
                            ({sizes.length} talles)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#707072] mt-0.5">
                        {hasNoSizes
                          ? 'Los productos de este género no exigen talles de calzado.'
                          : 'Escala numérica para productos que utilicen talles.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteGender(gender)}
                      disabled={isDeleting || isSaving}
                      className="text-[#9e9ea0] hover:text-[#d30005] p-1 transition-colors cursor-pointer disabled:opacity-50"
                      title={`Eliminar género ${gender}`}
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Chips Container */}
                  <div className="min-h-[48px] p-2 bg-white border border-[#e5e5e5] flex flex-wrap items-center gap-1.5">
                    {hasNoSizes ? (
                      <span className="text-xs text-[#707072] italic flex items-center gap-1">
                        ✨ No tiene talles asignados (Modo perfume / directo activo)
                      </span>
                    ) : (
                      sizes.map((size) => (
                        <span
                          key={size}
                          className="inline-flex items-center gap-1 bg-[#111111] text-white text-xs font-extrabold px-2.5 py-1 rounded-none shadow-xs group"
                        >
                          {size}
                          <button
                            type="button"
                            onClick={() => handleRemoveSize(gender, size)}
                            className="text-[#9e9ea0] hover:text-white transition-colors cursor-pointer"
                            title={`Eliminar talle ${size}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add Size or Clear Sizes */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Añadir talle (ej: 42.5)"
                      value={newSizeInputs[gender] || ''}
                      onChange={(e) =>
                        setNewSizeInputs((prev) => ({ ...prev, [gender]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSize(gender);
                        }
                      }}
                      className="flex-1 min-w-[140px] bg-white text-[#111111] text-xs font-semibold py-2 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSize(gender)}
                      className="py-2 px-3 bg-[#f5f5f5] hover:bg-[#111111] text-[#111111] hover:text-white text-xs font-bold uppercase transition-colors flex items-center gap-1 border border-[#e5e5e5] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>

                    {!hasNoSizes && (
                      <button
                        type="button"
                        onClick={() => handleClearAllSizes(gender)}
                        className="py-2 px-2.5 bg-white hover:bg-[#fee2e2] text-[#d30005] text-[11px] font-bold uppercase transition-colors border border-[#fecaca] cursor-pointer"
                        title="Quitar todos los talles para dejar este género exclusivo para perfumes"
                      >
                        Vaciar Talles
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-[#e5e5e5] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleResetGender(gender)}
                    disabled={isSaving}
                    className="text-[11px] font-bold text-[#707072] hover:text-[#111111] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    title="Restablecer a escala estándar inicial"
                  >
                    <RotateCcw className="w-3 h-3" /> Restablecer
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveGender(gender)}
                    disabled={isSaving}
                    className="py-1.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" /> Guardar Género
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
