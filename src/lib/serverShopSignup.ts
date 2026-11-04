/**
 * Shop registration + admin approval (server side).
 *
 * - A shop owner can register from the login page ("self").
 * - A salesman can register a shop in the field and optionally give it a login.
 * - Both stay "pending" until the admin approves. A pending/rejected shop cannot log in.
 *
 * The shop record lives in app_records (store fmcg_retailers) like every other shop,
 * so all devices get it on their next sync. The login lives in the profiles table.
 * Needs supabase/020_shop_registration_approval.sql.
 */

import bcrypt from 'bcryptjs';
import { executeRawQuery } from './serverDb';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ShopInput {
  shop_name: string;
  owner_name: string;
  mobile: string;
  city: string;
  address: string;
  gstin: string | null;
  password: string | null;
}

const MOBILE_RE = /^[6-9]\d{9}$/;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function lastTenDigits(v: string): string {
  return (v || '').replace(/[^0-9]/g, '').slice(-10);
}

/** Checks the form. Returns the cleaned values or a message for the user. */
export function validateShopInput(raw: any, opts: { requirePassword: boolean }): { ok: true; value: ShopInput } | { ok: false; error: string } {
  const shop_name = clean(raw?.shop_name, 120);
  const owner_name = clean(raw?.owner_name, 80);
  const mobile = lastTenDigits(String(raw?.mobile || ''));
  const city = clean(raw?.city, 60);
  const address = clean(raw?.address, 250);
  const gstinRaw = clean(raw?.gstin, 20).toUpperCase().replace(/\s/g, '');
  const password = typeof raw?.password === 'string' ? raw.password : '';

  if (shop_name.length < 2) return { ok: false, error: 'Please enter the shop name.' };
  if (owner_name.length < 2) return { ok: false, error: "Please enter the owner's name." };
  if (!MOBILE_RE.test(mobile)) return { ok: false, error: 'Please enter a valid 10-digit mobile number.' };
  if (city.length < 2) return { ok: false, error: 'Please enter the city / village.' };
  if (address.length < 5) return { ok: false, error: 'Please enter the shop address.' };
  if (gstinRaw && !GSTIN_RE.test(gstinRaw)) return { ok: false, error: 'GSTIN looks wrong. Leave it empty if you do not have one.' };
  if (opts.requirePassword || password) {
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
    if (password.length > 72) return { ok: false, error: 'Password is too long.' };
  }
  return { ok: true, value: { shop_name, owner_name, mobile, city, address, gstin: gstinRaw || null, password: password || null } };
}

/** The business new shops belong to (single-business setup). */
export async function resolvePublicBusinessId(): Promise<string> {
  const fromEnv = (process.env.DEFAULT_BUSINESS_ID || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const r = await executeRawQuery<{ id: string }>(
      `SELECT id FROM business_companies WHERE id <> 'biz-platform-root' ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1`
    );
    if (r.rows[0]?.id) return r.rows[0].id;
  } catch { /* table may not exist */ }
  return 'biz-saifee';
}

/** Is this mobile already used by a login (and, for self-registration, by a shop)? */
export async function mobileInUse(businessId: string, mobile: string, includeShops: boolean): Promise<boolean> {
  const p = await executeRawQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM profiles
      WHERE right(regexp_replace(coalesce(mobile,''), '[^0-9]', '', 'g'), 10) = $1
         OR right(regexp_replace(coalesce(contact_no,''), '[^0-9]', '', 'g'), 10) = $1
         OR right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), 10) = $1`,
    [mobile]
  );
  if (Number(p.rows[0]?.n || 0) > 0) return true;
  if (!includeShops) return false;
  const s = await executeRawQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM app_records
      WHERE business_id = $1 AND store = 'fmcg_retailers' AND NOT deleted
        AND right(regexp_replace(coalesce(data->>'mobile',''), '[^0-9]', '', 'g'), 10) = $2`,
    [businessId, mobile]
  );
  return Number(s.rows[0]?.n || 0) > 0;
}

