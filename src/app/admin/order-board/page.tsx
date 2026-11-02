'use client';

import React from 'react';
import OrderBoard from '@/components/flow/OrderBoard';

export default function OrderBoardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Order Board</h1>
        <p className="text-sm text-slate-600">To Pack → Ready to Bill → Billed. Short items go to Backorder automatically.</p>
      </div>
      <OrderBoard />
    </div>
  );
}
