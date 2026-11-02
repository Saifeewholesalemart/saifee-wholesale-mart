'use client';

/**
 * Keeps a screen step (cart, checkout, packing...) in the page URL (?step=...),
 * so the phone / browser Back button goes to the previous step instead of leaving the app.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useUrlStep<T extends string>(
  param: string,
  initial: T,
  allowed: readonly T[] | null // null = any value
): [T, (value: T, options?: { replace?: boolean }) => void] {
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;

  const read = useCallback((): T => {
    if (typeof window === 'undefined') return initial;
    const v = new URLSearchParams(window.location.search).get(param) as T | null;
    return v && (!allowedRef.current || allowedRef.current.includes(v)) ? v : initial;
  }, [param, initial]);

  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    setValue(read());
    const onPop = () => setValue(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [read]);

  const set = useCallback((next: T, options?: { replace?: boolean }) => {
    setValue(next);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (next === initial) url.searchParams.delete(param);
    else url.searchParams.set(param, next);
    if (url.href === window.location.href) return;
    // null state: Next.js adds its own router state and keeps its URL in sync
    if (options?.replace) window.history.replaceState(null, '', url.toString());
    else window.history.pushState(null, '', url.toString());
  }, [param, initial]);

  return [value, set];
}

/** Home page for each role (used when someone who is already signed in opens the login page). */
export function homePathFor(user: { role?: string; profile_type?: string } | null | undefined): string | null {
  if (!user) return null;
  const pt = String(user.profile_type || '').toUpperCase();
  const role = String(user.role || '').toLowerCase();
  if (pt === 'ADMIN' || pt === 'SUPERUSER' || role === 'admin') return '/admin/orders';
  if (pt === 'SALESPERSON' || role === 'sales_dist' || role === 'sales_co') return '/salesperson/dashboard';
  if (pt === 'STAFF' || role === 'staff') return '/staff/dashboard';
  if (pt === 'RETAILER' || role === 'retailer') return '/retailer/home';
  return null;
}
