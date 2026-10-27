'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Tag,
  Boxes,
  Percent,
  Sliders,
  DollarSign,
  Copy,
} from 'lucide-react';
import type { IProductImage } from '@/models/Product';
import { ImageUploader } from './ImageUploader';
import { toast } from '@/components/ui/sonner';
import { generateVariantCombinations, generateSku, formatVariantLabel } from '@/lib/variants';

interface OptionItem {
  _id: string;
  name: string;
}

interface AttributeOption {
  value: string;
  label: string;
  hex?: string;
  order: number;
}

interface AttributeData {
  _id: string;
  key: string;
  label: string;
  type: string;
  unit?: string;
  options: AttributeOption[];
}

interface CategoryData {
  _id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  ancestors: string[];
  variantAxes: string[];
  imageAxis?: string;
  specAttributes: { key: string; required: boolean }[];
}

interface FormVariant {
  _id?: string;
  sku: string;
  options: { key: string; value: string }[];
  retailPrice: number | '';
  wholesalePrice?: number | '';
  stock: number | '';
  active: boolean;
}

interface ProductFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  initialData,
  isEditing = false,
}) => {
  const router = useRouter();

  // Reference lists
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [attributes, setAttributes] = useState<AttributeData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  // General Fields
  const [name, setName] = useState(initialData?.name || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [brandId, setBrandId] = useState<string>(
    typeof initialData?.brandId === 'object' ? initialData.brandId?._id : initialData?.brandId || ''
  );
  const [categoryId, setCategoryId] = useState<string>(
    typeof initialData?.categoryId === 'object'
      ? initialData.categoryId?._id
      : initialData?.categoryId || ''
  );
  const [active, setActive] = useState<boolean>(
    initialData?.active !== undefined ? initialData.active : true
  );
  const [isClearance, setIsClearance] = useState<boolean>(
    initialData?.isClearance || false
  );

  // Specs Fields { [key]: value }
  const [specsMap, setSpecsMap] = useState<Record<string, any>>({});

  // Wholesale Fields
  const [wholesaleEnabled, setWholesaleEnabled] = useState<boolean>(
    initialData?.wholesale?.enabled ?? Boolean(initialData?.wholesalePrice)
  );
  const [wholesaleMinQty, setWholesaleMinQty] = useState<number>(
    initialData?.wholesale?.minQty || 5
  );

  // Images
  const [images, setImages] = useState<IProductImage[]>(initialData?.images || []);
  const [selectedImageAxisValue, setSelectedImageAxisValue] = useState<string>('');

  // Variants Matrix
  const [variants, setVariants] = useState<FormVariant[]>([]);

  // Selected values per axis for combination generator: { [axisKey]: string[] }
  const [selectedAxisValues, setSelectedAxisValues] = useState<Record<string, string[]>>({});

  // Simple Product Fields (when category has 0 axes)
  // The stored variant is the source of truth: sales and the Stock page change it, while the
  // product-level `stock` and `retailPrice` fields are only written when the form is saved.
  const [simplePrice, setSimplePrice] = useState<number | ''>(
    initialData?.variants?.[0]?.retailPrice ??
      initialData?.retailPrice ??
      initialData?.priceRange?.min ??
      ''
  );
  const [simpleWholesalePrice, setSimpleWholesalePrice] = useState<number | ''>(
    initialData?.variants?.[0]?.wholesalePrice ?? initialData?.wholesalePrice ?? ''
  );
  const [simpleStock, setSimpleStock] = useState<number | ''>(
    initialData?.variants?.[0]?.stock ?? initialData?.stock ?? initialData?.totalStock ?? 0
  );
  const [simpleSku, setSimpleSku] = useState<string>(initialData?.variants?.[0]?.sku || '');

  // Mass action helpers
  const [bulkPriceInput, setBulkPriceInput] = useState<string>('');
  const [bulkStockInput, setBulkStockInput] = useState<string>('');

  // 1. Load initial reference data
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        const [catsRes, brandsRes, attrsRes] = await Promise.all([
          fetch('/api/admin/categories'),
          fetch('/api/brands'),
          fetch('/api/admin/attributes'),
        ]);

        const catsJson = await catsRes.json();
        const brandsJson = await brandsRes.json();
        const attrsJson = await attrsRes.json();

        if (catsJson.ok) setCategories(catsJson.data || []);
        if (brandsJson.ok) setBrands(brandsJson.data || []);
        if (attrsJson.ok) setAttributes(attrsJson.data || []);
      } catch (err) {
        console.error('Error al cargar datos de referencia:', err);
        toast.error('Error al cargar categorías y marcas');
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  // 2. Map initial specs and variants when initialData is present
  useEffect(() => {
    if (initialData) {
      // Specs
      if (Array.isArray(initialData.specs)) {
        const m: Record<string, any> = {};
        initialData.specs.forEach((s: any) => {
          m[s.key] = s.value;
        });
        setSpecsMap(m);
      }

      // Variants
      if (Array.isArray(initialData.variants) && initialData.variants.length > 0) {
        setVariants(
          initialData.variants.map((v: any) => ({
            _id: v._id,
            sku: v.sku,
            options: v.options || [],
            retailPrice: v.retailPrice,
            wholesalePrice: v.wholesalePrice,
            stock: v.stock,
            active: v.active !== false,
          }))
        );

        // Pre-select axis values
        const selectedM: Record<string, Set<string>> = {};
        initialData.variants.forEach((v: any) => {
          (v.options || []).forEach((opt: any) => {
            if (!selectedM[opt.key]) selectedM[opt.key] = new Set();
            selectedM[opt.key].add(opt.value);
          });
        });
        const finalSelected: Record<string, string[]> = {};
        Object.entries(selectedM).forEach(([k, s]) => {
          finalSelected[k] = Array.from(s);
        });
        setSelectedAxisValues(finalSelected);
      }
    }
  }, [initialData]);

  // Selected Category
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c._id === categoryId) || null;
  }, [categories, categoryId]);

  // Variant axes definitions for current category
  const currentCategoryAxes = useMemo(() => {
    if (!selectedCategory || !selectedCategory.variantAxes) return [];
    return selectedCategory.variantAxes
      .map((axisKey) => attributes.find((a) => a.key === axisKey))
      .filter(Boolean) as AttributeData[];
  }, [selectedCategory, attributes]);

  const hasAxes = currentCategoryAxes.length > 0;

  // Attributes dictionary for labels
  const attributeLabelsMap = useMemo(() => {
    const map: Record<string, string> = {};
    attributes.forEach((attr) => {
      (attr.options || []).forEach((opt) => {
        map[`${attr.key}:${opt.value}`] = opt.label;
        map[opt.value] = opt.label;
      });
    });
    return map;
  }, [attributes]);

  // Handle toggling option value in combination generator
  const handleToggleAxisValue = (axisKey: string, val: string) => {
    const currentList = selectedAxisValues[axisKey] || [];
    if (currentList.includes(val)) {
      setSelectedAxisValues({
        ...selectedAxisValues,
        [axisKey]: currentList.filter((v) => v !== val),
      });
    } else {
      setSelectedAxisValues({
        ...selectedAxisValues,
        [axisKey]: [...currentList, val],
      });
    }
  };

  // Generate Cartesian combinations
  const handleGenerateCombinations = () => {
    const axesForGeneration = currentCategoryAxes.map((axis) => ({
      key: axis.key,
      values: selectedAxisValues[axis.key] || [],
    }));

    // Verify all axes have at least one value selected
    const emptyAxis = axesForGeneration.find((a) => a.values.length === 0);
    if (emptyAxis) {
      const attrLabel = attributes.find((a) => a.key === emptyAxis.key)?.label || emptyAxis.key;
      toast.error(`Seleccioná al menos una opción para el eje "${attrLabel}"`);
      return;
    }

    const defaultPrice = Number(simplePrice) || (variants[0]?.retailPrice as number) || 0;
    const defaultWsPrice = wholesaleEnabled
      ? Number(simpleWholesalePrice) || (variants[0]?.wholesalePrice as number) || undefined
      : undefined;

    const generated = generateVariantCombinations(
      axesForGeneration,
      slug || name,
      defaultPrice,
      defaultWsPrice
    );

    // Merge with existing variants to preserve stock and price if combination matches
    const existingMap = new Map<string, FormVariant>();
    variants.forEach((v) => {
      const key = v.options
        .map((o) => `${o.key}:${o.value}`)
        .sort()
        .join('|');
      existingMap.set(key, v);
    });

    const merged: FormVariant[] = generated.map((gen) => {
      const key = gen.options
        .map((o) => `${o.key}:${o.value}`)
        .sort()
        .join('|');
      const existing = existingMap.get(key);
      if (existing) {
        return {
          ...gen,
          _id: existing._id,
          sku: existing.sku || gen.sku,
          retailPrice: existing.retailPrice,
          wholesalePrice: existing.wholesalePrice,
          stock: existing.stock,
          active: existing.active,
        };
      }
      return {
        ...gen,
        retailPrice: defaultPrice,
        wholesalePrice: defaultWsPrice,
      };
    });

    setVariants(merged);
    toast.success(`Se generaron ${merged.length} combinaciones de variantes`);
  };

  // Variant editing handlers
  const handleVariantChange = (index: number, field: keyof FormVariant, val: any) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleApplyBulkPrice = () => {
    const num = Number(bulkPriceInput);
    if (isNaN(num) || num < 0) {
      toast.error('Ingresá un precio válido');
      return;
    }
    setVariants((prev) => prev.map((v) => ({ ...v, retailPrice: num })));
    setBulkPriceInput('');
    toast.success(`Precio minorista $${num} aplicado a todas las variantes`);
  };

  const handleApplyBulkStock = () => {
    const num = Math.max(0, parseInt(bulkStockInput, 10) || 0);
    setVariants((prev) => prev.map((v) => ({ ...v, stock: num })));
    setBulkStockInput('');
    toast.success(`Stock de ${num} unidades aplicado a todas las variantes`);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('El nombre del producto es obligatorio');
      return;
    }

    if (!categoryId) {
      toast.error('Seleccioná una categoría para el producto');
      return;
    }

    if (images.length === 0) {
      toast.error('Debe incluir al menos una imagen');
      return;
    }

    // Verify variants or simple stock
    let finalVariants: any[] = [];
    let finalRetailPrice = 0;
    let finalWholesalePrice: number | undefined = undefined;

    if (hasAxes) {
      if (variants.length === 0) {
        toast.error('Debés generar al menos una variante para esta categoría');
        return;
      }

      // Check variant prices
      for (const v of variants) {
        if (v.retailPrice === '' || Number(v.retailPrice) <= 0) {
          toast.error(`La variante ${v.sku} debe tener un precio minorista mayor a 0`);
          return;
        }
        if (wholesaleEnabled && (v.wholesalePrice === '' || Number(v.wholesalePrice) <= 0)) {
          toast.error(`La variante ${v.sku} debe tener un precio mayorista mayor a 0`);
          return;
        }
        if (wholesaleEnabled && Number(v.wholesalePrice) >= Number(v.retailPrice)) {
          toast.error(`El precio mayorista de ${v.sku} debe ser menor al minorista`);
          return;
        }
      }

      finalVariants = variants.map((v) => ({
        ...v,
        retailPrice: Number(v.retailPrice),
        wholesalePrice: wholesaleEnabled && v.wholesalePrice !== '' ? Number(v.wholesalePrice) : undefined,
        stock: Math.max(0, Number(v.stock) || 0),
      }));

      finalRetailPrice = Number(variants[0].retailPrice);
      finalWholesalePrice = wholesaleEnabled ? Number(variants[0].wholesalePrice) : undefined;
    } else {
      // Simple product without axes
      if (simplePrice === '' || Number(simplePrice) <= 0) {
        toast.error('Ingresá un precio minorista válido para el producto');
        return;
      }
      if (wholesaleEnabled && (simpleWholesalePrice === '' || Number(simpleWholesalePrice) <= 0)) {
        toast.error('Ingresá un precio mayorista válido');
        return;
      }
      if (wholesaleEnabled && Number(simpleWholesalePrice) >= Number(simplePrice)) {
        toast.error('El precio mayorista debe ser menor al precio minorista');
        return;
      }

      finalRetailPrice = Number(simplePrice);
      finalWholesalePrice = wholesaleEnabled ? Number(simpleWholesalePrice) : undefined;

      finalVariants = [
        {
          // Reuse the stored variant id when editing so references to it stay valid
          _id: variants[0]?._id,
          sku: simpleSku.trim() || generateSku(slug || name, []),
          options: [],
          retailPrice: finalRetailPrice,
          wholesalePrice: finalWholesalePrice,
          stock: Math.max(0, Number(simpleStock) || 0),
          active: true,
        },
      ];
    }

    // Convert specsMap to specs array
    const specsArray = Object.entries(specsMap)
      .filter(([_, val]) => val !== undefined && val !== null && val !== '')
      .map(([key, value]) => ({ key, value }));

    setSaving(true);
    try {
      const payload = {
        _id: initialData?._id,
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim(),
        categoryId,
        brandId: brandId || undefined,
        active,
        isClearance,
        images,
        specs: specsArray,
        wholesale: {
          enabled: wholesaleEnabled,
          minQty: wholesaleEnabled ? Number(wholesaleMinQty) || 5 : 5,
        },
        variants: finalVariants,
        retailPrice: finalRetailPrice,
        wholesalePrice: finalWholesalePrice,
        stock: finalVariants.reduce((acc, curr) => acc + curr.stock, 0),
      };

      const url = isEditing ? '/api/admin/products' : '/api/admin/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.message || 'Error al guardar el producto');
      }

      toast.success(
        isEditing
          ? `Producto "${name}" actualizado correctamente`
          : `Producto "${name}" creado exitosamente`
      );

      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="bg-white border border-[#e5e5e5] p-12 text-center text-xs text-[#707072] flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#111111]" /> Cargando formulario de producto...
      </div>
    );
  }

  // Filter images if imageAxis is configured
  const currentImageAxis = selectedCategory?.imageAxis;
  const imageAxisAttr = currentImageAxis ? attributes.find((a) => a.key === currentImageAxis) : null;
  const filteredImages = selectedImageAxisValue
    ? images.filter((img) => img.axisValue === selectedImageAxisValue)
    : images;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border border-[#e5e5e5] shadow-sm sticky top-16 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="p-2 bg-[#f5f5f5] hover:bg-[#111111] text-[#111111] hover:text-white transition-colors cursor-pointer"
            title="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-extrabold uppercase tracking-tight text-[#111111]">
              {isEditing ? `Editar: ${name || 'Producto'}` : 'Nuevo Producto'}
            </h1>
            <p className="text-xs text-[#707072]">
              Configuración de catálogo agnóstico y gestión de stock por variantes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="py-2.5 px-4 bg-white hover:bg-[#f5f5f5] text-[#111111] text-xs font-bold uppercase border border-[#e5e5e5] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="py-2.5 px-6 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Producto'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Info & Variants */}
        <div className="lg:col-span-2 space-y-8">
          {/* BLOQUE 1: Datos Generales y Categoría */}
          <div className="bg-white border border-[#e5e5e5] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-[#e5e5e5] pb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#111111] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#007d48]" />
                1. Información General y Clasificación
              </h2>
            </div>

            <div className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Remera Básica Algodón, Sauvage Dior 100ml, Zapatillas Air Max"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-[#f5f5f5] text-[#111111] text-sm font-bold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                />
              </div>

              {/* Category & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                    Categoría *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] cursor-pointer"
                  >
                    <option value="">Seleccionar Categoría...</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.ancestors.length > 0 ? '— ' : ''}{c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                    Marca (Opcional)
                  </label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-bold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111] cursor-pointer"
                  >
                    <option value="">Sin marca específica</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                  Descripción del Producto
                </label>
                <textarea
                  rows={4}
                  placeholder="Detalles sobre aromas, materiales, calce, notas olfativas o recomendaciones de uso."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                />
              </div>

              {/* Dynamic Specifications according to Category */}
              {selectedCategory?.specAttributes && selectedCategory.specAttributes.length > 0 && (
                <div className="pt-4 border-t border-[#e5e5e5] space-y-3">
                  <h3 className="text-xs font-extrabold uppercase text-[#111111] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#007d48]" />
                    Especificaciones de Ficha Técnica
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#fafafa] p-4 border border-[#e5e5e5]">
                    {selectedCategory.specAttributes.map((specDef) => {
                      const attr = attributes.find((a) => a.key === specDef.key);
                      const currentVal = specsMap[specDef.key] ?? '';

                      return (
                        <div key={specDef.key}>
                          <label className="block text-[11px] font-bold uppercase text-[#111111] mb-1">
                            {attr?.label || specDef.key} {specDef.required && '*'}
                          </label>

                          {attr?.type === 'select' ? (
                            <select
                              value={currentVal}
                              onChange={(e) =>
                                setSpecsMap({ ...specsMap, [specDef.key]: e.target.value })
                              }
                              className="w-full bg-white text-[#111111] text-xs font-medium p-2.5 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111] cursor-pointer"
                            >
                              <option value="">Seleccionar...</option>
                              {attr.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : attr?.type === 'boolean' ? (
                            <label className="flex items-center gap-2 pt-2 cursor-pointer text-xs font-medium">
                              <input
                                type="checkbox"
                                checked={Boolean(currentVal)}
                                onChange={(e) =>
                                  setSpecsMap({ ...specsMap, [specDef.key]: e.target.checked })
                                }
                                className="w-4 h-4 text-[#111111]"
                              />
                              <span>Habilitado / Aplica</span>
                            </label>
                          ) : (
                            <input
                              type={attr?.type === 'number' ? 'number' : 'text'}
                              value={currentVal}
                              placeholder={attr?.unit ? `Ej: 100 (${attr.unit})` : 'Ingresar valor...'}
                              onChange={(e) =>
                                setSpecsMap({ ...specsMap, [specDef.key]: e.target.value })
                              }
                              className="w-full bg-white text-[#111111] text-xs font-medium p-2.5 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BLOQUE 2: Variantes e Inventario */}
          <div className="bg-white border border-[#e5e5e5] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-[#e5e5e5] pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#111111] flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-[#007d48]" />
                  2. Variantes e Inventario
                </h2>
                <p className="text-xs text-[#707072]">
                  {hasAxes
                    ? `Esta categoría utiliza ejes de variantes: ${currentCategoryAxes.map((a) => a.label).join(', ')}.`
                    : 'Producto simple (sin variantes configuradas en su categoría).'}
                </p>
              </div>
            </div>

            {/* CASO A: Sin ejes de variantes (Producto Simple: Crema, Gel, Accesorio Único) */}
            {!hasAxes ? (
              <div className="space-y-4 bg-[#fafafa] p-5 border border-[#e5e5e5]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Precio Minorista ($) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ej: 15000"
                      value={simplePrice}
                      onChange={(e) =>
                        setSimplePrice(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      required
                      className="w-full bg-white text-[#111111] text-sm font-extrabold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                    />
                  </div>

                  {wholesaleEnabled && (
                    <div>
                      <label className="block text-xs font-bold uppercase text-[#007d48] mb-1">
                        Precio Mayorista ($) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Ej: 11000"
                        value={simpleWholesalePrice}
                        onChange={(e) =>
                          setSimpleWholesalePrice(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        required
                        className="w-full bg-white text-[#007d48] text-sm font-extrabold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#007d48]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                      Stock Disponible *
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ej: 20"
                      value={simpleStock}
                      onChange={(e) =>
                        setSimpleStock(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      required
                      className="w-full bg-white text-[#111111] text-sm font-extrabold p-3 border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#707072] mb-1">
                    Código SKU (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: GEL-FIJACION-01"
                    value={simpleSku}
                    onChange={(e) => setSimpleSku(e.target.value)}
                    className="w-full sm:w-64 bg-white text-[#111111] text-xs font-mono p-2.5 border border-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                  />
                </div>
              </div>
            ) : (
              /* CASO B: Con Ejes de Variantes (Talle, Color, Volumen, etc.) */
              <div className="space-y-6">
                {/* 1. Selector de Valores por Eje */}
                <div className="space-y-4 bg-[#fafafa] p-5 border border-[#e5e5e5]">
                  <h3 className="text-xs font-extrabold uppercase text-[#111111]">
                    Seleccioná las opciones disponibles para este producto
                  </h3>

                  {currentCategoryAxes.map((axis) => {
                    const selectedVals = selectedAxisValues[axis.key] || [];

                    return (
                      <div key={axis.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-[#111111]">
                          <span>Eje: {axis.label}</span>
                          <span className="text-[11px] font-semibold text-[#707072]">
                            {selectedVals.length} seleccionados
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-[#e5e5e5]">
                          {axis.options.map((opt) => {
                            const isSelected = selectedVals.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleToggleAxisValue(axis.key, opt.value)}
                                className={`text-xs font-bold px-3 py-1.5 border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#111111] text-white border-[#111111] shadow-2xs'
                                    : 'bg-[#f5f5f5] text-[#111111] border-[#e5e5e5] hover:border-[#111111]'
                                }`}
                              >
                                {opt.hex && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-black/20"
                                    style={{ backgroundColor: opt.hex }}
                                  />
                                )}
                                <span>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleGenerateCombinations}
                      className="py-2.5 px-4 bg-[#111111] hover:bg-black text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#007d48]" />
                      Generar / Actualizar Combinaciones
                    </button>
                  </div>
                </div>

                {/* 2. Tabla de Variantes Generadas */}
                {variants.length > 0 && (
                  <div className="space-y-3">
                    {/* Bulk Actions Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#f5f5f5] border border-[#e5e5e5]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#111111]">
                          Total: {variants.length} variantes
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Apply Price Bulk */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            placeholder="Precio común"
                            value={bulkPriceInput}
                            onChange={(e) => setBulkPriceInput(e.target.value)}
                            className="w-28 bg-white text-xs p-1.5 border border-[#e5e5e5]"
                          />
                          <button
                            type="button"
                            onClick={handleApplyBulkPrice}
                            className="px-2.5 py-1.5 bg-[#111111] text-white text-[11px] font-bold uppercase cursor-pointer"
                          >
                            Aplicar $
                          </button>
                        </div>

                        {/* Apply Stock Bulk */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            placeholder="Stock común"
                            value={bulkStockInput}
                            onChange={(e) => setBulkStockInput(e.target.value)}
                            className="w-28 bg-white text-xs p-1.5 border border-[#e5e5e5]"
                          />
                          <button
                            type="button"
                            onClick={handleApplyBulkStock}
                            className="px-2.5 py-1.5 bg-[#111111] text-white text-[11px] font-bold uppercase cursor-pointer"
                          >
                            Aplicar Stock
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Matrix Table */}
                    <div className="overflow-x-auto border border-[#e5e5e5]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#111111] text-white text-[11px] font-extrabold uppercase tracking-wider">
                          <tr>
                            <th className="p-3">Variante</th>
                            <th className="p-3">SKU</th>
                            <th className="p-3">Precio Minorista *</th>
                            {wholesaleEnabled && <th className="p-3">Precio Mayorista *</th>}
                            <th className="p-3">Stock *</th>
                            <th className="p-3 text-center">Activa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5e5e5] bg-white">
                          {variants.map((v, idx) => (
                            <tr key={idx} className="hover:bg-[#fafafa]">
                              <td className="p-3 font-bold text-[#111111]">
                                {formatVariantLabel(v.options, attributeLabelsMap)}
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={v.sku}
                                  onChange={(e) => handleVariantChange(idx, 'sku', e.target.value)}
                                  className="w-full bg-[#f5f5f5] text-[11px] font-mono p-1.5 border border-[#e5e5e5]"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={v.retailPrice}
                                  onChange={(e) =>
                                    handleVariantChange(
                                      idx,
                                      'retailPrice',
                                      e.target.value === '' ? '' : Number(e.target.value)
                                    )
                                  }
                                  className="w-28 bg-white font-bold p-1.5 border border-[#e5e5e5] text-[#111111]"
                                />
                              </td>
                              {wholesaleEnabled && (
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={v.wholesalePrice ?? ''}
                                    onChange={(e) =>
                                      handleVariantChange(
                                        idx,
                                        'wholesalePrice',
                                        e.target.value === '' ? '' : Number(e.target.value)
                                      )
                                    }
                                    className="w-28 bg-white font-bold p-1.5 border border-[#e5e5e5] text-[#007d48]"
                                  />
                                </td>
                              )}
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={v.stock}
                                  onChange={(e) =>
                                    handleVariantChange(
                                      idx,
                                      'stock',
                                      e.target.value === '' ? '' : Number(e.target.value)
                                    )
                                  }
                                  className="w-24 bg-white font-bold p-1.5 border border-[#e5e5e5]"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={v.active}
                                  onChange={(e) =>
                                    handleVariantChange(idx, 'active', e.target.checked)
                                  }
                                  className="w-4 h-4 text-[#111111] cursor-pointer"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Mayorista, Imágenes & Estado */}
        <div className="space-y-8">
          {/* BLOQUE 3: Reglas Mayoristas */}
          <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#111111] flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#007d48]" />
              3. Configuración Mayorista
            </h2>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[#fafafa] border border-[#e5e5e5] cursor-pointer">
                <div>
                  <span className="text-xs font-bold uppercase text-[#111111]">
                    Venta Mayorista
                  </span>
                  <p className="text-[11px] text-[#707072]">
                    Permite precios diferenciales por volumen
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={wholesaleEnabled}
                  onChange={(e) => setWholesaleEnabled(e.target.checked)}
                  className="w-4 h-4 text-[#111111] cursor-pointer"
                />
              </label>

              {wholesaleEnabled && (
                <div className="p-3 bg-[#f0f9f4] border border-[#ceead6] space-y-2">
                  <label className="block text-xs font-bold uppercase text-[#007d48]">
                    Mínimo de Unidades Requeridas *
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={wholesaleMinQty}
                    onChange={(e) => setWholesaleMinQty(parseInt(e.target.value, 10) || 2)}
                    className="w-full bg-white text-xs font-bold p-2 border border-[#ceead6] focus:outline-none"
                  />
                  <p className="text-[11px] text-[#707072]">
                    El cliente puede combinar cualquier variante de este producto para alcanzar el mínimo (ej: {wholesaleMinQty} u.).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* BLOQUE 4: Imágenes */}
          <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#111111]">
                4. Imágenes del Producto
              </h2>
              <span className="text-xs font-bold text-[#707072]">
                {images.length} fotos
              </span>
            </div>

            {/* Filter by image axis if category configures one */}
            {imageAxisAttr && (
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase text-[#707072]">
                  Agrupación de fotos por: {imageAxisAttr.label}
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedImageAxisValue('')}
                    className={`text-[11px] font-bold px-2.5 py-1 border cursor-pointer ${
                      selectedImageAxisValue === ''
                        ? 'bg-[#111111] text-white border-[#111111]'
                        : 'bg-white text-[#111111] border-[#e5e5e5]'
                    }`}
                  >
                    Fotos Generales ({images.filter((i) => !i.axisValue).length})
                  </button>
                  {(selectedAxisValues[imageAxisAttr.key] || []).map((val) => {
                    const opt = imageAxisAttr.options.find((o) => o.value === val);
                    const count = images.filter((i) => i.axisValue === val).length;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSelectedImageAxisValue(val)}
                        className={`text-[11px] font-bold px-2.5 py-1 border cursor-pointer ${
                          selectedImageAxisValue === val
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : 'bg-white text-[#111111] border-[#e5e5e5]'
                        }`}
                      >
                        {opt?.label || val} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <ImageUploader
              images={filteredImages}
              onChange={(updatedSubset) => {
                // If filtering by axisValue, merge back with images of other axisValues
                if (selectedImageAxisValue) {
                  const markedSubset = updatedSubset.map((img) => ({
                    ...img,
                    axisValue: selectedImageAxisValue,
                  }));
                  const others = images.filter((i) => i.axisValue !== selectedImageAxisValue);
                  setImages([...others, ...markedSubset]);
                } else {
                  setImages(updatedSubset);
                }
              }}
            />
          </div>

          {/* BLOQUE 5: Estado y Visibilidad */}
          <div className="bg-white border border-[#e5e5e5] p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#111111]">
              5. Estado y Destacados
            </h2>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[#fafafa] border border-[#e5e5e5] cursor-pointer">
                <div>
                  <span className="text-xs font-bold uppercase text-[#111111]">
                    Producto Activo
                  </span>
                  <p className="text-[11px] text-[#707072]">Visible en la tienda pública</p>
                </div>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-[#111111] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#fafafa] border border-[#e5e5e5] cursor-pointer">
                <div>
                  <span className="text-xs font-bold uppercase text-[#d30005]">
                    🔥 En Liquidación / Oferta
                  </span>
                  <p className="text-[11px] text-[#707072]">Destacar en sección de ofertas</p>
                </div>
                <input
                  type="checkbox"
                  checked={isClearance}
                  onChange={(e) => setIsClearance(e.target.checked)}
                  className="w-4 h-4 text-[#d30005] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
