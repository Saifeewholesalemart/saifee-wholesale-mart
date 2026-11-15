'use client';

import React, { Suspense } from 'react';
import BillingTerminal from '@/components/terminal/BillingTerminal';

export default function BillingTerminalPage() {
  return (
    <Suspense fallback={null}>
      <BillingTerminal />
    </Suspense>
  );
}
