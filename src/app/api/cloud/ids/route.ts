import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authSession';
import { isServerDatabaseConfigured } from '@/lib/serverDb';
import { getCloudIdLists } from '@/lib/serverCloudIds';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cloud/ids
 * IDs of records that exist in the cloud (per store), so a device can drop leftovers.
 * Not for retailer logins (a shop device keeps only its own data anyway).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return NextResponse.json({ success: false, error: 'Login expired.' }, { status: 401 });
    if (auth.session.role === 'retailer') {
      return NextResponse.json({ success: false, error: 'Not available for shop logins.' }, { status: 403 });
    }
    if (!isServerDatabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Cloud database is not configured.' }, { status: 503 });
    }
    const businessId = auth.session.businessId || (auth.profile as any).business_id || 'biz-saifee';
    const at = new Date().toISOString();
    const stores = await getCloudIdLists(businessId);
    return NextResponse.json({ success: true, businessId, at, stores });
  } catch (err: any) {
    console.error('[API Cloud Ids Error]:', err?.message);
    return NextResponse.json({ success: false, error: 'Could not read cloud data.' }, { status: 500 });
  }
}
