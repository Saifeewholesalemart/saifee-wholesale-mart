'use client';

/** Debit notes moved to Returns → Purchase Returns. Old links still work. */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DebitNotesMoved() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/returns?tab=purchase'); }, [router]);
  return <p className="text-sm text-slate-500 p-4">Opening Returns → Purchase Returns…</p>;
}
