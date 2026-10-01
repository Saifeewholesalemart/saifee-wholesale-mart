'use client';

import React, { use } from 'react';
import { useRouter } from 'next/navigation';
import CentralItemDetailHub from '@/components/CentralItemDetailHub';
import { useDb } from '@/context/DbContext';
import { Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const { id } = use(params);
  const { products } = useDb();

  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Item Not Found</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            The item with ID &ldquo;<span className="font-mono text-slate-700">{id}</span>&rdquo; could not be found in the system. It may have been deleted or the ID is incorrect.
          </p>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Item Master
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <CentralItemDetailHub
        productId={id}
        onBack={() => router.push('/admin/products')}
      />
    </div>
  );
}
