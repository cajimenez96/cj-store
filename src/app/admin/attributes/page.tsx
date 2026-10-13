"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  Info,
  Search,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface AttributeOption {
  value: string;
  label: string;
  order: number;
  hex?: string;
  active: boolean;
}

interface AttributeItem {
  _id: string;
  key: string;
  label: string;
  type: "select" | "text" | "number" | "boolean";
  options: AttributeOption[];
  unit?: string;
  filterable: boolean;
  usedInCount?: number;
  usedInCategories?: string[];
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w_]+/g, "");
}

const ITEMS_PER_PAGE = 10;

export default function AdminAttributesPage() {
  const [attributes, setAttributes] = useState<AttributeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<AttributeItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState<"select" | "text" | "number" | "boolean">(
    "select",
  );
  const [unit, setUnit] = useState("");
  const [filterable, setFilterable] = useState(false);
  const [options, setOptions] = useState<AttributeOption[]>([]);

  // New Option input state
  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptHex, setNewOptHex] = useState("");

  const fetchAttributes = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/attributes");
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setAttributes(json.data);
      }
    } catch (err) {
      console.error("Error al cargar atributos:", err);
      toast.error("Error al cargar atributos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributes();
  }, []);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredAttributes = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return attributes;
    return attributes.filter(
      (a) =>
        a.label.toLowerCase().includes(q) || a.key.toLowerCase().includes(q),
    );
  }, [attributes, searchTerm]);

  const totalPages = Math.ceil(filteredAttributes.length / ITEMS_PER_PAGE);

  const paginatedAttributes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAttributes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAttributes, currentPage]);

  const openCreateModal = () => {
    setEditingAttr(null);
    setLabel("");
    setKey("");
    setType("select");
    setUnit("");
    setFilterable(false);
    setOptions([]);
    setIsModalOpen(true);
  };

  const openEditModal = (attr: AttributeItem) => {
    setEditingAttr(attr);
    setLabel(attr.label);
    setKey(attr.key);
    setType(attr.type);
    setUnit(attr.unit || "");
    setFilterable(attr.filterable);
    setOptions(attr.options || []);
    setIsModalOpen(true);
  };

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (!editingAttr) {
      setKey(slugify(val));
    }
  };

  const handleAddOption = () => {
    const optLabelTrimmed = newOptLabel.trim();
    if (!optLabelTrimmed) {
      toast.error("Ingresá una etiqueta para la opción");
      return;
    }

    const optVal = slugify(optLabelTrimmed);
    if (options.some((o) => o.value === optVal)) {
      toast.error(`La opción "${optVal}" ya existe en este atributo`);
      return;
    }

    const newOpt: AttributeOption = {
      value: optVal,
      label: optLabelTrimmed,
      order: options.length,
      hex: newOptHex.trim() || undefined,
      active: true,
    };

    setOptions([...options, newOpt]);
    setNewOptLabel("");
    setNewOptHex("");
  };

  const handleRemoveOption = (valToRemove: string) => {
    setOptions(options.filter((o) => o.value !== valToRemove));
  };

  const handleToggleOptionActive = (val: string) => {
    setOptions(
      options.map((o) => (o.value === val ? { ...o, active: !o.active } : o)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("El nombre del atributo es obligatorio");
      return;
    }

    if (!editingAttr && !key.trim()) {
      toast.error("El identificador (key) es obligatorio");
      return;
    }

    if (type === "select" && options.length === 0) {
      toast.warning(
        "Los atributos de tipo selección deben tener al menos una opción",
      );
      return;
    }

    setSaving(true);
    try {
      const url = editingAttr
        ? `/api/admin/attributes/${editingAttr._id}`
        : "/api/admin/attributes";
      const method = editingAttr ? "PUT" : "POST";

      const payload = editingAttr
        ? {
            label: label.trim(),
            options,
            unit: unit.trim(),
            filterable,
          }
        : {
            key: key.trim().toLowerCase(),
            label: label.trim(),
            type,
            options,
            unit: unit.trim(),
            filterable,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.message || "Error al guardar atributo");
      }

      toast.success(
        editingAttr
          ? `Atributo "${label}" actualizado`
          : `Atributo "${label}" creado correctamente`,
      );

      setIsModalOpen(false);
      await fetchAttributes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (attr: AttributeItem) => {
    if (!confirm(`¿Estás seguro de eliminar el atributo "${attr.label}"?`))
      return;

    try {
      const res = await fetch(`/api/admin/attributes/${attr._id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || "Error al eliminar atributo");
      }

      toast.success(`Atributo "${attr.label}" eliminado`);
      await fetchAttributes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-[#e5e5e5] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#111111] text-white">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold uppercase tracking-tight text-[#111111]">
                Atributos del Catálogo
              </h1>
              <p className="text-xs text-[#707072]">
                Definí dimensiones de variación (Talle, Color, Volumen) y
                especificaciones técnicas para tus categorías.
              </p>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="py-3 px-5 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> Nuevo Atributo
          </button>
        </div>

        {/* Search Bar */}
        {!loading && attributes.length > 0 && (
          <div className="bg-white border border-[#e5e5e5] shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707072]" />
                <input
                  type="text"
                  placeholder="Buscar atributo por nombre o clave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs font-semibold bg-[#f5f5f5] text-[#111111] border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] placeholder:text-[#707072]"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707072] hover:text-[#111111] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <span className="text-xs text-[#707072] whitespace-nowrap">
                {filteredAttributes.length} de {attributes.length} atributos
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="bg-white border border-[#e5e5e5] p-12 text-center text-xs text-[#707072] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#111111]" /> Cargando
            atributos...
          </div>
        ) : attributes.length === 0 ? (
          <div className="bg-white border border-[#e5e5e5] p-12 text-center space-y-3">
            <Info className="w-8 h-8 text-[#707072] mx-auto" />
            <h3 className="text-sm font-extrabold uppercase text-[#111111]">
              No hay atributos registrados
            </h3>
            <p className="text-xs text-[#707072] max-w-md mx-auto">
              Creá atributos como Color, Talle o Volumen para permitir que tus
              categorías generen variantes de producto.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-2 py-2 px-4 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Crear Primer Atributo
            </button>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paginatedAttributes.length === 0 ? (
                <div className="col-span-2 bg-white border border-[#e5e5e5] p-12 text-center space-y-2">
                  <Search className="w-8 h-8 text-[#707072] mx-auto" />
                  <p className="text-sm font-extrabold uppercase text-[#111111]">
                    Sin resultados
                  </p>
                  <p className="text-xs text-[#707072]">
                    No hay atributos que coincidan con &quot;{searchTerm}&quot;.
                  </p>
                </div>
              ) : (
                paginatedAttributes.map((attr) => {
                  const isSelect = attr.type === "select";
              const optionsCount = attr.options?.length || 0;
                  const isColor = attr.key.toLowerCase().includes("color");

              return (
                <div
                  key={attr._id}
                  className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-[#e5e5e5] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-extrabold uppercase text-[#111111]">
                            {attr.label}
                          </h2>
                          <span className="font-mono text-[11px] text-[#707072] bg-[#f5f5f5] px-2 py-0.5 border border-[#e5e5e5]">
                            key: {attr.key}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[#707072]">
                          <span className="capitalize font-semibold text-[#111111]">
                                Tipo:{" "}
                                {attr.type === "select"
                                  ? "Selección (Eje de variantes)"
                                  : attr.type}
                          </span>
                          {attr.unit && <span>• Unidad: {attr.unit}</span>}
                          {attr.filterable && (
                                <span className="text-[#007d48] font-bold">
                                  • Filtrable en tienda
                                </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(attr)}
                          className="p-1.5 text-[#707072] hover:text-[#111111] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                          title="Editar atributo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(attr)}
                          className="p-1.5 text-[#707072] hover:text-[#d30005] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                          title="Eliminar atributo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Options Preview for Select */}
                    {isSelect ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#707072]">
                          <span>Opciones ({optionsCount})</span>
                              {isColor && (
                                <span className="flex items-center gap-1">
                                  🎨 Paleta con colores
                                </span>
                              )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 min-h-[42px] p-2 bg-[#f9f9f9] border border-[#e5e5e5]">
                          {optionsCount === 0 ? (
                                <span className="text-xs text-[#707072] italic">
                                  Sin opciones cargadas
                                </span>
                          ) : (
                            attr.options.map((opt) => (
                              <span
                                key={opt.value}
                                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 border shadow-2xs ${
                                  opt.active
                                        ? "bg-white text-[#111111] border-[#e5e5e5]"
                                        : "bg-[#eeeeee] text-[#707072] border-[#e5e5e5] line-through"
                                }`}
                              >
                                {opt.hex && (
                                  <span
                                    className="w-3 h-3 rounded-full border border-black/20"
                                    style={{ backgroundColor: opt.hex }}
                                  />
                                )}
                                <span>{opt.label}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-[#f9f9f9] border border-[#e5e5e5] text-xs text-[#707072]">
                            Este atributo se utiliza como especificación de ficha
                            técnica.
                      </div>
                    )}
                  </div>

                  {/* Footer Usage */}
                  <div className="pt-3 border-t border-[#e5e5e5] flex items-center justify-between text-xs text-[#707072]">
                    <span>
                          Usado en <strong>{attr.usedInCount || 0}</strong>{" "}
                          categorías
                    </span>
                        {attr.usedInCategories &&
                          attr.usedInCategories.length > 0 && (
                      <span className="text-[11px] text-[#111111] font-semibold truncate max-w-[200px]">
                              ({attr.usedInCategories.join(", ")})
                      </span>
                    )}
                  </div>
                </div>
              );
                })
              )}
          </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white border border-[#e5e5e5] shadow-sm px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-[#707072]">
                  Mostrando{" "}
                  <span className="font-bold text-[#111111]">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(
                      currentPage * ITEMS_PER_PAGE,
                      filteredAttributes.length,
                    )}
                  </span>{" "}
                  de{" "}
                  <span className="font-bold text-[#111111]">
                    {filteredAttributes.length}
                  </span>{" "}
                  atributos
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-[#e5e5e5] text-[#707072] hover:text-[#111111] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                          page === currentPage
                            ? "bg-[#111111] text-white border-[#111111]"
                            : "bg-white text-[#707072] border-[#e5e5e5] hover:bg-[#f5f5f5] hover:text-[#111111]"
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="p-2 border border-[#e5e5e5] text-[#707072] hover:text-[#111111] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal Create / Edit */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-[#e5e5e5] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-xl my-8">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-4">
                <h3 className="text-base font-extrabold uppercase tracking-wider text-[#111111]">
                  {editingAttr
                    ? `Editar Atributo: ${editingAttr.label}`
                    : "Nuevo Atributo"}
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
                  {/* Label */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Nombre Visible *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Talle, Color, Volumen"
                      value={label}
                      onChange={(e) => handleLabelChange(e.target.value)}
                      required
                      className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                    />
                  </div>

                  {/* Key */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Identificador (Key) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: talle_calzado, color, volumen"
                      value={key}
                      onChange={(e) => setKey(slugify(e.target.value))}
                      disabled={Boolean(editingAttr)}
                      required
                      className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-mono p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] disabled:opacity-60"
                    />
                    {editingAttr && (
                      <p className="text-[10px] text-[#707072] mt-0.5">
                        El key es inmutable para no romper productos.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Type */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Tipo de Atributo *
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as "select" | "text" | "number" | "boolean")}
                      disabled={Boolean(editingAttr)}
                      className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] disabled:opacity-60 cursor-pointer"
                    >
                      <option value="select">
                        Selección (Genera Variantes)
                      </option>
                      <option value="text">Texto (Especificación)</option>
                      <option value="number">Número (Especificación)</option>
                      <option value="boolean">Sí / No (Especificación)</option>
                    </select>
                  </div>

                  {/* Unit */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Unidad de Medida
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: ml, cm, gr"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                    />
                  </div>

                  {/* Filterable Checkbox */}
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="filterableCheck"
                      checked={filterable}
                      onChange={(e) => setFilterable(e.target.checked)}
                      className="w-4 h-4 text-[#111111] border-[#e5e5e5] focus:ring-[#111111] cursor-pointer"
                    />
                    <label
                      htmlFor="filterableCheck"
                      className="text-xs font-bold uppercase text-[#111111] cursor-pointer"
                    >
                      Filtro en Tienda
                    </label>
                  </div>
                </div>

                {/* Options Manager (Only for select type) */}
                {type === "select" && (
                  <div className="border border-[#e5e5e5] bg-[#fafafa] p-4 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase text-[#111111] flex items-center justify-between">
                      <span>Opciones del Atributo</span>
                      <span className="text-[11px] font-semibold text-[#707072]">
                        Total: {options.length} opciones
                      </span>
                    </h4>

                    {/* Add option bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nombre opción (ej: Negro, 42, 100ml)"
                        value={newOptLabel}
                        onChange={(e) => setNewOptLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddOption();
                          }
                        }}
                        className="flex-1 min-w-[160px] bg-white text-[#111111] text-xs font-semibold p-2.5 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                      />

                      {/* Hex input */}
                      <div className="flex items-center gap-1.5 bg-white border border-[#e5e5e5] px-2 py-1">
                        <input
                          type="color"
                          value={newOptHex || "#000000"}
                          onChange={(e) => setNewOptHex(e.target.value)}
                          className="w-6 h-6 border-0 p-0 cursor-pointer"
                          title="Elegir color (opcional)"
                        />
                        <input
                          type="text"
                          placeholder="#000000"
                          value={newOptHex}
                          onChange={(e) => setNewOptHex(e.target.value)}
                          className="w-20 text-[11px] font-mono uppercase bg-transparent border-0 focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar
                      </button>
                    </div>

                    {/* Options list */}
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pt-2">
                      {options.length === 0 ? (
                        <p className="text-xs text-[#9e9ea0] italic py-2 text-center">
                          Añadí opciones para este atributo (ej: talles
                          numéricos, letras o colores).
                        </p>
                      ) : (
                        options.map((opt) => (
                          <div
                            key={opt.value}
                            className={`flex items-center justify-between p-2 border ${
                              opt.active
                                ? "bg-white border-[#e5e5e5]"
                                : "bg-[#f5f5f5] border-[#e5e5e5]"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {opt.hex && (
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-black/20"
                                  style={{ backgroundColor: opt.hex }}
                                />
                              )}
                              <span
                                className={`text-xs font-bold ${!opt.active ? "line-through text-[#707072]" : "text-[#111111]"}`}
                              >
                                {opt.label}
                              </span>
                              <span className="font-mono text-[10px] text-[#707072]">
                                ({opt.value})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleOptionActive(opt.value)
                                }
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 border cursor-pointer ${
                                  opt.active
                                    ? "bg-emerald-50 text-[#007d48] border-emerald-200"
                                    : "bg-[#f5f5f5] text-[#707072] border-[#e5e5e5]"
                                }`}
                              >
                                {opt.active ? "Activa" : "Inactiva"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(opt.value)}
                                className="text-[#9e9ea0] hover:text-[#d30005] p-1 cursor-pointer"
                                title="Eliminar opción"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

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
                    {editingAttr ? "Guardar Cambios" : "Crear Atributo"}
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
