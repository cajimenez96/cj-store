'use client';

import React, { useState, useEffect } from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  FolderTree,
  Folder,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
  X,
  Package,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface AttributeSummary {
  _id: string;
  key: string;
  label: string;
  type: string;
  options: { value: string; label: string }[];
}

interface SpecAttributeDef {
  key: string;
  required: boolean;
}

interface CategoryItem {
  _id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  ancestors: string[];
  variantAxes: string[];
  imageAxis?: string;
  specAttributes: SpecAttributeDef[];
  order: number;
  active: boolean;
  productCount?: number;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [availableAttributes, setAvailableAttributes] = useState<AttributeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [variantAxes, setVariantAxes] = useState<string[]>([]);
  const [imageAxis, setImageAxis] = useState<string>('');
  const [specAttributes, setSpecAttributes] = useState<SpecAttributeDef[]>([]);
  const [order, setOrder] = useState<number>(0);
  const [active, setActive] = useState<boolean>(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catsRes, attrsRes] = await Promise.all([
        fetch('/api/admin/categories'),
        fetch('/api/admin/attributes'),
      ]);

      const catsJson = await catsRes.json();
      const attrsJson = await attrsRes.json();

      if (catsJson.ok && Array.isArray(catsJson.data)) {
        setCategories(catsJson.data);
      }
      if (attrsJson.ok && Array.isArray(attrsJson.data)) {
        setAvailableAttributes(attrsJson.data);
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
      toast.error('Error al cargar categorías y atributos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = (parent?: CategoryItem) => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setParentId(parent ? parent._id : '');
    // Pre-populate configuration from parent if creating a subcategory
    setVariantAxes(parent ? parent.variantAxes || [] : []);
    setImageAxis(parent ? parent.imageAxis || '' : '');
    setSpecAttributes(parent ? parent.specAttributes || [] : []);
    setOrder(0);
    setActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setParentId(cat.parentId || '');
    setVariantAxes(cat.variantAxes || []);
    setImageAxis(cat.imageAxis || '');
    setSpecAttributes(cat.specAttributes || []);
    setOrder(cat.order || 0);
    setActive(cat.active ?? true);
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingCategory) {
      setSlug(slugify(val));
    }
  };

  const handleToggleVariantAxis = (axisKey: string) => {
    if (variantAxes.includes(axisKey)) {
      const updated = variantAxes.filter((a) => a !== axisKey);
      setVariantAxes(updated);
      if (imageAxis === axisKey) {
        setImageAxis('');
      }
    } else {
      setVariantAxes([...variantAxes, axisKey]);
    }
  };

  const handleToggleSpec = (specKey: string) => {
    const exists = specAttributes.some((s) => s.key === specKey);
    if (exists) {
      setSpecAttributes(specAttributes.filter((s) => s.key !== specKey));
    } else {
      setSpecAttributes([...specAttributes, { key: specKey, required: false }]);
    }
  };

