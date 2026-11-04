import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';
import { isServerDatabaseConfigured } from '@/lib/serverDb';
import { createSalesmanShopLogin, mobileInUse, validateShopInput } from '@/lib/serverShopSignup';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sales/shop-login  (salesman only)
 * Gives a login to a shop the salesman just registered. The login stays "pending"
 * until the admin approves the shop.
 * Body: { retailer_id, shop_name, owner_name, mobile, city, address, gstin?, password }
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }
    const auth = await getAuthenticatedUser(req);
    if (!auth) return NextResponse.json({ success: false, error: 'Login expired. Please log in again.' }, { status: 401 });
    if (auth.session.role !== 'sales_dist' && auth.session.role !== 'sales_co') {
      return NextResponse.json({ success: false, error: 'Only a salesperson can do this.' }, { status: 403 });
    }
    if (!isServerDatabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Cloud database is not configured on the server.' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const v = validateShopInput(body, { requirePassword: true });
    if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: 400 });

    const businessId = auth.session.businessId || (auth.profile as any).business_id || 'biz-saifee';
    if (await mobileInUse(businessId, v.value.mobile, false)) {
      return NextResponse.json({ success: false, error: 'A login with this mobile number already exists.' }, { status: 409 });
    }
    await createSalesmanShopLogin(businessId, auth.session.userId, String(body?.retailer_id || ''), v.value);
    return NextResponse.json({ success: true, pending: true });
  } catch (err: any) {
    const msg = String(err?.message || '');
    console.error('[API Sales Shop Login Error]:', msg);
    if (err?.code === '23505' || /duplicate|unique/i.test(msg)) {
      return NextResponse.json({ success: false, error: 'A login with this mobile number already exists.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: msg === 'Invalid shop.' ? msg : 'Shop login could not be created.' }, { status: 500 });
  }
}
