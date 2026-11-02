import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authSession';
import { createServerTenantContext, isServerDatabaseConfigured } from '@/lib/serverDb';
import { loadCloudRecords, retailerScopeFor } from '@/lib/serverCloudRecords';

/**
 * POST /api/cloud/load
 * Ek company ka cloud data (ya `since` ke baad ke changes) page-by-page deta hai.
 * Body: { business_id, since?, after?, limit? }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Login expired. Please log in again.' }, { status: 401 });
    }

    if (!isServerDatabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Cloud database is not configured on the server.' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({} as any));
    const context = createServerTenantContext(auth.session);
    const result = await loadCloudRecords(context, {
      business_id: typeof body.business_id === 'string' ? body.business_id : context.businessId,
      since: typeof body.since === 'string' ? body.since : null,
      after: body.after && typeof body.after === 'object' ? body.after : null,
      limit: typeof body.limit === 'number' ? body.limit : undefined
    }, retailerScopeFor(context, auth.profile));
    return NextResponse.json(result);
  } catch (err: any) {
    const msg = String(err?.message || 'Failed to load cloud data');
    console.error('[API Cloud Load Error]:', msg);
    const missingTable = /app_records/.test(msg) && /does not exist/.test(msg);
    return NextResponse.json(
      {
        success: false,
        error: missingTable ? 'Cloud table app_records missing. Run supabase/010_cloud_records.sql.' : msg,
        setupRequired: missingTable || undefined
      },
      { status: missingTable ? 503 : err?.statusCode || 500 }
    );
  }
}
