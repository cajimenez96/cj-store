"use client";

import React, { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { PromoCarousel } from "@/components/home/PromoCarousel";
import {
  ProductGrid,
  FilterBar,
  ProductDetailModal,
  FormattedProduct,
  CartItemAddPayload,
  ProductSort,
} from "@/components/products";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CheckoutModal } from "@/components/checkout";
import { useCart } from "@/context/CartContext";
import { IPromotion } from "@/models/Promotion";
import { apiClient } from "@/lib/api-client";

function HomeContent() {
  const searchParams = useSearchParams();
  const searchQueryParam = searchParams.get("search") || "";
  const genderQueryParam = searchParams.get("gender") || null;
  const clearanceQueryParam = searchParams.get("clearance") === "true";

  const [promotions, setPromotions] = useState<IPromotion[]>([]);
  const [products, setProducts] = useState<FormattedProduct[]>([]);
  const [brands, setBrands] = useState<{ _id: string; name: string }[]>([]);
  const [types, setTypes] = useState<{ _id: string; name: string }[]>([]);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<FormattedProduct | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Filter States
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [selectedGender, setSelectedGender] = useState<string | null>(
    genderQueryParam,
  );
  const [isClearanceOnly, setIsClearanceOnly] = useState<boolean>(clearanceQueryParam);
  const [selectedSort, setSelectedSort] = useState<ProductSort>(null);

  const { addToCart } = useCart();

  useEffect(() => {
    setSelectedGender(genderQueryParam);
  }, [genderQueryParam]);

  useEffect(() => {
    setIsClearanceOnly(clearanceQueryParam);
    if (clearanceQueryParam) {
      setSelectedGender(null);
    }
  }, [clearanceQueryParam]);

  const PAGE_SIZE = 20;

  // 1. Fetch Promotions
  useEffect(() => {
    async function fetchPromotions() {
      try {
        const { data: json } = await apiClient.get("/api/promotions");
        if (json.ok) {
          setPromotions(json.data);
        }
      } catch (err) {
        console.error("Error al cargar promociones:", err);
      }
    }
    fetchPromotions();
  }, []);

  // 2. Fetch Brands & Types for FilterBar
  useEffect(() => {
    async function fetchFilterData() {
      try {
        const [brandsRes, typesRes] = await Promise.all([
          apiClient.get("/api/brands"),
          apiClient.get("/api/types"),
        ]);

        if (brandsRes.data.ok) setBrands(brandsRes.data.data);
        if (typesRes.data.ok) setTypes(typesRes.data.data);
      } catch (err) {
        console.error("Error al cargar opciones de filtro:", err);
      }
    }
    fetchFilterData();
  }, []);

  // 3. Fetch Products with Filters
  const buildProductParams = useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams();

      if (searchQueryParam.trim()) {
        params.append("search", searchQueryParam.trim());
      }
      if (selectedBrandIds.length > 0) {
        params.append("brandId", selectedBrandIds.join(","));
      }
      if (selectedTypeIds.length > 0) {
        params.append("typeId", selectedTypeIds.join(","));
      }
      if (selectedSize !== null) {
        params.append("size", selectedSize.toString());
      }
      if (selectedGender !== null) {
        params.append("gender", selectedGender);
      }
      if (isClearanceOnly) {
        params.append("clearance", "true");
      }
      if (selectedSort) {
        params.append("sort", selectedSort);
      }
      params.append("page", targetPage.toString());
      params.append("limit", PAGE_SIZE.toString());

      return params;
    },
    [
      searchQueryParam,
      selectedBrandIds,
      selectedTypeIds,
      selectedSize,
      selectedGender,
      isClearanceOnly,
      selectedSort,
    ],
  );

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = buildProductParams(1);
      const { data: json } = await apiClient.get(
        `/api/products?${params.toString()}`,
      );

      if (json.ok && Array.isArray(json.data)) {
        setProducts(json.data);
        pageRef.current = 1;
        setPage(1);
        setHasMore(json.pagination.page < json.pagination.totalPages);
      }
    } catch (err) {
      console.error("Error al cargar catálogo:", err);
    } finally {
      setLoadingProducts(false);
    }
  }, [buildProductParams]);

  const fetchMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const params = buildProductParams(nextPage);
      const { data: json } = await apiClient.get(
        `/api/products?${params.toString()}`,
      );

      if (json.ok && Array.isArray(json.data)) {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p._id));
          const newItems = json.data.filter(
            (p: FormattedProduct) => !existingIds.has(p._id),
          );
          return [...prev, ...newItems];
        });
        pageRef.current = nextPage;
        setPage(nextPage);
        setHasMore(json.pagination.page < json.pagination.totalPages);
      }
    } catch (err) {
      console.error("Error al cargar más productos:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [buildProductParams, loadingMore, hasMore]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handlers
  const handleToggleBrand = (brandId: string) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId)
        ? prev.filter((id) => id !== brandId)
        : [...prev, brandId],
    );
  };

  const handleToggleType = (typeId: string) => {
    setSelectedTypeIds((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId],
    );
  };

  const handleClearFilters = () => {
    setSelectedBrandIds([]);
    setSelectedTypeIds([]);
    setSelectedSize(null);
    setSelectedGender(null);
    setIsClearanceOnly(false);
    setSelectedSort(null);
  };

  const handleAddToCart = (payload: CartItemAddPayload) => {
    addToCart(
      payload.product,
      {
        variantId: payload.variantId,
        variantLabel: payload.variantLabel,
        variantName: payload.variantName,
        sku: payload.sku,
        retailPrice: payload.retailPrice,
        wholesalePrice: payload.wholesalePrice,
        size: payload.size,
      },
      payload.qty
    );
  };

  const handleStartCheckout = () => {
    setIsCheckoutOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
      {/* 1. Hero Promo Carousel */}
      <PromoCarousel promotions={promotions} />

      {/* 2. Catalog Section */}
      <section id="catalogo" className="mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111111] uppercase tracking-tight flex items-center gap-2">
              {isClearanceOnly ? (
                <>
                  <span className="text-[#d30005]">🔥 Fragancias en Oferta</span>
                  <span className="text-xs font-bold text-[#d30005] bg-[#d30005]/10 px-2.5 py-0.5 rounded-full border border-[#d30005]/20">
                    OFERTAS EXCLUSIVAS
                  </span>
                </>
              ) : (
                "Catálogo de Fragancias"
              )}
            </h2>
            <p className="text-xs text-[#707072] mt-0.5">
              {isClearanceOnly
                ? "Aprovechá productos seleccionados con precios promocionales y descuentos especiales."
                : searchQueryParam
                ? `Resultados para "${searchQueryParam}"`
                : "Descubrí nuestro stock disponible. Elegí tu fragancia o presentación y hacé tu pedido directo por WhatsApp."}
            </p>
          </div>
          {isClearanceOnly && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-bold text-[#111111] hover:underline bg-[#f5f5f5] px-3 py-1.5 rounded-full border border-[#e5e5e5] cursor-pointer"
            >
              Ver todo el catálogo
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <FilterBar
          brands={brands}
          types={types}
          selectedBrandIds={selectedBrandIds}
          selectedTypeIds={selectedTypeIds}
          selectedSize={selectedSize}
          selectedGender={selectedGender}
          selectedSort={selectedSort}
          onToggleBrand={handleToggleBrand}
          onToggleType={handleToggleType}
          onSelectSize={setSelectedSize}
          onSelectGender={setSelectedGender}
          onSelectSort={setSelectedSort}
          onClearFilters={handleClearFilters}
        />

        {/* Product Grid */}
        <ProductGrid
          products={products}
          loading={loadingProducts}
          onSelectProduct={(product) => setSelectedProduct(product)}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={fetchMoreProducts}
        />
      </section>

      {/* 3. Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* 4. Cart Slide-Over Drawer */}
      <CartDrawer onStartCheckout={handleStartCheckout} />

      {/* 5. Epicodes 3-Step Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-xs text-[#707072]">
          Cargando catálogo...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
