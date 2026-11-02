import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';
import { createServerTenantContext, isServerDatabaseConfigured } from '@/lib/serverDb';
import { writeCloudRecords } from '@/lib/serverCloudRecords';

/**
 * POST /api/cloud/write
 * App ka har change (order, bill, purchase, payment, stock...) turant cloud me save karta hai.
 * Body: { records: [{ store, id, business_id, data, deleted? }] }
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }

    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Login expired. Please log in again.' }, { status: 401 });
    }

    if (!isServerDatabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Cloud database is not configured on the server.' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.records)) {
      return NextResponse.json({ success: false, error: 'Invalid payload. Expected { records: [] }.' }, { status: 400 });
    }

    const context = createServerTenantContext(auth.session);
    const result = await writeCloudRecords(context, body.records);
    return NextResponse.json(result);
  } catch (err: any) {
    const msg = String(err?.message || 'Failed to save to cloud');
    console.error('[API Cloud Write Error]:', msg);
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
