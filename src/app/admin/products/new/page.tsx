'use client';

import React from 'react';
import { AdminNav } from '@/components/admin/AdminNav';
import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#111111] font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-[#111111]">
            Crear Nuevo Producto
          </h1>
          <p className="text-xs text-[#707072] mt-1">
            Completá los datos del producto, las imágenes y cargá el stock inicial por variante.
          </p>
        </div>

        <ProductForm />
      </main>
    </div>
  );
}
