import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authSession';
import { isServerDatabaseConfigured } from '@/lib/serverDb';
import { getOrderPoints, getSalesmanDay, getSalesmenSummary, istDayRange } from '@/lib/serverTracking';

export const dynamic = 'force-dynamic';

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}

/**
 * GET /api/tracking            -> all salesmen with last location and duty state (admin only)
 * GET /api/tracking?user=ID&date=YYYY-MM-DD -> one salesman's points for that day (IST)
 * GET /api/tracking?shops=1     -> places where orders were taken (to show shops on the map)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Login expired. Please log in again.' }, { status: 401 });
    }
    const pt = String(auth.session.profileType || '').toUpperCase();
    if (auth.session.role !== 'admin' && pt !== 'ADMIN' && pt !== 'SUPERUSER') {
      return NextResponse.json({ success: false, error: 'Only admin can see salesman locations.' }, { status: 403 });
    }
    if (!isServerDatabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Cloud database is not configured on the server.' }, { status: 503 });
    }

    const businessId = auth.session.businessId || (auth.profile as any).business_id || 'biz-saifee';
    const url = new URL(req.url);
    const userId = url.searchParams.get('user');
    const date = url.searchParams.get('date') || todayIst();
    const range = istDayRange(date);
    if (!range) {
      return NextResponse.json({ success: false, error: 'Invalid date.' }, { status: 400 });
    }

    if (url.searchParams.get('shops')) {
      return NextResponse.json({ success: true, points: await getOrderPoints(businessId) });
    }
    if (userId) {
      const points = await getSalesmanDay(businessId, userId, range);
      return NextResponse.json({ success: true, date, points });
    }
    const salesmen = await getSalesmenSummary(businessId, istDayRange(todayIst())!);
    return NextResponse.json({ success: true, date, salesmen, serverTime: new Date().toISOString() });
  } catch (err: any) {
    console.error('[API Tracking Error]:', err?.message);
    return NextResponse.json(
      { success: false, error: 'Locations could not be loaded. If this is the first time, run supabase/019_salesman_tracking.sql.' },
      { status: 500 }
    );
  }
}
