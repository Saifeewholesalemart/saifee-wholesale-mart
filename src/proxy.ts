/**
 * Server-side page guard (Next.js 16 "proxy", earlier called middleware).
 *
 * Har protected page ka HTML bhejne se pehle server signed session cookie check karta hai:
 * - Login nahi hai  -> login page (/) par bhej do
 * - Galat role      -> us user ke apne home page par bhej do
 * Isse bina login ke admin/staff/sales pages ka koi bhi hissa browser tak nahi pahunchta.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, SessionPayload } from '@/lib/authSession';

type Area = 'admin' | 'staff' | 'sales' | 'retailer';

function areaOf(pathname: string): Area | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/staff' || pathname.startsWith('/staff/')) return 'staff';
  if (pathname === '/sales' || pathname.startsWith('/sales/') || pathname === '/salesperson' || pathname.startsWith('/salesperson/')) return 'sales';
  if (pathname === '/retailer' || pathname.startsWith('/retailer/')) return 'retailer';
  return null;
}

function isAdmin(s: SessionPayload): boolean {
  const pt = (s.profileType || '').toUpperCase();
  return s.role === 'admin' || pt === 'ADMIN' || pt === 'SUPERUSER';
}

function isSales(s: SessionPayload): boolean {
  return s.role === 'sales_dist' || s.role === 'sales_co' || (s.profileType || '').toUpperCase() === 'SALESPERSON';
}

function isStaff(s: SessionPayload): boolean {
  return s.role === 'staff' || (s.profileType || '').toUpperCase() === 'STAFF';
}

function homeFor(s: SessionPayload): string {
  if (isAdmin(s)) return '/admin/orders';
  if (isSales(s)) return '/salesperson/dashboard';
  if (isStaff(s)) return '/staff/dashboard';
  return '/retailer/home';
}

function allowed(area: Area, s: SessionPayload): boolean {
  if (isAdmin(s)) return true; // Admin can open everything
  switch (area) {
    case 'admin': return false;
    case 'staff': return isStaff(s);
    case 'sales': return isSales(s);
    case 'retailer': return !isStaff(s) && !isSales(s);
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const area = areaOf(pathname);
  if (!area) return NextResponse.next();

  const session = getSessionFromRequest(req);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (!allowed(area, session)) {
    const url = req.nextUrl.clone();
    url.pathname = homeFor(session);
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/sales/:path*', '/salesperson/:path*', '/retailer/:path*']
};
