'use client';

/**
 * Billing Terminal for the biller (same screen as the admin's Billing Terminal).
 * Open to billers and admins; other staff go back to their own screen.
 */

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useDb } from '@/context/DbContext';
import BillingTerminal from '@/components/terminal/BillingTerminal';

function canUseBillingTerminal(user: any): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.profile_type === 'ADMIN') return true;
  return String(user.custom_role || '').toLowerCase().includes('biller');
}

export default function StaffBillingTerminalPage() {
  const { currentUser } = useDb();
  const router = useRouter();
  const allowed = canUseBillingTerminal(currentUser);

  React.useEffect(() => {
    if (currentUser && !allowed) router.replace('/staff');
  }, [currentUser, allowed, router]);

  if (!allowed) {
    return <p className="p-6 text-sm font-semibold text-slate-600">The Billing Terminal is for billers.</p>;
  }
  return (
    <Suspense fallback={null}>
      <BillingTerminal />
    </Suspense>
  );
}
