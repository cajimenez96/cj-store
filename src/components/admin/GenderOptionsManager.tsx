"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { GENDER_ATTRIBUTE_KEY } from "@/lib/attributeKeys";
import {
  AttributeOption,
  addOption,
  removeOption,
  toggleOption,
} from "@/lib/attributeOptions";
import { CategoryTreeNode, StoreCategory, buildCategoryTree } from "@/lib/categoryTree";
import {
  SpecEntry,
  collectSubtreeIds,
  hasSpec,
  withSpec,
  withoutSpec,
} from "@/lib/categorySpecs";

interface GenderAttribute {
  _id: string;
  options: AttributeOption[];
}

interface CategoryRow extends StoreCategory {
  specAttributes: SpecEntry[];
  productCount?: number;
}

interface GenderData {
  attribute: GenderAttribute | null;
  categories: CategoryRow[];
}

const SUGGESTED_GENDERS = ["Hombre", "Mujer", "Unisex"];

const ADD_ERRORS = {
  invalid: "El nombre debe tener letras o números",
  duplicate: "Esa opción de género ya existe",
} as const;

async function fetchGenderData(): Promise<GenderData> {
  try {
    const [attrsRes, catsRes] = await Promise.all([
      fetch("/api/admin/attributes"),
      fetch("/api/admin/categories"),
    ]);
    const attrsJson = await attrsRes.json();
    const catsJson = await catsRes.json();

    const attribute = attrsJson.ok
      ? attrsJson.data.find((a: { key: string }) => a.key === GENDER_ATTRIBUTE_KEY)
      : null;

    return {
      attribute: attribute ?? null,
      categories: catsJson.ok
        ? catsJson.data.map((c: CategoryRow) => ({ ...c, specAttributes: c.specAttributes ?? [] }))
        : [],
    };
  } catch (err) {
    console.error("Error al cargar la configuración de género:", err);
    toast.error("Error al cargar la configuración de género");
    return { attribute: null, categories: [] };
  }
}

/**
 * Single place to manage gender: its options (the "genero" attribute) and which categories use it.
 * It lives inside the settings form, so every button is type="button" and Enter never submits.
 */