async function nextRetailerCode(businessId: string): Promise<string> {
  const r = await executeRawQuery<{ mx: string | null }>(
    `SELECT max(nullif(substring(upper(data->>'retailer_code') FROM 'RET-0*([0-9]+)'), '')::int)::text AS mx
       FROM app_records WHERE business_id = $1 AND store = 'fmcg_retailers'`,
    [businessId]
  );
  const n = Math.max(124, Number(r.rows[0]?.mx || 0)) + 1;
  return `RET-${String(n).padStart(5, '0')}`;
}

function nowIso() { return new Date().toISOString(); }

async function insertPendingProfile(args: {
  businessId: string; retailerId: string; name: string; mobile: string; password: string; registeredBy: string;
}): Promise<string> {
  const id = `p-ret-${args.retailerId}`;
  const hash = await bcrypt.hash(args.password, 10);
  await executeRawQuery(
    `INSERT INTO profiles (
       id, business_id, email, mobile, phone, contact_no, name, full_name, role, profile_type,
       password_hash, retailer_id, assigned_company_ids, assigned_category_ids, category_access_mode,
       active, status, approval_status, registered_by
     ) VALUES ($1,$2,$3,$4,$4,$4,$5,$5,'retailer','RETAILER',$6,$7,'[]'::jsonb,'[]'::jsonb,'all',
               FALSE,'INACTIVE','pending',$8)`,
    [id, args.businessId, `${args.mobile}@retailer.saifee.local`, args.mobile, args.name, hash, args.retailerId, args.registeredBy]
  );
  return id;
}

