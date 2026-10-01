'use client';

import React, { useEffect } from 'react';
import { DbProvider } from '@/context/DbContext';
import RoleSwitcher from './RoleSwitcher';
import ErrorBoundary from './ErrorBoundary';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Unregister any stale service workers and clear old caches
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <DbProvider>
        <div className="flex-1 flex flex-col min-h-screen">
          {children}
          <RoleSwitcher />
        </div>
      </DbProvider>
    </ErrorBoundary>
  );
}