export const GenderOptionsManager: React.FC = () => {
  const [attribute, setAttribute] = useState<GenderAttribute | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetchGenderData().then((data) => {
      if (!isMounted) return;
      setAttribute(data.attribute);
      setCategories(data.categories);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const usingCount = categories.filter((c) => hasSpec(c.specAttributes, GENDER_ATTRIBUTE_KEY)).length;

  const createAttribute = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: GENDER_ATTRIBUTE_KEY,
          label: "Género",
          type: "select",
          options: [],
          filterable: true,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Error al crear el atributo");

      toast.success("Género creado", { description: "Ahora podés agregar sus opciones." });
      const data = await fetchGenderData();
      setAttribute(data.attribute);
      setCategories(data.categories);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el atributo");
    } finally {
      setBusy(false);
    }
  };

  const saveOptions = async (options: AttributeOption[]): Promise<boolean> => {
    if (!attribute) return false;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/attributes/${attribute._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Error al guardar las opciones");

      setAttribute((prev) => (prev ? { ...prev, options: json.data.options } : prev));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar las opciones");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (label: string) => {
    if (!attribute) return;

    const result = addOption(attribute.options, label);
    if (!result.ok) {
      if (result.reason !== "empty") toast.error(ADD_ERRORS[result.reason]);
      return;
    }

    if (await saveOptions(result.options)) setNewLabel("");
  };

  const handleRemove = async (option: AttributeOption) => {
    if (!attribute) return;
    if (!confirm(`¿Eliminar la opción "${option.label}"? Si ya la usan productos, desactivala en su lugar.`)) {
      return;
    }
    await saveOptions(removeOption(attribute.options, option.value));
  };

  /** Turns gender on or off for a category and all of its subcategories. */
  const toggleCategory = async (node: CategoryTreeNode<CategoryRow>) => {
    const enable = !hasSpec(node.specAttributes, GENDER_ATTRIBUTE_KEY);
    const apply = enable ? withSpec : withoutSpec;
    const targets = collectSubtreeIds(node);
    let changed = 0;

    setSavingCategories(true);
    try {
      for (const id of targets) {
        const current = categories.find((c) => c._id === id);
        if (!current) continue;

        const next = apply(current.specAttributes, GENDER_ATTRIBUTE_KEY);
        if (next === current.specAttributes) continue;

        const res = await fetch(`/api/admin/categories/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ specAttributes: next }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.message || `Error al actualizar "${current.name}"`);

        changed += 1;
        setCategories((prev) => prev.map((c) => (c._id === id ? { ...c, specAttributes: next } : c)));
      }

      if (changed > 0) {
        toast.success(
          enable
            ? `Género activado en ${changed} ${changed === 1 ? "categoría" : "categorías"}`
            : `Género quitado de ${changed} ${changed === 1 ? "categoría" : "categorías"}`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar las categorías");
    } finally {
      setSavingCategories(false);
    }
  };

  const renderCategories = (nodes: CategoryTreeNode<CategoryRow>[], depth = 0): React.ReactNode =>
    nodes.map((node) => (
      <React.Fragment key={node._id}>
        <li>
          <label
            className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-[#f5f5f5] transition-colors"
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            <input
              type="checkbox"
              checked={hasSpec(node.specAttributes, GENDER_ATTRIBUTE_KEY)}
              disabled={savingCategories}
              onChange={() => toggleCategory(node)}
              className="w-4 h-4 accent-[#111111] cursor-pointer"
            />
            <span className={depth === 0 ? "font-extrabold text-[#111111]" : "font-semibold text-[#111111]"}>
              {node.name}
            </span>
            <span className="ml-auto text-[10px] text-[#707072]">
              {node.productCount ?? 0} {node.productCount === 1 ? "producto" : "productos"}
            </span>
          </label>
        </li>
        {renderCategories(node.children, depth + 1)}
      </React.Fragment>
    ));

  if (loading) {
    return (
      <div className="p-4 border border-[#e5e5e5] bg-[#fafafa] text-xs text-[#707072] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando configuración de género...
      </div>
    );
  }

  if (!attribute) {
    return (
      <div className="p-4 border border-dashed border-[#e5e5e5] bg-[#fafafa] space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#111111]">Géneros</h3>
          <p className="text-xs text-[#707072] mt-1">
            Todavía no hay géneros definidos, por eso la tienda no muestra el filtro. Creá el
            atributo Género para empezar a agregar opciones (por ejemplo Hombre, Mujer o Unisex) y
            elegir qué categorías lo usan.
          </p>
        </div>
        <button
          type="button"
          onClick={createAttribute}
          disabled={busy}
          className="py-2 px-4 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Crear género
        </button>
      </div>
    );
  }

  const sortedOptions = [...attribute.options].sort((a, b) => a.order - b.order);
  const suggestions = SUGGESTED_GENDERS.filter(
    (label) => !attribute.options.some((o) => o.label.toLowerCase() === label.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* 1. Options */}
      <div className="p-4 border border-[#e5e5e5] bg-[#fafafa] space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-[#111111]">1. Opciones de género</h3>
          <p className="text-xs text-[#707072] mt-1">
            La tienda las usa en el filtro y los productos las eligen en su ficha técnica. Las
            ocultas dejan de mostrarse en la tienda.
          </p>
        </div>

        {sortedOptions.length === 0 ? (
          <p className="text-xs text-[#707072] italic">
            Aún no hay opciones: sin ellas el filtro de género no se muestra en la tienda.
          </p>
        ) : (
          <ul className="divide-y divide-[#e5e5e5] border border-[#e5e5e5] bg-white">
            {sortedOptions.map((option) => (
              <li key={option.value} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span
                  className={`flex-1 font-bold ${option.active ? "text-[#111111]" : "text-[#707072] line-through"}`}
                >
                  {option.label}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveOptions(toggleOption(attribute.options, option.value))}
                  className="p-1.5 text-[#707072] hover:text-[#111111] transition-colors cursor-pointer disabled:opacity-50"
                  title={option.active ? "Ocultar en la tienda" : "Mostrar en la tienda"}
                  aria-label={option.active ? `Ocultar ${option.label}` : `Mostrar ${option.label}`}
                >
                  {option.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRemove(option)}
                  className="p-1.5 text-[#9e9ea0] hover:text-[#d30005] transition-colors cursor-pointer disabled:opacity-50"
                  title="Eliminar opción"
                  aria-label={`Eliminar ${option.label}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd(newLabel);
              }
            }}
            placeholder="Nuevo género (ej: Niños, Edición limitada)"
            className="flex-1 min-w-50 bg-white text-[#111111] text-xs font-semibold py-2 px-3 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111]"
          />
          <button
            type="button"
            onClick={() => handleAdd(newLabel)}
            disabled={busy || !newLabel.trim()}
            className="py-2 px-3 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Agregar
          </button>
        </div>

        {sortedOptions.length === 0 && suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#707072]">
            <span className="font-semibold">Sugeridos:</span>
            {suggestions.map((label) => (
              <button
                key={label}
                type="button"
                disabled={busy}
                onClick={() => handleAdd(label)}
                className="px-2.5 py-1 bg-white border border-[#e5e5e5] text-[#111111] font-bold hover:border-[#111111] transition-colors cursor-pointer disabled:opacity-50"
              >
                + {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Categories that use gender */}
      <div className="p-4 border border-[#e5e5e5] bg-[#fafafa] space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-[#111111]">2. Categorías que usan género</h3>
            <p className="text-xs text-[#707072] mt-1">
              Marcá las categorías cuyos productos tienen género (por ejemplo Zapatillas o Remeras);
              en ellas aparece el campo Género al cargar un producto. Al marcar una categoría con
              subcategorías se aplica también a ellas, y después podés ajustar cada una.
            </p>
          </div>
          <span className="text-[11px] font-bold text-[#707072]">
            {usingCount} de {categories.length} {categories.length === 1 ? "categoría" : "categorías"}
          </span>
        </div>

        {categories.length === 0 ? (
          <p className="text-xs text-[#707072] italic">
            Todavía no hay categorías. Creálas en{" "}
            <Link href="/admin/categories" className="font-bold underline">
              Categorías
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-[#e5e5e5] border border-[#e5e5e5] bg-white max-h-72 overflow-y-auto">
            {renderCategories(tree)}
          </ul>
        )}

        {savingCategories && (
          <p className="text-[11px] text-[#707072] flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Guardando categorías...
          </p>
        )}
      </div>
    </div>
  );
};
