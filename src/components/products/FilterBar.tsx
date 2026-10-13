"use client";

import React, { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  RotateCcw,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import { SearchBar } from "@/components/common/SearchBar";
import { useSettings } from "@/context/SettingsContext";

interface FilterOption {
  _id: string;
  name: string;
}

export type ProductSort = "price_asc" | "price_desc" | null;

interface FilterBarProps {
  brands: FilterOption[];
  categories: FilterOption[];
  selectedBrandIds: string[];
  selectedCategoryIds: string[];
  selectedGender: string | null;
  selectedSort: ProductSort;
  onToggleBrand: (brandId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  onSelectGender: (gender: string | null) => void;
  onSelectSort: (sort: ProductSort) => void;
  onClearFilters: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  brands,
  categories,
  selectedBrandIds,
  selectedCategoryIds,
  selectedGender,
  selectedSort,
  onToggleBrand,
  onToggleCategory,
  onSelectGender,
  onSelectSort,
  onClearFilters,
}) => {
  const { settings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [availableGenders, setAvailableGenders] = useState<string[]>([]);

  const genders =
    availableGenders.length > 0 ? availableGenders : ["Hombre", "Mujer", "Unisex"];

  // Genders are configured through the "genero" attribute, so they do not depend on other filters
  useEffect(() => {
    const fetchAvailableFilters = async () => {
      try {
        const res = await fetch("/api/catalog/available-filters");
        const json = await res.json();

        if (json.ok && json.data) {
          setAvailableGenders(json.data.genders || []);
        }
      } catch (err) {
        console.error("Error fetching available filters:", err);
      }
    };

    fetchAvailableFilters();
  }, []);

  const activeFiltersCount =
    selectedBrandIds.length +
    selectedCategoryIds.length +
    (settings.enableGenders !== false && selectedGender !== null ? 1 : 0);

  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <>
      <div className="bg-[#f5f5f5] p-3.5 sm:p-4 border border-[#e5e5e5] mb-6 font-sans">
        {/* Search Bar only on mobile */}
        <div className="block sm:hidden mb-3">
          <SearchBar
            placeholder="Buscar modelo..."
            className="w-full"
            inputClassName="bg-white border border-[#e5e5e5]"
          />
        </div>

        {/* Header Row */}
        <div className="flex justify-between items-center gap-2">
          {/* Left: Button "Más filtros" / "Filtros" */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(true)}
              className="text-xs font-bold text-[#111111] flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-[#e5e5e5] hover:border-[#111111] transition-all cursor-pointer shadow-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#111111]" />
              <span>Más filtros</span>
              {hasActiveFilters && (
                <span className="bg-[#111111] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="text-xs text-[#d30005] font-semibold hover:underline flex items-center gap-1 cursor-pointer ml-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}
          </div>

          {/* Right: Sort Select */}
          <div className="relative flex items-center">
            <label
              htmlFor="product-sort"
              className="text-xs font-semibold text-[#707072] mr-2 hidden sm:inline select-none"
            >
              Ordenar por:
            </label>
            <div className="relative inline-flex items-center">
              <select
                id="product-sort"
                value={selectedSort ?? ""}
                onChange={(e) =>
                  onSelectSort(
                    e.target.value === ""
                      ? null
                      : (e.target.value as ProductSort),
                  )
                }
                className="text-xs font-bold text-[#111111] bg-white pl-3.5 pr-8 py-2 rounded-full border border-[#e5e5e5] hover:border-[#111111] transition-all cursor-pointer shadow-xs focus:outline-none appearance-none"
              >
                <option value="">Relevancia</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#111111] pointer-events-none absolute right-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Off-canvas Filter Drawer (Slide from left to right) */}
      <div
        className={`fixed inset-0 z-50 overflow-hidden font-sans transition-all duration-300 ${
          isOpen
            ? "pointer-events-auto visible"
            : "pointer-events-none invisible"
        }`}
      >
        {/* Backdrop with smooth fade */}
        <div
          className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ease-out ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsOpen(false)}
        />

        <div className="fixed inset-y-0 left-0 max-w-full flex pr-10">
          <div
            className={`w-screen max-w-md bg-white border-r border-[#e5e5e5] shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out transform ${
              isOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#e5e5e5] flex justify-between items-center bg-white">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-[#111111]" />
                <h2 className="text-lg font-extrabold uppercase tracking-tight text-[#111111]">
                  Filtros {hasActiveFilters && `(${activeFiltersCount})`}
                </h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-[#f5f5f5] text-[#111111] transition-colors cursor-pointer"
                aria-label="Cerrar filtros"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 1. Marcas Filter Chips */}
              {brands.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#707072] uppercase tracking-wider mb-2.5">
                    Marca
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {brands.map((brand) => {
                      const isActive = selectedBrandIds.includes(brand._id);
                      return (
                        <button
                          key={brand._id}
                          onClick={() => onToggleBrand(brand._id)}
                          className={`transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#111111] text-white font-bold rounded-full px-3.5 py-1.5 text-xs shadow-xs"
                              : "bg-white text-[#111111] font-semibold border border-[#e5e5e5] hover:border-[#111111] rounded-full px-3.5 py-1.5 text-xs"
                          }`}
                        >
                          {brand.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Categorías Filter Chips */}
              {categories.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#707072] uppercase tracking-wider mb-2.5">
                    Categoría
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => {
                      const isActive = selectedCategoryIds.includes(category._id);
                      return (
                        <button
                          key={category._id}
                          onClick={() => onToggleCategory(category._id)}
                          className={`transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#111111] text-white font-bold rounded-full px-3.5 py-1.5 text-xs shadow-xs"
                              : "bg-white text-[#111111] font-semibold border border-[#e5e5e5] hover:border-[#111111] rounded-full px-3.5 py-1.5 text-xs"
                          }`}
                        >
                          {category.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Género Filter */}
              {settings.enableGenders !== false && (
                <div>
                  <h4 className="text-xs font-bold text-[#707072] uppercase tracking-wider mb-2.5">
                    Género
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {genders.map((gender) => {
                      const isActive = selectedGender === gender;
                      return (
                        <button
                          key={gender}
                          onClick={() => onSelectGender(isActive ? null : gender)}
                          className={`transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#111111] text-white font-bold rounded-full px-3.5 py-1.5 text-xs shadow-xs"
                              : "bg-white text-[#111111] font-semibold border border-[#e5e5e5] hover:border-[#111111] rounded-full px-3.5 py-1.5 text-xs"
                          }`}
                        >
                          {gender}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-[#e5e5e5] bg-[#f5f5f5] space-y-3">
              {hasActiveFilters && (
                <button
                  onClick={onClearFilters}
                  className="w-full py-3 bg-white hover:bg-[#eaeaea] text-[#d30005] border border-[#e5e5e5] font-bold text-xs uppercase tracking-wider rounded-full flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpiar Filtros
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-3.5 bg-[#111111] hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Ver Resultados
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
