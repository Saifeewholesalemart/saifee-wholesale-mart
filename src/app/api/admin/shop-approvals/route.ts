import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';
import { isServerDatabaseConfigured } from '@/lib/serverDb';
import { countPendingShops, decideShop, listPendingShops } from '@/lib/serverShopSignup';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Login expired. Please log in again.' }, { status: 401 }) };
  const pt = String(auth.session.profileType || '').toUpperCase();
  if (auth.session.role !== 'admin' && pt !== 'ADMIN' && pt !== 'SUPERUSER') {
    return { error: NextResponse.json({ success: false, error: 'Only admin can approve shops.' }, { status: 403 }) };
  }
  if (!isServerDatabaseConfigured()) {
    return { error: NextResponse.json({ success: false, error: 'Cloud database is not configured on the server.' }, { status: 503 }) };
  }
  return { auth, businessId: auth.session.businessId || (auth.profile as any).business_id || 'biz-saifee' };
}

/** GET /api/admin/shop-approvals[?count=1] — shops waiting for approval */
export async function GET(req: NextRequest) {
  try {
    const r = await requireAdmin(req);
    if ('error' in r) return r.error;
    if (new URL(req.url).searchParams.get('count')) {
      return NextResponse.json({ success: true, pending: await countPendingShops(r.businessId) });
    }
    return NextResponse.json({ success: true, shops: await listPendingShops(r.businessId) });
  } catch (err: any) {
    console.error('[API Shop Approvals Error]:', err?.message);
    return NextResponse.json(
      { success: false, error: 'Could not load shops. If this is the first time, run supabase/020_shop_registration_approval.sql.' },
      { status: 500 }
    );
  }
}

/** POST /api/admin/shop-approvals  { retailer_id, action: 'approve' | 'reject', credit_limit? } */
export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }
    const r = await requireAdmin(req);
    if ('error' in r) return r.error;
    const body = await req.json().catch(() => null);
    const retailerId = String(body?.retailer_id || '');
    const action = body?.action === 'approve' ? 'approve' : body?.action === 'reject' ? 'reject' : null;
    if (!retailerId || !action) {
      return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
    }
    const credit = body?.credit_limit === undefined || body?.credit_limit === null || body?.credit_limit === '' ? null : Number(body.credit_limit);
    const ok = await decideShop(r.businessId, retailerId, action, r.auth.session.userId, credit);
    if (!ok) return NextResponse.json({ success: false, error: 'Shop not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API Shop Approvals Error]:', err?.message);
    return NextResponse.json({ success: false, error: 'Could not save the decision. Please try again.' }, { status: 500 });
  }
}
