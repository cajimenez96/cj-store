"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export interface SearchBarProps {
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  tone?: "light" | "dark";
  onSearchChange?: (term: string) => void;
}

const TONE_CLASSES = {
  light: {
    input: "bg-[#f5f5f5] text-[#111111] placeholder-[#707072] focus:ring-[#111111]",
    icon: "text-[#707072]",
    clear: "text-[#707072] hover:text-[#111111] hover:bg-black/5",
  },
  dark: {
    input: "bg-[#18181b] text-[#f5f5f5] placeholder-[#707072] focus:ring-[#f5f5f5]",
    icon: "text-[#a1a1aa]",
    clear: "text-[#a1a1aa] hover:text-[#f5f5f5] hover:bg-white/5",
  },
} as const;

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Buscar modelo...",
  className = "",
  inputClassName = "",
  tone = "light",
  onSearchChange,
}) => {
  const tones = TONE_CLASSES[tone];
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || "",
  );

  useEffect(() => {
    setSearchTerm(searchParams.get("search") || "");
  }, [searchParams]);

  const updateSearch = (value: string) => {
    setSearchTerm(value);

    if (onSearchChange) {
      onSearchChange(value);
    } else {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("search", value);
      } else {
        params.delete("search");
      }
      router.replace(`/?${params.toString()}#catalogo`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSearch(e.target.value);
  };

  const handleClear = () => {
    updateSearch("");
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleInputChange}
        className={`w-full ${tones.input} text-xs font-medium rounded-full py-2 pl-9 pr-8 focus:outline-none focus:ring-2 transition-all cursor-text ${inputClassName}`}
      />
      <Search className={`w-4 h-4 ${tones.icon} absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none`} />
      {searchTerm && (
        <button
          type="button"
          onClick={handleClear}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${tones.clear} transition-colors cursor-pointer`}
          aria-label="Borrar búsqueda"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
