"use client";

import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { BrandOption, groupBrandsByLetter } from "@/lib/brandGroups";

interface BrandFilterProps {
  brands: BrandOption[];
  selectedBrandIds: string[];
  onToggleBrand: (brandId: string) => void;
}

/** Multi-select brand list: searchable and grouped alphabetically so long lists stay usable. */
export const BrandFilter: React.FC<BrandFilterProps> = ({
  brands,
  selectedBrandIds,
  onToggleBrand,
}) => {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => groupBrandsByLetter(brands, query), [brands, query]);
  const selectedBrands = useMemo(
    () => brands.filter((brand) => selectedBrandIds.includes(brand._id)),
    [brands, selectedBrandIds],
  );

  if (brands.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-xs font-bold text-[#707072] uppercase tracking-wider">
          Marca {selectedBrands.length > 0 && `(${selectedBrands.length})`}
        </h4>
        {selectedBrands.length > 0 && (
          <button
            type="button"
            onClick={() => selectedBrands.forEach((brand) => onToggleBrand(brand._id))}
            className="text-[11px] font-semibold text-[#d30005] hover:underline cursor-pointer"
          >
            Quitar todas
          </button>
        )}
      </div>

      {selectedBrands.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedBrands.map((brand) => (
            <button
              key={brand._id}
              type="button"
              onClick={() => onToggleBrand(brand._id)}
              className="inline-flex items-center gap-1.5 bg-[#111111] text-white font-bold rounded-full pl-3 pr-2 py-1 text-xs shadow-xs cursor-pointer"
              aria-label={`Quitar ${brand.name}`}
            >
              {brand.name}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      <div className="relative mb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar marca..."
          className="w-full bg-[#f5f5f5] text-[#111111] text-xs font-medium placeholder-[#707072] rounded-full py-2 pl-9 pr-8 focus:outline-none focus:ring-2 focus:ring-[#111111]"
        />
        <Search className="w-4 h-4 text-[#707072] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[#707072] hover:text-[#111111] cursor-pointer"
            aria-label="Borrar búsqueda de marca"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto border border-[#e5e5e5] rounded-2xl bg-white">
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-[#707072]">
            No se encontraron marcas.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.letter}>
              <div className="sticky top-0 z-10 bg-[#f5f5f5] px-4 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#707072] border-y border-[#e5e5e5] first:border-t-0">
                {group.letter}
              </div>
              {group.brands.map((brand) => {
                const isActive = selectedBrandIds.includes(brand._id);
                return (
                  <label
                    key={brand._id}
                    className="flex items-center gap-3 px-4 py-2 text-xs cursor-pointer hover:bg-[#f5f5f5] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onToggleBrand(brand._id)}
                      className="w-4 h-4 accent-[#111111] cursor-pointer"
                    />
                    <span className={isActive ? "font-bold text-[#111111]" : "font-medium text-[#111111]"}>
                      {brand.name}
                    </span>
                  </label>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
