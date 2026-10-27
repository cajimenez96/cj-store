'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AdminNav } from '@/components/admin/AdminNav';
import { ProductForm } from '@/components/admin/ProductForm';
import { Loader2 } from 'lucide-react';
import { IProductImage } from '@/models/Product';

interface FullProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  brandId: { _id: string; name: string } | string;
  active: boolean;
  images: IProductImage[];
}

export default function EditProductPage() {
  const params = useParams();
  const id = params?.id as string;

  const [product, setProduct] = useState<FullProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;
      try {
        const res = await fetch(`/api/admin/products/${id}`);
        const json = await res.json();
        if (json.ok) {
          setProduct(json.data);
        } else {
          setError(json.message || 'Producto no encontrado');
        }
      } catch (err) {
        console.error('Error al cargar producto para edición:', err);
        setError('Error al conectar con el servidor');
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#111111] font-sans">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-[#111111]">
            Editar Producto
          </h1>
          <p className="text-xs text-[#707072] mt-1">
            Modificá precio, nombre, descripción, imágenes y cantidades por talle. Marca, Tipo y Género se mantienen fijos.
          </p>
        </div>

        {loading ? (
          <div className="py-24 text-center text-xs text-[#707072] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando información del producto...
          </div>
        ) : error ? (
          <div className="p-4 bg-[#d30005]/10 border border-[#d30005] text-[#d30005] text-xs font-semibold">
            {error}
          </div>
        ) : product ? (
          <ProductForm initialData={product} isEditing={true} />
        ) : null}
      </main>
    </div>
  );
}
