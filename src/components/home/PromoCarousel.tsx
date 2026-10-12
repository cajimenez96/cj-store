"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { IPromotion } from "@/models/Promotion";

interface PromoCarouselProps {
  promotions?: IPromotion[];
}

export const PromoCarousel: React.FC<PromoCarouselProps> = ({
  promotions = [],
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    if (promotions.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex + 1) % promotions.length);
  }, [promotions.length]);

  const prevSlide = () => {
    if (promotions.length === 0) return;
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? promotions.length - 1 : prevIndex - 1,
    );
  };

  useEffect(() => {
    if (isPaused || promotions.length <= 1) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused, promotions.length, nextSlide]);

  if (!promotions || promotions.length === 0) {
    return (
      <div className="w-full bg-[#111111] text-white py-12 px-6 text-center my-4 rounded-none">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold uppercase tracking-wider text-white">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> The Point
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight uppercase">
            Fragancias & Perfumes Exclusivos
          </h2>
          <p className="text-sm text-[#cacacb]">
            Elegí tus fragancias favoritas, consultá disponibilidad en tiempo real y
            gestioná tu pedido por WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  const currentPromo = promotions[currentIndex];
  const hasText = Boolean(currentPromo.title?.trim() || currentPromo.description?.trim());

  return (
    <div
      className="relative w-full overflow-hidden bg-[#111111] my-4 group select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Banner Slide */}
      <div className="relative h-[320px] sm:h-[420px] md:h-[480px] w-full flex items-center">
        <Image
          src={currentPromo.imageUrl}
          alt={currentPromo.title || "Banner promocional"}
          fill
          priority
          sizes="100vw"
          className={`object-cover object-center ${
            hasText ? "opacity-70" : "opacity-100"
          } transition-opacity duration-700`}
        />

        {/* Gradient Overlay only if text is present */}
        {hasText && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        )}

        {/* Content Container */}
        {hasText && (
          <div className="relative max-w-7xl mx-auto px-6 sm:px-12 w-full z-10 space-y-4">
            {currentPromo.title && (
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white uppercase max-w-2xl leading-[0.95]">
                {currentPromo.title}
              </h2>
            )}
            {currentPromo.description && (
              <p className="text-sm sm:text-base text-gray-200 max-w-lg line-clamp-2">
                {currentPromo.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Prev / Next Controls */}
      {promotions.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            aria-label="Anterior banner"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#111111] flex items-center justify-center backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-md active:scale-90"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={nextSlide}
            aria-label="Siguiente banner"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-[#111111] flex items-center justify-center backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow-md active:scale-90"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Pagination Indicator Dots */}
      {promotions.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {promotions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Ir al banner ${index + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                currentIndex === index
                  ? "w-8 bg-white"
                  : "w-2.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
