'use client';

/**
 * The Invoices page is now part of the Billing Terminal ("All bills").
 * Old links keep working: ?id= / ?invoice= open that bill, ?search= filters the list.
 */

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectToTerminal() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const bill = params?.get('id') || params?.get('invoice');
    const search = params?.get('search');
    if (bill) router.replace(`/admin/terminal?invoice=${encodeURIComponent(bill)}`);
    else router.replace(`/admin/terminal?view=bills${search ? `&search=${encodeURIComponent(search)}` : ''}`);
  }, [params, router]);
  return <div className="p-6 text-slate-600">Opening the bills…</div>;
}

export default function InvoicesRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectToTerminal />
    </Suspense>
  );
}
