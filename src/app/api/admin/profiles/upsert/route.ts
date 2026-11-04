import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthenticatedUser, validateCsrfOrigin, sanitizeProfile } from '@/lib/authSession';
import { executeRawQuery, isServerDatabaseConfigured } from '@/lib/serverDb';

/**
 * POST /api/admin/profiles/upsert
 * Admin-only. Profile (admin / sales / retailer / staff: biller, packer, ...) ko
 * cloud database (PostgreSQL) me banata ya update karta hai.
 *
 * Safety:
 *  - Sirf logged-in admin chala sakta hai. Business (tenant) session se aata hai, client se nahi.
 *  - Password server par bcrypt se hash hota hai. Plain password kahin store nahi hota.
 *  - Doosre business ki profile ko chhoo nahi sakta.
 *  - Admin apne aap ko deactivate ya demote nahi kar sakta.
 */

const ALLOWED_ROLES = ['admin', 'sales_dist', 'sales_co', 'retailer', 'staff'];

function digits10(v: unknown): string {
  return String(v ?? '').replace(/[^0-9]/g, '').slice(-10);
}

function profileTypeFor(role: string): string {
  if (role === 'admin') return 'ADMIN';
  if (role === 'sales_dist' || role === 'sales_co') return 'SALESPERSON';
  if (role === 'retailer') return 'RETAILER';
  return 'STAFF';
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }

    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please log in.' }, { status: 401 });
    }
    if (auth.session.role !== 'admin' && auth.session.profileType !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Only an administrator can manage profiles.' }, { status: 403 });
    }
    if (!isServerDatabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Server database is not configured.' }, { status: 503 });
    }

    const businessId = auth.session.businessId;
    const body = await req.json().catch(() => null);
    const p: any = body && typeof body === 'object' ? body.profile : null;
    const password = typeof body?.password === 'string' ? body.password.trim() : '';

    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id.trim()) {
      return NextResponse.json({ success: false, error: 'Invalid profile payload.' }, { status: 400 });
    }

    const id = p.id.trim();
    const role = String(p.role || '');
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role.' }, { status: 400 });
    }

    const fullName = String(p.full_name || p.name || '').trim();
    if (!fullName) {
      return NextResponse.json({ success: false, error: 'Name is required.' }, { status: 400 });
    }

    const mobile = digits10(p.mobile || p.contact_no || p.phone);
    if (mobile.length !== 10) {
      return NextResponse.json({ success: false, error: 'A valid 10-digit mobile number is required.' }, { status: 400 });
    }

    if (password && password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const active = p.active !== false;
    if (id === auth.session.userId && (!active || role !== 'admin')) {
      return NextResponse.json(
        { success: false, error: 'You cannot deactivate or demote your own admin account.' },
        { status: 400 }
      );
    }

    // Is mobile se is business me koi aur profile pehle se hai? (login me confusion na ho)
    const dup = await executeRawQuery<any>(
      `SELECT id FROM profiles
        WHERE business_id = $1 AND id <> $2
          AND right(regexp_replace(coalesce(mobile, ''), '[^0-9]', '', 'g'), 10) = $3
        LIMIT 1`,
      [businessId, id, mobile]
    );
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `A profile with mobile number ${mobile} already exists.` },
        { status: 409 }
      );
    }

    const existing = await executeRawQuery<any>('SELECT id, business_id FROM profiles WHERE id = $1 LIMIT 1', [id]);
    if (existing.rows.length > 0 && existing.rows[0].business_id !== businessId) {
      return NextResponse.json({ success: false, error: 'Profile belongs to another business.' }, { status: 403 });
    }

    const email = (str(p.email) || `${mobile}@${role}.saifee.local`).toLowerCase();
    const profileType = profileTypeFor(role);
    const salesRoleType = role === 'sales_dist' ? 'DISTRIBUTOR' : role === 'sales_co' ? 'COMPANY' : null;
    const tradeScope = p.trade_scope === 'ALL' || p.trade_scope === 'RESTRICTED' ? p.trade_scope : null;
    const categoryAccessMode = p.category_access_mode === 'custom' ? 'custom' : 'all';
    const assignedCompanyIds = JSON.stringify(Array.isArray(p.assigned_company_ids) ? p.assigned_company_ids : []);
    const assignedCategoryIds = JSON.stringify(Array.isArray(p.assigned_category_ids) ? p.assigned_category_ids : []);
    const status = active ? 'ACTIVE' : 'INACTIVE';
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    let savedRow: any;
    try {
      if (existing.rows.length === 0) {
        if (!passwordHash) {
          return NextResponse.json({ success: false, error: 'Password is required for a new profile.' }, { status: 400 });
        }
        const ins = await executeRawQuery<any>(
          `INSERT INTO profiles (
             id, business_id, email, mobile, phone, contact_no, name, full_name, role, profile_type,
             sales_role_type, trade_scope, custom_role, department, password_hash, company_id, retailer_id,
             assigned_company_ids, assigned_category_ids, category_access_mode, active, status
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17,
             $18::jsonb, $19::jsonb, $20, $21, $22
           ) RETURNING *;`,
          [
            id, businessId, email, mobile, mobile, mobile, fullName, fullName, role, profileType,
            salesRoleType, tradeScope, str(p.custom_role), str(p.department), passwordHash, str(p.company_id), str(p.retailer_id),
            assignedCompanyIds, assignedCategoryIds, categoryAccessMode, active, status
          ]
        );
        savedRow = ins.rows[0];
      } else {
        const upd = await executeRawQuery<any>(
          `UPDATE profiles SET
             email = $3, mobile = $4, phone = $5, contact_no = $6, name = $7, full_name = $8,
             role = $9, profile_type = $10, sales_role_type = $11, trade_scope = $12,
             custom_role = $13, department = $14, company_id = $15, retailer_id = $16,
             assigned_company_ids = $17::jsonb, assigned_category_ids = $18::jsonb,
             category_access_mode = $19, active = $20, status = $21,
             password_hash = COALESCE($22, password_hash),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND business_id = $2
           RETURNING *;`,
          [
            id, businessId, email, mobile, mobile, mobile, fullName, fullName,
            role, profileType, salesRoleType, tradeScope,
            str(p.custom_role), str(p.department), str(p.company_id), str(p.retailer_id),
            assignedCompanyIds, assignedCategoryIds,
            categoryAccessMode, active, status,
            passwordHash
          ]
        );
        savedRow = upd.rows[0];
      }
    } catch (dbErr: any) {
      const msg = String(dbErr?.message || '');
      if (dbErr?.code === '23505' || /duplicate|unique/i.test(msg)) {
        return NextResponse.json(
          { success: false, error: 'This email or mobile number is already used by another profile.' },
          { status: 409 }
        );
      }
      throw dbErr;
    }

    // Admin switched a pending shop login on from Manage Profiles: treat it as approved
    if (active && savedRow?.approval_status === 'pending') {
      try {
        await executeRawQuery(
          `UPDATE profiles SET approval_status = 'approved', approved_by = $2, approved_at = now() WHERE id = $1`,
          [savedRow.id, auth.session.userId]
        );
        savedRow.approval_status = 'approved';
      } catch { /* column missing until 020 is run */ }
    }

    return NextResponse.json({ success: true, profile: sanitizeProfile(savedRow) });
  } catch (err: any) {
    console.error('[API Admin Profiles Upsert Error]:', err);
    return NextResponse.json({ success: false, error: 'Failed to save profile.' }, { status: 500 });
  }
}
