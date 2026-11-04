import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';
import { isServerDatabaseConfigured } from '@/lib/serverDb';
import { insertTrackingPoints, sanitizePoints } from '@/lib/serverTracking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tracking/ping
 * Salesman phone sends its location points (only while on duty).
 * Body: { points: [{ kind, lat, lng, accuracy, battery, ref_id, ref_label, recorded_at }] }
 * The user is always taken from the login session, never from the body.
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
    const role = auth.session.role;
    if (role !== 'sales_dist' && role !== 'sales_co') {
      return NextResponse.json({ success: false, error: 'Only salespersons share location.' }, { status: 403 });
    }
    if (!isServerDatabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Cloud database is not configured on the server.' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const points = sanitizePoints(body?.points);
    const businessId = auth.session.businessId || (auth.profile as any).business_id || 'biz-saifee';
    const saved = await insertTrackingPoints(businessId, auth.session.userId, points);
    return NextResponse.json({ success: true, saved });
  } catch (err: any) {
    console.error('[API Tracking Ping Error]:', err?.message);
    return NextResponse.json(
      { success: false, error: 'Location could not be saved. If this keeps happening, run supabase/019_salesman_tracking.sql.' },
      { status: 500 }
    );
  }
}
