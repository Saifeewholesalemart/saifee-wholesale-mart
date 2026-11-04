import { NextRequest, NextResponse } from 'next/server';
import { validateCsrfOrigin } from '@/lib/authSession';
import { isServerDatabaseConfigured } from '@/lib/serverDb';
import { createSelfRegistration, mobileInUse, resolvePublicBusinessId, validateShopInput } from '@/lib/serverShopSignup';

export const dynamic = 'force-dynamic';

// Simple per-server limit: max 5 registrations per IP per hour
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 3600000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 5;
}

/**
 * POST /api/auth/register  (public)
 * A shop owner registers. The shop and its login are created as "pending";
 * the shop cannot log in until the admin approves it.
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
    if (tooMany(ip)) {
      return NextResponse.json({ success: false, error: 'Too many registrations from this connection. Please try again after an hour.' }, { status: 429 });
    }
    if (!isServerDatabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Server database is not configured. Please contact the administrator.' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    // Hidden field that people never fill; bots often do
    if (body && typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ success: true, pending: true });
    }
    const v = validateShopInput(body, { requirePassword: true });
    if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 });

    const businessId = await resolvePublicBusinessId();
    if (await mobileInUse(businessId, v.value.mobile, true)) {
      return NextResponse.json(
        { success: false, error: 'This mobile number is already registered. Please log in, or contact the distributor if you forgot the password.' },
        { status: 409 }
      );
    }

    await createSelfRegistration(businessId, v.value);
    return NextResponse.json({ success: true, pending: true });
  } catch (err: any) {
    const msg = String(err?.message || '');
    console.error('[API Register Error]:', msg);
    if (err?.code === '23505' || /duplicate|unique/i.test(msg)) {
      return NextResponse.json({ success: false, error: 'This mobile number is already registered.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Registration could not be completed. Please try again.' }, { status: 500 });
  }
}
