'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** The Order Board is now part of the Orders page. */
export default function OrderBoardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/orders'); }, [router]);
  return <p className="text-sm text-slate-600">Opening Orders...</p>;
}
