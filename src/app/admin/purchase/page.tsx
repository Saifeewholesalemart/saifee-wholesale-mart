'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPurchaseRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/purchases');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex items-center gap-2 text-slate-500 font-semibold text-xs">
        <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span>Redirecting to Purchases...</span>
      </div>
    </div>
  );
}
