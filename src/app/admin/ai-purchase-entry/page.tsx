'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AIPurchaseEntryRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/purchase/import');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-600">Redirecting to AI Purchase Import...</p>
      </div>
    </div>
  );
}