/** Shop owner registers from the login page. Creates the shop (inactive) and its login (pending). */
export async function createSelfRegistration(businessId: string, input: ShopInput): Promise<{ retailerId: string; code: string }> {
  const retailerId = `ret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const code = await nextRetailerCode(businessId);
  const t = nowIso();
  const shop = {
    id: retailerId,
    business_id: businessId,
    retailer_code: code,
    shop_name: input.shop_name,
    owner_name: input.owner_name,
    address: input.address,
    city: input.city,
    state_code: '23',
    gstin: input.gstin || undefined,
    mobile: input.mobile,
    credit_limit: 50000,
    outstanding: 0,
    active: false,
    category_access_mode: 'all',
    assigned_category_ids: [],
    approval_status: 'pending',
    registered_by: 'self',
    created_at: t,
    updated_at: t
  };

  await insertPendingProfile({ businessId, retailerId, name: input.owner_name, mobile: input.mobile, password: input.password!, registeredBy: 'self' });
  try {
    await executeRawQuery(
      `INSERT INTO app_records (business_id, store, id, data, deleted, updated_by)
       VALUES ($1, 'fmcg_retailers', $2, $3::jsonb, FALSE, 'self-registration')`,
      [businessId, retailerId, JSON.stringify(shop)]
    );
  } catch (err) {
    await executeRawQuery('DELETE FROM profiles WHERE id = $1', [`p-ret-${retailerId}`]).catch(() => undefined);
    throw err;
  }
  return { retailerId, code };
}

/** Salesman gives a login to a shop he registered. The login stays pending until approval. */
export async function createSalesmanShopLogin(businessId: string, salesmanId: string, retailerId: string, input: ShopInput): Promise<string> {
  if (!/^ret-[A-Za-z0-9-]{4,80}$/.test(retailerId)) throw new Error('Invalid shop.');
  return insertPendingProfile({ businessId, retailerId, name: input.owner_name, mobile: input.mobile, password: input.password!, registeredBy: salesmanId });
}

export interface PendingShop {
  retailer_id: string;
  retailer_code: string;
  shop_name: string;
  owner_name: string;
  mobile: string;
  city: string;
  address: string;
  gstin: string | null;
  credit_limit: number;
  registered_by: string;
  registered_by_name: string | null;
  registered_at: string;
  has_login: boolean;
  approval_status: ApprovalStatus;
}

/** Shops waiting for approval (newest first). Rejected ones from the last 30 days are included. */
export async function listPendingShops(businessId: string): Promise<PendingShop[]> {
  const r = await executeRawQuery<any>(
    `SELECT a.id AS retailer_id,
            coalesce(a.data->>'retailer_code','') AS retailer_code,
            coalesce(a.data->>'shop_name','') AS shop_name,
            coalesce(a.data->>'owner_name','') AS owner_name,
            coalesce(a.data->>'mobile','') AS mobile,
            coalesce(a.data->>'city','') AS city,
            coalesce(a.data->>'address','') AS address,
            a.data->>'gstin' AS gstin,
            coalesce(nullif(a.data->>'credit_limit','')::numeric, 0) AS credit_limit,
            coalesce(a.data->>'registered_by', p.registered_by, '') AS registered_by,
            s.name AS registered_by_name,
            to_char(coalesce(nullif(a.data->>'created_at','')::timestamptz, a.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS registered_at,
            (p.id IS NOT NULL) AS has_login,
            coalesce(a.data->>'approval_status','pending') AS approval_status
       FROM app_records a
       LEFT JOIN profiles p ON p.retailer_id = a.id AND p.business_id = a.business_id
       LEFT JOIN profiles s ON s.id = coalesce(a.data->>'registered_by', p.registered_by)
      WHERE a.business_id = $1 AND a.store = 'fmcg_retailers' AND NOT a.deleted
        AND (a.data->>'approval_status' = 'pending'
             OR (a.data->>'approval_status' = 'rejected' AND a.updated_at > now() - interval '30 days'))
      ORDER BY a.created_at DESC
      LIMIT 500`,
    [businessId]
  );
  return r.rows.map((x: any) => ({ ...x, credit_limit: Number(x.credit_limit) || 0, has_login: !!x.has_login }));
}

export async function countPendingShops(businessId: string): Promise<number> {
  const r = await executeRawQuery<{ n: string }>(
    `SELECT count(*)::text AS n FROM app_records
      WHERE business_id = $1 AND store = 'fmcg_retailers' AND NOT deleted AND data->>'approval_status' = 'pending'`,
    [businessId]
  );
  return Number(r.rows[0]?.n || 0);
}

/** Approve (shop active + login active) or reject (shop inactive + login blocked). */
export async function decideShop(
  businessId: string, retailerId: string, action: 'approve' | 'reject', adminId: string, creditLimit?: number | null
): Promise<boolean> {
  const t = nowIso();
  const approve = action === 'approve';
  const patch: Record<string, unknown> = {
    approval_status: approve ? 'approved' : 'rejected',
    active: approve,
    approved_by: adminId,
    approved_at: t,
    updated_at: t
  };
  if (approve && typeof creditLimit === 'number' && Number.isFinite(creditLimit) && creditLimit >= 0) {
    patch.credit_limit = Math.round(creditLimit);
  }
  const upd = await executeRawQuery(
    `UPDATE app_records
        SET data = data || $3::jsonb, updated_at = clock_timestamp(), updated_by = $4
      WHERE business_id = $1 AND store = 'fmcg_retailers' AND id = $2 AND NOT deleted
      RETURNING id`,
    [businessId, retailerId, JSON.stringify(patch), `shop-approval:${adminId}`]
  );
  if (!upd.rows || upd.rows.length === 0) return false;

  await executeRawQuery(
    `UPDATE profiles
        SET active = $3, status = $4, approval_status = $5, approved_by = $6, approved_at = now(), updated_at = now()
      WHERE business_id = $1 AND retailer_id = $2 AND role = 'retailer'`,
    [businessId, retailerId, approve, approve ? 'ACTIVE' : 'INACTIVE', approve ? 'approved' : 'rejected', adminId]
  );
  return true;
}
