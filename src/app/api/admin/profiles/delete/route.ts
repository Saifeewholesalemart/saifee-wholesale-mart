import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';
import { executeRawQuery, isServerDatabaseConfigured } from '@/lib/serverDb';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/profiles/delete   (admin only)
 * Body: { profile_id?: string, retailer_id?: string, remove_shop?: boolean }
 *
 * Permanently deletes a login (profile). For a shop, the shop record itself can also be
 * removed, but only when it has no orders, bills or payments (accounts must stay correct).
 * A shop with history keeps its record; only its login is deleted.
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }
    const auth = await getAuthenticatedUser(req);
    if (!auth) return NextResponse.json({ success: false, error: 'Login expired. Please log in again.' }, { status: 401 });
    const pt = String(auth.session.profileType || '').toUpperCase();
    if (auth.session.role !== 'admin' && pt !== 'ADMIN' && pt !== 'SUPERUSER') {
      return NextResponse.json({ success: false, error: 'Only an administrator can delete profiles.' }, { status: 403 });
    }
    if (!isServerDatabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Cloud database is not configured on the server.' }, { status: 503 });
    }

    const businessId = auth.session.businessId || (auth.profile as any).business_id || 'biz-saifee';
    const body = await req.json().catch(() => null);
    const profileId = typeof body?.profile_id === 'string' ? body.profile_id.trim() : '';
    let retailerId = typeof body?.retailer_id === 'string' ? body.retailer_id.trim() : '';
    const removeShop = body?.remove_shop === true;
    if (!profileId && !retailerId) {
      return NextResponse.json({ success: false, error: 'Nothing to delete.' }, { status: 400 });
    }

    // 1. Find the login(s)
    let profiles: any[] = [];
    if (profileId) {
      const r = await executeRawQuery<any>('SELECT id, name, role, retailer_id, business_id FROM profiles WHERE id = $1', [profileId]);
      profiles = r.rows;
      if (profiles.length && profiles[0].business_id !== businessId) {
        return NextResponse.json({ success: false, error: 'This profile belongs to another business.' }, { status: 403 });
      }
      if (profiles.length && profiles[0].retailer_id && !retailerId) retailerId = profiles[0].retailer_id;
    }
    if (retailerId) {
      const r = await executeRawQuery<any>(
        'SELECT id, name, role, retailer_id, business_id FROM profiles WHERE retailer_id = $1 AND business_id = $2',
        [retailerId, businessId]
      );
      const seen = new Set(profiles.map(p => p.id));
      r.rows.forEach((p: any) => { if (!seen.has(p.id)) profiles.push(p); });
    }

    // 2. Safety: never delete yourself or the last admin
    if (profiles.some(p => p.id === auth.session.userId)) {
      return NextResponse.json({ success: false, error: 'You cannot delete your own login.' }, { status: 400 });
    }
    if (profiles.some(p => p.role === 'admin')) {
      const admins = await executeRawQuery<{ n: string }>(
        `SELECT count(*)::text AS n FROM profiles WHERE business_id = $1 AND role = 'admin' AND coalesce(active, TRUE)`,
        [businessId]
      );
      const deletingAdmins = profiles.filter(p => p.role === 'admin').length;
      if (Number(admins.rows[0]?.n || 0) - deletingAdmins < 1) {
        return NextResponse.json({ success: false, error: 'At least one admin login must remain.' }, { status: 400 });
      }
    }

    // 3. Delete the login(s) and their location history
    const ids = profiles.map(p => p.id);
    if (ids.length > 0) {
      try {
        await executeRawQuery('DELETE FROM salesman_locations WHERE business_id = $1 AND user_id = ANY($2::text[])', [businessId, ids]);
      } catch { /* tracking table not created yet */ }
      try {
        await executeRawQuery('DELETE FROM profiles WHERE business_id = $1 AND id = ANY($2::text[])', [businessId, ids]);
      } catch (err: any) {
        if (err?.code === '23503' || /foreign key/i.test(String(err?.message || ''))) {
          return NextResponse.json(
            { success: false, error: 'This login is linked to other records and cannot be deleted. Deactivate it instead.' },
            { status: 409 }
          );
        }
        throw err;
      }
    }

    // 4. Shop record (only when asked, and only without any history)
    let shopRemoved = false;
    let shopKeptReason = '';
    if (retailerId && removeShop) {
      const hist = await executeRawQuery<{ n: string }>(
        `SELECT count(*)::text AS n FROM app_records
          WHERE business_id = $1 AND NOT deleted
            AND store IN ('fmcg_orders','fmcg_invoices','fmcg_payments','fmcg_sales_returns','fmcg_delivery_challans')
            AND data->>'retailer_id' = $2`,
        [businessId, retailerId]
      );
      if (Number(hist.rows[0]?.n || 0) > 0) {
        shopKeptReason = 'The shop has orders, bills or payments, so its record is kept for your accounts. Only the login was deleted.';
      } else {
        await executeRawQuery(
          `UPDATE app_records SET deleted = TRUE, updated_at = clock_timestamp(), updated_by = $3
            WHERE business_id = $1 AND store = 'fmcg_retailers' AND id = $2`,
          [businessId, retailerId, `profile-delete:${auth.session.userId}`]
        );
        try {
          await executeRawQuery('UPDATE retailers SET active = FALSE, updated_at = now() WHERE id = $1 AND business_id = $2', [retailerId, businessId]);
        } catch { /* old table may not exist */ }
        shopRemoved = true;
      }
    }

    if (ids.length === 0 && !shopRemoved) {
      return shopKeptReason
        ? NextResponse.json({ success: false, error: 'This shop has orders, bills or payments, so it cannot be deleted. You can deactivate it instead.' }, { status: 409 })
        : NextResponse.json({ success: false, error: 'Profile not found. It may already be deleted.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedProfileIds: ids, shopRemoved, shopKeptReason, retailerId: retailerId || null });
  } catch (err: any) {
    console.error('[API Profile Delete Error]:', err?.message);
    return NextResponse.json({ success: false, error: 'Could not delete. Please try again.' }, { status: 500 });
  }
}
