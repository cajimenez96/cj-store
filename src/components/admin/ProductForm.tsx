"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import type { GenderType, IProductImage, ISizeStock, IVariantStock } from "@/models/Product";
import { DEFAULT_GENDER_SIZES } from "@/constants/sizes";
import { ImageUploader } from "./ImageUploader";
import { toast } from "@/components/ui/sonner";

interface OptionItem {
  _id: string;
  name: string;
}

interface ProductFormProps {
  initialData?: {
    _id?: string;
    name: string;
    description: string;
    price?: number;
    retailPrice?: number;
    wholesalePrice?: number;
    brandId: string | { _id: string; name: string };
    typeId: string | { _id: string; name: string };
    gender?: GenderType | null;
    active: boolean;
    isClearance?: boolean;
    images: IProductImage[];
    variants?: IVariantStock[];
    stock?: number;
    sizesStock?: ISizeStock[];
    displayedSizes?: number[];
  };
  isEditing?: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  initialData,
  isEditing = false,
}) => {
  const router = useRouter();

  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [types, setTypes] = useState<OptionItem[]>([]);
  const [genderSizes, setGenderSizes] = useState<Record<string, number[]>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [retailPrice, setRetailPrice] = useState<number | "">(
    initialData?.retailPrice !== undefined
      ? initialData.retailPrice
      : initialData?.price !== undefined
        ? initialData.price
        : "",
  );
  const [wholesalePrice, setWholesalePrice] = useState<number | "">(
    initialData?.wholesalePrice !== undefined
      ? initialData.wholesalePrice
      : initialData?.price !== undefined
        ? initialData.price
        : "",
  );
  const [brandId, setBrandId] = useState<string>(
    typeof initialData?.brandId === "object"
      ? initialData.brandId._id
      : initialData?.brandId || "",
  );
  const [typeId, setTypeId] = useState<string>(
    typeof initialData?.typeId === "object"
      ? initialData.typeId._id
      : initialData?.typeId || "",
  );
  const [gender, setGender] = useState<GenderType | null>(
    initialData?.gender !== undefined ? initialData.gender : null,
  );
  const [active, setActive] = useState<boolean>(
    initialData?.active !== undefined ? initialData.active : true,
  );
  const [isClearance, setIsClearance] = useState<boolean>(
    initialData?.isClearance || false,
  );

  // Inventory mode: 'variants' | 'simple' | 'shoes'
  const initialMode =
    initialData?.variants && initialData.variants.length > 0
      ? "variants"
      : initialData?.sizesStock && initialData.sizesStock.length > 0
      ? "shoes"
      : initialData?.stock !== undefined
      ? "simple"
      : "variants";

  const [inventoryMode, setInventoryMode] = useState<"variants" | "simple" | "shoes">(initialMode);

  // Generic variants state
  const [variants, setVariants] = useState<IVariantStock[]>(
    initialData?.variants && initialData.variants.length > 0
      ? initialData.variants
      : [{ name: "100ml", stock: 10 }]
  );

  // Simple stock state
  const [simpleStock, setSimpleStock] = useState<number | "">(
    initialData?.stock !== undefined ? initialData.stock : 0
  );

  // Images state: array of { url, fileId, isPrincipal, position }
  const [images, setImages] = useState<IProductImage[]>(
    initialData?.images && initialData.images.length > 0
      ? initialData.images
      : [],
  );

  // Sizes stock state: array of { size, stock }
  const [sizesStock, setSizesStock] = useState<ISizeStock[]>([]);

  // Displayed sizes state: array of sizes to show in storefront
  const [displayedSizes, setDisplayedSizes] = useState<number[]>([]);

  // Toggle to show/hide sizes without stock
  const [showHiddenSizes, setShowHiddenSizes] = useState(false);

  // 1. Fetch Brands, Types & Dynamic Gender Sizes
  useEffect(() => {
    async function fetchOptions() {
      try {
        const [brandsRes, typesRes, sizesRes] = await Promise.all([
          fetch("/api/brands"),
          fetch("/api/types"),
          fetch("/api/sizes"),
        ]);

        const brandsJson = await brandsRes.json();
        const typesJson = await typesRes.json();
        const sizesJson = await sizesRes.json();

        if (brandsJson.ok) setBrands(brandsJson.data);
        if (typesJson.ok) setTypes(typesJson.data);
        if (sizesJson.ok && sizesJson.data) setGenderSizes(sizesJson.data);
      } catch (err) {
        console.error("Error al cargar listas de marcas, tipos y talles:", err);
      } finally {
        setLoadingOptions(false);
      }
    }
    fetchOptions();
  }, []);

  // 2. Initialize size scale stock when Gender or genderSizes changes
  useEffect(() => {
    const activeGenderKey = gender || "Unisex";
    const scaleSizes = genderSizes[activeGenderKey] || DEFAULT_GENDER_SIZES[activeGenderKey] || [];

    if (!isEditing) {
      const initialized = scaleSizes.map((s) => ({
        size: s,
        stock: 0,
      }));
      setSizesStock(initialized);
      setDisplayedSizes([]);
    } else if (initialData?.sizesStock) {
      const stockMap = new Map(
        initialData.sizesStock.map((s) => [s.size, s.stock]),
      );

      // Merge current scale sizes and any extra existing size already saved on the product
      const allUniqueSizes = Array.from(
        new Set([...scaleSizes, ...initialData.sizesStock.map((s) => s.size)])
      ).sort((a, b) => a - b);

      const combined = allUniqueSizes.map((s) => ({
        size: s,
        stock: stockMap.get(s) || 0,
      }));

      setSizesStock(combined);
    }
  }, [gender, genderSizes, isEditing, initialData]);

  // 3. Initialize displayedSizes based on stock or saved displayedSizes
  useEffect(() => {
    if (!isEditing) {
      const sizesWithStock = sizesStock
        .filter((s) => s.stock > 0)
        .map((s) => s.size);
      setDisplayedSizes(sizesWithStock);
    } else if (initialData && "displayedSizes" in initialData) {
      const saved = (initialData as any).displayedSizes || [];
      setDisplayedSizes(saved);
    } else {
      const sizesWithStock = sizesStock
        .filter((s) => s.stock > 0)
        .map((s) => s.size);
      setDisplayedSizes(sizesWithStock);
    }
  }, [sizesStock, isEditing, initialData]);

  // Size Stock Helpers
  const handleStockChange = (size: number, newStock: number) => {
    const validStock = Math.max(0, newStock);
    setSizesStock((prev) =>
      prev.map((s) => (s.size === size ? { ...s, stock: validStock } : s)),
    );
  };

  const handleToggleSizeDisplay = (size: number) => {
    setDisplayedSizes((prev) =>
      prev.includes(size)
        ? prev.filter((s) => s !== size)
        : [...prev, size].sort((a, b) => a - b)
    );
  };

  const visibleSizesForToggle = showHiddenSizes
    ? sizesStock
    : sizesStock.filter((s) => s.stock > 0);

  const handleAddVariant = () => {
    setVariants((prev) => [...prev, { name: "", stock: 0 }]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariantChange = (
    index: number,
    field: keyof IVariantStock,
    value: string | number
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!name.trim()) {
      toast.error("El nombre del producto es obligatorio", {
        description: "Completá el nombre para poder continuar.",
      });
      return;
    }
    if (!description.trim()) {
      toast.error("La descripción es obligatoria", {
        description: "Ingresá una breve descripción del producto.",
      });
      return;
    }
    if (isClearance) {
      if (wholesalePrice === "" || Number(wholesalePrice) < 0) {
        toast.error("Ingresá un precio de liquidación válido", {
          description: "El valor debe ser mayor o igual a 0.",
        });
        return;
      }
    } else {
      if (retailPrice === "" || Number(retailPrice) < 0) {
        toast.error("Ingresá un precio minorista válido", {
          description: "El valor debe ser mayor o igual a 0.",
        });
        return;
      }
      if (wholesalePrice === "" || Number(wholesalePrice) < 0) {
        toast.error("Ingresá un precio mayorista válido", {
          description: "El valor debe ser mayor o igual a 0.",
        });
        return;
      }
      if (Number(wholesalePrice) > Number(retailPrice)) {
        toast.error("El precio mayorista no puede superar al minorista", {
          description: "Ajustá los valores antes de guardar.",
        });
        return;
      }
    }
    if (!brandId || !typeId) {
      toast.error("Seleccioná la Marca y Categoría", {
        description: "Ambos campos son requeridos para catalogar.",
      });
      return;
    }

    const validImages = images.filter((img) => img.url && img.url.trim());
    if (validImages.length === 0) {
      toast.error("Subí al menos una imagen válida", {
        description: "El producto requiere una foto de portada.",
      });
      return;
    }

    let finalVariants: IVariantStock[] = [];
    let finalStock = 0;
    let finalSizesStock: ISizeStock[] = [];
    let finalDisplayedSizes: number[] = [];

    if (inventoryMode === "variants") {
      const validVariants = variants.filter((v) => v.name.trim().length > 0);
      if (validVariants.length === 0) {
        toast.error("Cargá al menos una variante con nombre", {
          description: "Ej: 100ml, 50ml, etc.",
        });
        return;
      }
      finalVariants = validVariants.map((v) => ({
        name: v.name.trim(),
        stock: Math.max(0, Number(v.stock) || 0),
        sku: v.sku?.trim() || undefined,
      }));
    } else if (inventoryMode === "simple") {
      finalStock = Math.max(0, Number(simpleStock) || 0);
    } else {
      finalSizesStock = sizesStock;
      finalDisplayedSizes = displayedSizes;
    }

    setSaving(true);

    try {
      const url = "/api/admin/products";
      const method = isEditing ? "PUT" : "POST";

      const payload = {
        ...(isEditing && { _id: initialData?._id }),
        name: name.trim(),
        description: description.trim(),
        retailPrice: isClearance ? Number(wholesalePrice) : Number(retailPrice),
        wholesalePrice: Number(wholesalePrice),
        price: isClearance ? Number(wholesalePrice) : Number(retailPrice),
        brandId,
        typeId,
        gender: gender || null,
        active,
        isClearance,
        images: validImages,
        variants: finalVariants,
        stock: finalStock,
        sizesStock: finalSizesStock,
        displayedSizes: finalDisplayedSizes,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.message || "Error al guardar el producto");
      }

      const msg = isEditing
        ? "Producto actualizado correctamente"
        : "Producto creado exitosamente";

      toast.success(msg, {
        description: "Los cambios ya están reflejados en el catálogo.",
      });

      setTimeout(() => {
        router.push("/admin/products");
        router.refresh();
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error procesando solicitud";
      toast.error(msg, {
        description: "Revisá los datos e intentá nuevamente.",
      });
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 font-sans">
      {/* Top Header Controls */}
      <div className="flex justify-between items-center pb-4 border-b border-[#e5e5e5]">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs font-bold text-[#111111] hover:text-[#707072] flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Productos
        </button>

        <button
          type="submit"
          disabled={saving}
          className="py-3 px-6 bg-[#111111] hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-full flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />{" "}
              {isEditing ? "Guardar Cambios" : "Crear Producto"}
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Information & Stock */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Attributes Card */}
          <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
              Información del Producto
            </h2>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                Nombre del Producto *
              </label>
              <input
                type="text"
                placeholder="Ej: Nike Air Max 90"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-medium py-3 px-3 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                Descripción Detallada *
              </label>
              <textarea
                rows={4}
                placeholder="Características, tecnología de amortiguación, materiales..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium p-3 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
              />
            </div>

            {isClearance ? (
              <div className="p-4 bg-[#d30005]/5 border border-[#d30005]/20 space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#d30005] mb-1.5">
                  🔥 Precio Liquidación ($ ARS) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ej: 95000"
                  value={wholesalePrice}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    setWholesalePrice(val);
                    setRetailPrice(val);
                  }}
                  className="w-full bg-white text-[#d30005] text-base font-extrabold py-3 px-3 rounded-none border border-[#d30005]/40 focus:outline-none focus:ring-2 focus:ring-[#d30005]"
                />
                <p className="text-[11px] text-[#707072] font-medium">
                  Precio único promocional para este producto en liquidación (válido para compra minorista y mayorista).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    Precio Minorista ($ ARS) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 130000"
                    value={retailPrice}
                    onChange={(e) =>
                      setRetailPrice(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-extrabold py-3 px-3 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                  <p className="text-[10px] text-[#707072] mt-1">
                    Precio para compras de 1 a 4 pares
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                    Precio Mayorista ($ ARS) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 110000"
                    value={wholesalePrice}
                    onChange={(e) =>
                      setWholesalePrice(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-extrabold py-3 px-3 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                  />
                  <p className="text-[10px] text-[#707072] mt-1">
                    Precio para compras de 5 pares o más
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-3 border-t border-[#e5e5e5]">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-[#111111]">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 accent-[#111111] cursor-pointer"
                />
                <span>Producto Activo (Visible en tienda)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-[#d30005]">
                <input
                  type="checkbox"
                  checked={isClearance}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsClearance(checked);
                    if (checked) {
                      if (wholesalePrice !== "" && Number(wholesalePrice) > 0) {
                        setRetailPrice(wholesalePrice);
                      } else if (retailPrice !== "" && Number(retailPrice) > 0) {
                        setWholesalePrice(retailPrice);
                      }
                    }
                  }}
                  className="w-4 h-4 accent-[#d30005] cursor-pointer"
                />
                <span>🔥 Producto en Liquidación</span>
              </label>
            </div>
          </div>

          {/* Inventory & Stock Section */}
          <div className="bg-white border border-[#e5e5e5] p-6 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-[#e5e5e5]">
              <div>
                <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
                  Gestión de Stock e Inventario
                </h2>
                <p className="text-xs text-[#707072] mt-0.5">
                  Elegí cómo se gestiona el inventario de este producto
                </p>
              </div>

              {/* Mode Selector Tabs */}
              <div className="flex gap-1 bg-[#f5f5f5] p-1 border border-[#e5e5e5]">
                <button
                  type="button"
                  onClick={() => setInventoryMode("variants")}
                  className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    inventoryMode === "variants"
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#707072] hover:text-[#111111]"
                  }`}
                >
                  Variantes (ml, colores)
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryMode("simple")}
                  className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    inventoryMode === "simple"
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#707072] hover:text-[#111111]"
                  }`}
                >
                  Stock Simple
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryMode("shoes")}
                  className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    inventoryMode === "shoes"
                      ? "bg-[#111111] text-white shadow-xs"
                      : "text-[#707072] hover:text-[#111111]"
                  }`}
                >
                  Talles Calzado
                </button>
              </div>
            </div>

            {/* Mode 1: Generic Variants */}
            {inventoryMode === "variants" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#707072]">
                    Total unidades:{" "}
                    <strong className="text-[#111111]">
                      {variants.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0)}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="px-3 py-1.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-black transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Variante
                  </button>
                </div>

                <div className="space-y-2">
                  {variants.map((v, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-[#f5f5f5] border border-[#e5e5e5]"
                    >
                      <div className="w-full sm:flex-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#707072] mb-1">
                          Presentación / Variante (Ej: 100ml, 50ml, Negro) *
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: 100ml"
                          value={v.name}
                          onChange={(e) => handleVariantChange(idx, "name", e.target.value)}
                          className="w-full bg-white text-[#111111] text-xs font-bold p-2 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                        />
                      </div>
                      <div className="w-full sm:w-32">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#707072] mb-1">
                          Stock Disponible *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={(e) =>
                            handleVariantChange(idx, "stock", parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full bg-white text-[#111111] text-xs font-bold p-2 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                        />
                      </div>
                      <div className="w-full sm:w-36">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#707072] mb-1">
                          SKU (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: PERF-100"
                          value={v.sku || ""}
                          onChange={(e) => handleVariantChange(idx, "sku", e.target.value)}
                          className="w-full bg-white text-[#111111] text-xs font-medium p-2 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                        />
                      </div>
                      <div className="flex sm:self-end pb-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(idx)}
                          disabled={variants.length <= 1}
                          className="p-2 text-[#707072] hover:text-[#d30005] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="Eliminar variante"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mode 2: Simple Stock */}
            {inventoryMode === "simple" && (
              <div className="p-4 bg-[#f5f5f5] border border-[#e5e5e5] space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111]">
                  Stock Total Disponible *
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ej: 50"
                  value={simpleStock}
                  onChange={(e) =>
                    setSimpleStock(e.target.value === "" ? "" : parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full sm:w-48 bg-white text-[#111111] text-base font-extrabold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                />
                <p className="text-[11px] text-[#707072]">
                  Usá esta opción para productos únicos sin variantes (ej. anteojos de sol modelo único o accesorios simples).
                </p>
              </div>
            )}

            {/* Mode 3: Traditional Shoe Sizes */}
            {inventoryMode === "shoes" && (
              <div className="space-y-4">
                {sizesStock.length === 0 ? (
                  <div className="p-4 bg-[#f9f9f9] border border-[#e5e5e5] text-center text-xs text-[#707072] space-y-1">
                    <p className="font-bold text-[#111111]">
                      El género seleccionado ({gender || "Sin género"}) no tiene talles configurados.
                    </p>
                    <p>
                      Para productos como perfumes o cosmética, utilizá la pestaña <strong>Variantes (ml, colores)</strong> o <strong>Stock Simple</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold uppercase text-[#707072]">
                        Escala {gender || "Unisex"} ({sizesStock.reduce((acc, curr) => acc + curr.stock, 0)} pares)
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowHiddenSizes(!showHiddenSizes)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#e5e5e5] bg-white hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                      >
                        👁️ {showHiddenSizes ? "Ocultar sin stock" : "Mostrar sin stock"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {sizesStock.map((item) => (
                        <div
                          key={item.size}
                          className="p-3 bg-[#f5f5f5] border border-[#e5e5e5] space-y-1.5 text-center"
                        >
                          <span className="block text-xs font-extrabold text-[#111111]">
                            Talle {item.size}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={item.stock}
                            onChange={(e) =>
                              handleStockChange(item.size, parseInt(e.target.value, 10) || 0)
                            }
                            className="w-full text-center bg-white text-[#111111] font-extrabold text-sm py-1.5 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Classification & ImageUploader */}
        <div className="space-y-6">
          {/* Classification Attributes */}
          <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
                Clasificación
              </h2>
              {isEditing && (
                <span className="text-[10px] bg-[#f5f5f5] text-[#707072] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#e5e5e5]">
                  <Lock className="w-3 h-3" /> Fija
                </span>
              )}
            </div>

            {/* Brand Dropdown */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                Marca *
              </label>
              {isEditing ? (
                <div className="w-full bg-[#f5f5f5] text-[#707072] text-xs font-bold py-3 px-3 border border-[#e5e5e5]">
                  {typeof initialData?.brandId === "object"
                    ? initialData.brandId.name
                    : "Marca Bloqueada"}
                </div>
              ) : (
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  disabled={loadingOptions}
                  className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold py-3 px-3 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] cursor-pointer"
                >
                  <option value="">-- Seleccionar Marca --</option>
                  {brands.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Category / Type Dropdown */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                Categoría / Tipo de Producto *
              </label>
              {isEditing ? (
                <div className="w-full bg-[#f5f5f5] text-[#707072] text-xs font-bold py-3 px-3 border border-[#e5e5e5]">
                  {typeof initialData?.typeId === "object"
                    ? initialData.typeId.name
                    : "Categoría Bloqueada"}
                </div>
              ) : (
                <select
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                  disabled={loadingOptions}
                  className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold py-3 px-3 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] cursor-pointer"
                >
                  <option value="">-- Seleccionar Categoría --</option>
                  {types.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Gender Select */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#111111] mb-1.5">
                Género (Opcional)
              </label>
              <select
                value={gender || ""}
                onChange={(e) =>
                  setGender(e.target.value ? (e.target.value as GenderType) : null)
                }
                className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold py-3 px-3 rounded-none border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] cursor-pointer"
              >
                <option value="">Sin género / No aplica</option>
                {Array.from(
                  new Set([...Object.keys(genderSizes), ...(gender ? [gender] : [])])
                )
                  .sort()
                  .map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Dual Mode ImageUploader Card */}
          <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
              Gestión de Imágenes
            </h2>
            <ImageUploader
              images={images}
              onChange={setImages}
              folder="/products"
            />
          </div>
        </div>
      </div>
    </form>
  );
};