  const handleToggleSpecRequired = (specKey: string) => {
    setSpecAttributes(
      specAttributes.map((s) =>
        s.key === specKey ? { ...s, required: !s.required } : s
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }
    if (!slug.trim()) {
      toast.error('El slug es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const url = editingCategory
        ? `/api/admin/categories/${editingCategory._id}`
        : '/api/admin/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const payload = {
        name: name.trim(),
        slug: slugify(slug),
        parentId: parentId || null,
        variantAxes,
        imageAxis: imageAxis || undefined,
        specAttributes,
        order: Number(order) || 0,
        active,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.message || 'Error al guardar categoría');
      }

      toast.success(
        editingCategory
          ? `Categoría "${name}" actualizada`
          : `Categoría "${name}" creada con éxito`
      );

      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: CategoryItem) => {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${cat.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/categories/${cat._id}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || 'Error al eliminar categoría');
      }

      toast.success(`Categoría "${cat.name}" eliminada`);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  // Build tree
  const rootCategories = categories.filter((c) => !c.parentId);
  const getSubcategories = (parentCatId: string) =>
    categories.filter((c) => c.parentId === parentCatId);

  // Available select attributes for variant axes
  const selectAttributes = availableAttributes.filter((a) => a.type === 'select');

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-[#e5e5e5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#111111] text-white">
              <FolderTree className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold uppercase tracking-tight text-[#111111]">
                Categorías del Catálogo
              </h1>
              <p className="text-xs text-[#707072]">
                Estructurá el árbol de categorías y configurá qué ejes de variantes (talles, colores, volumen) utilizará cada una.
              </p>
            </div>
          </div>

          <button
            onClick={() => openCreateModal()}
            className="py-3 px-5 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> Nueva Categoría Raíz
          </button>
        </div>

        {/* Tree Container */}
        {loading ? (
          <div className="bg-white border border-[#e5e5e5] p-12 text-center text-xs text-[#707072] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#111111]" /> Cargando árbol de categorías...
          </div>
        ) : rootCategories.length === 0 ? (
          <div className="bg-white border border-[#e5e5e5] p-12 text-center space-y-3">
            <Info className="w-8 h-8 text-[#707072] mx-auto" />
            <h3 className="text-sm font-extrabold uppercase text-[#111111]">
              No hay categorías creadas
            </h3>
            <p className="text-xs text-[#707072] max-w-md mx-auto">
              Empezá creando categorías principales como Calzado, Perfumería o Indumentaria.
            </p>
            <button
              onClick={() => openCreateModal()}
              className="mt-2 py-2 px-4 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Crear Primera Categoría
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {rootCategories.map((root) => {
              const subs = getSubcategories(root._id);

              return (
                <div
                  key={root._id}
                  className="bg-white border border-[#e5e5e5] shadow-xs overflow-hidden"
                >
                  {/* Root Category Row */}
                  <div className="p-4 sm:p-5 bg-[#fafafa] border-b border-[#e5e5e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <Folder className="w-5 h-5 text-[#111111]" />
                        <h2 className="text-base font-extrabold uppercase text-[#111111]">
                          {root.name}
                        </h2>
                        <span className="font-mono text-[11px] text-[#707072] bg-white px-2 py-0.5 border border-[#e5e5e5]">
                          /{root.slug}
                        </span>
                        {!root.active && (
                          <span className="text-[10px] font-bold uppercase bg-[#fee2e2] text-[#d30005] px-2 py-0.5 border border-[#fecaca]">
                            Inactiva
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#707072] pt-1">
                        {root.variantAxes && root.variantAxes.length > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-[#111111] text-white text-[11px] font-bold px-2 py-0.5">
                            Ejes: {root.variantAxes.join(', ')}
                          </span>
                        ) : (
                          <span className="text-[11px] italic text-[#707072]">
                            Sin ejes (Productos simples sin variantes)
                          </span>
                        )}

                        {root.imageAxis && (
                          <span className="text-[11px] font-bold text-[#007d48] bg-[#e6f4ea] px-2 py-0.5 border border-[#ceead6]">
                            Fotos por: {root.imageAxis}
                          </span>
                        )}

                        <span>• {root.productCount || 0} productos</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => openCreateModal(root)}
                        className="py-1.5 px-3 bg-white hover:bg-[#111111] text-[#111111] hover:text-white text-xs font-bold uppercase transition-colors border border-[#e5e5e5] flex items-center gap-1 cursor-pointer"
                        title="Añadir subcategoría"
                      >
                        <Plus className="w-3.5 h-3.5" /> Subcategoría
                      </button>
                      <button
                        onClick={() => openEditModal(root)}
                        className="p-1.5 text-[#707072] hover:text-[#111111] bg-white border border-[#e5e5e5] transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(root)}
                        className="p-1.5 text-[#707072] hover:text-[#d30005] bg-white border border-[#e5e5e5] transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subcategories List */}
                  {subs.length > 0 && (
                    <div className="divide-y divide-[#f0f0f0]">
                      {subs.map((sub) => (
                        <div
                          key={sub._id}
                          className="p-3.5 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#fcfcfc] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 pl-4 sm:pl-6">
                            <ChevronRight className="w-4 h-4 text-[#9e9ea0]" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-[#111111]">
                                  {sub.name}
                                </span>
                                <span className="font-mono text-[10px] text-[#707072]">
                                  /{sub.slug}
                                </span>
                                {!sub.active && (
                                  <span className="text-[9px] font-bold uppercase bg-[#fee2e2] text-[#d30005] px-1.5 py-0.2">
                                    Inactiva
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#707072] flex items-center gap-2 mt-0.5">
                                <span>
                                  Ejes: {sub.variantAxes?.join(', ') || 'Heredados'}
                                </span>
                                <span>• {sub.productCount || 0} productos</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <button
                              onClick={() => openEditModal(sub)}
                              className="p-1 text-[#707072] hover:text-[#111111] transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(sub)}
                              className="p-1 text-[#707072] hover:text-[#d30005] transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Create / Edit */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-[#e5e5e5] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-4">
                <h3 className="text-base font-extrabold uppercase tracking-wider text-[#111111]">
                  {editingCategory ? `Editar Categoría: ${editingCategory.name}` : 'Nueva Categoría'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#707072] hover:text-[#111111] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Nombre de la Categoría *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Zapatillas Urbanas, Fragancias Hombre, Remeras"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      required
                      className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                    />
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Slug de URL *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: zapatillas-urbanas, fragancias-hombre"
                      value={slug}
                      onChange={(e) => setSlug(slugify(e.target.value))}
                      required
                      className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-mono p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Parent Category */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Categoría Padre (Opcional)
                    </label>
                    <select
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] cursor-pointer"
                    >
                      <option value="">Ninguna (Categoría Raíz)</option>
                      {categories
                        .filter((c) => !editingCategory || c._id !== editingCategory._id)
                        .map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.ancestors.length > 0 ? '— ' : ''}{c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Order */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Orden de Visualización
                    </label>
                    <input
                      type="number"
                      value={order}
                      onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                    />
                  </div>
                </div>

                {/* Variant Axes Checkboxes */}
                <div className="border border-[#e5e5e5] bg-[#fafafa] p-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase text-[#111111]">
                      Ejes de Variantes (Combinaciones vendibles)
                    </h4>
                    <p className="text-[11px] text-[#707072]">
                      Marcá qué atributos generan variantes en los productos de esta categoría (ej: Talle, Color, Volumen). Si no seleccionás ninguno, los productos serán simples.
                    </p>
                  </div>

                  {selectAttributes.length === 0 ? (
                    <p className="text-xs text-[#9e9ea0] italic">
                      No hay atributos de tipo 'Selección'. Creá atributos primero en la sección de Atributos.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      {selectAttributes.map((attr) => {
                        const isChecked = variantAxes.includes(attr.key);
                        return (
                          <label
                            key={attr.key}
                            className={`p-2.5 border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-[#111111] text-white border-[#111111]'
                                : 'bg-white text-[#111111] border-[#e5e5e5] hover:border-[#111111]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleVariantAxis(attr.key)}
                              className="sr-only"
                            />
                            <span>{attr.label}</span>
                            <span className="text-[10px] opacity-70 ml-auto font-mono">
                              ({attr.options.length})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Image Axis Dropdown */}
                  {variantAxes.length > 0 && (
                    <div className="pt-3 border-t border-[#e5e5e5]">
                      <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                        Atributo con Fotos Diferenciadas (Opcional)
                      </label>
                      <select
                        value={imageAxis}
                        onChange={(e) => setImageAxis(e.target.value)}
                        className="w-full bg-white text-[#111111] text-xs font-bold p-2.5 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111] cursor-pointer"
                      >
                        <option value="">Ninguno (Una sola galería general para el producto)</option>
                        {variantAxes.map((axisKey) => {
                          const attr = selectAttributes.find((a) => a.key === axisKey);
                          return (
                            <option key={axisKey} value={axisKey}>
                              {attr?.label || axisKey} (ej: fotos específicas por {attr?.label || axisKey})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {/* Spec Attributes Checkboxes */}
                <div className="border border-[#e5e5e5] bg-[#fafafa] p-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase text-[#111111]">
                      Especificaciones de Ficha Técnica
                    </h4>
                    <p className="text-[11px] text-[#707072]">
                      Campos descriptivos que aparecerán en la ficha del producto (ej: Género, Material, Tipo de piel).
                    </p>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                    {availableAttributes.map((attr) => {
                      const specEntry = specAttributes.find((s) => s.key === attr.key);
                      const isChecked = Boolean(specEntry);

                      return (
                        <div
                          key={attr.key}
                          className="flex items-center justify-between p-2 bg-white border border-[#e5e5e5]"
                        >
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#111111]">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSpec(attr.key)}
                              className="w-4 h-4 text-[#111111] focus:ring-[#111111]"
                            />
                            <span>{attr.label}</span>
                            <span className="font-mono text-[10px] text-[#707072]">
                              ({attr.type})
                            </span>
                          </label>

                          {isChecked && (
                            <label className="flex items-center gap-1.5 text-[11px] text-[#707072] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={specEntry?.required || false}
                                onChange={() => handleToggleSpecRequired(attr.key)}
                                className="w-3.5 h-3.5"
                              />
                              <span>Obligatorio</span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3 bg-[#fafafa] border border-[#e5e5e5]">
                  <div>
                    <h5 className="text-xs font-bold uppercase text-[#111111]">Categoría Activa</h5>
                    <p className="text-[11px] text-[#707072]">Visible en la tienda pública y filtros de navegación</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="w-4 h-4 text-[#111111] focus:ring-[#111111] cursor-pointer"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e5e5e5]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-2.5 px-4 bg-white hover:bg-[#f5f5f5] text-[#111111] text-xs font-bold uppercase border border-[#e5e5e5] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="py-2.5 px-6 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
