/**
 * Server side of cloud-only storage.
 * File: src/lib/serverCloudRecords.ts
 *
 * - writeCloudRecords: app ke changes ko `app_records` table me ek transaction me save karta hai
 * - loadCloudRecords:  kisi company ke records (ya kisi time ke baad ke changes) wapas deta hai
 * - getCloudHealth:    batata hai ki database aur app_records table ready hain ya nahi
 *
 * Security:
 * - Company (business_id) hamesha logged-in session se check hoti hai.
 * - User sirf apni company, ya jin companies ka wo member hai, unhi me likh/padh sakta hai.
 * - Password jaise fields kabhi save nahi hote.
 */

import type { PoolClient } from 'pg';
import { getDatabasePool, ServerTenantContext, UnauthorizedError } from './serverDb';
import {
  APPEND_ONLY_STORES,
  isCloudSyncedStore,
  stripSecrets
} from './cloudRecordStores';

if (typeof window !== 'undefined') {
  throw new Error('serverCloudRecords must only run on the server');
}

export interface CloudRecordInput {
  store: string;
  id: string;
  business_id: string;
  data: any;
  deleted?: boolean;
}

export interface CloudRecordRow {
  store: string;
  id: string;
  business_id: string;
  data: any;
  deleted: boolean;
  updated_at: string;
}

export interface CloudWriteResult {
  success: boolean;
  savedCount: number;
  skipped: { store: string; id: string; business_id: string; reason: string }[];
  serverTime: string;
}

export interface CloudLoadCursor {
  updated_at: string;
  store: string;
  id: string;
}

export interface CloudLoadResult {
  success: boolean;
  records: CloudRecordRow[];
  hasMore: boolean;
  next: CloudLoadCursor | null;
  serverTime: string;
}

const MAX_RECORDS_PER_WRITE = 1000;
const MAX_RECORD_BYTES = 512 * 1024;
const INSERT_CHUNK = 250;

// ----------------------------------------------------------------------------
// Health
// ----------------------------------------------------------------------------

export async function getCloudHealth(): Promise<{ dbReachable: boolean; tableReady: boolean; serverTime: string }> {
  const pool = getDatabasePool();
  const res = await pool.query(
    `SELECT to_regclass('public.app_records') IS NOT NULL AS ready, clock_timestamp() AS now;`
  );
  return {
    dbReachable: true,
    tableReady: Boolean(res.rows[0]?.ready),
    serverTime: new Date(res.rows[0]?.now || Date.now()).toISOString()
  };
}

// ----------------------------------------------------------------------------
// Tenant access
// ----------------------------------------------------------------------------

async function getAllowedBusinessIds(
  client: PoolClient | ReturnType<typeof getDatabasePool>,
  context: ServerTenantContext
): Promise<Set<string>> {
  const allowed = new Set<string>([context.businessId]);
  try {
    const res = await client.query(
      `SELECT business_id FROM company_members WHERE user_id = $1 AND status = 'active';`,
      [context.userId]
    );
    res.rows.forEach((r: any) => r.business_id && allowed.add(String(r.business_id)));
  } catch {
    // company_members table missing: only session business allowed
  }
  return allowed;
}

function isAllowed(context: ServerTenantContext, allowed: Set<string>, businessId: string): boolean {
  return context.isPlatformAdmin || allowed.has(businessId);
}

/**
 * Admin ne app me nayi company banayi: cloud me bhi company + membership bana do,
 * taaki us company ka data save ho sake (aur kabhi doosri company se mix na ho).
 */
async function ensureBusinessCompanyForAdmin(
  client: PoolClient,
  context: ServerTenantContext,
  record: CloudRecordInput
): Promise<boolean> {
  if (!context.isTenantAdmin) return false;
  const d = record.data || {};
  const id = record.id;
  const name = String(d.name || d.legal_name || id).slice(0, 200);
  const baseCode = String(d.code || id).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20) || id.slice(0, 20);

  await client.query('SAVEPOINT sp_biz');
  try {
    const exists = await client.query(`SELECT id FROM business_companies WHERE id = $1;`, [id]);
    if (exists.rows.length === 0) {
      // Agar code pehle se kisi aur company ka hai, to ID ko code bana dete hain
      const codeTaken = await client.query(`SELECT 1 FROM business_companies WHERE code = $1;`, [baseCode]);
      const code = codeTaken.rows.length > 0 ? id.toUpperCase().slice(0, 40) : baseCode;
      await client.query(
        `INSERT INTO business_companies (id, code, name, legal_name, gstin, phone, email, address, city, pincode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING;`,
        [
          id, code, name, d.legal_name || null, d.gstin || null, d.phone || null,
          d.email || null, d.address || null, d.city || null, d.pincode || null
        ]
      );
    }
    await client.query(
      `INSERT INTO company_members (id, business_id, company_id, user_id, role, status)
       VALUES ($1, $2, $2, $3, 'owner', 'active')
       ON CONFLICT (business_id, user_id) DO NOTHING;`,
      [`cm-${id}-${context.userId}`.slice(0, 200), id, context.userId]
    );
    await client.query('RELEASE SAVEPOINT sp_biz');
    return true;
  } catch (err: any) {
    await client.query('ROLLBACK TO SAVEPOINT sp_biz');
    console.warn('[CLOUD_RECORDS] Could not register business company:', err?.message);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Write
// ----------------------------------------------------------------------------

function validateRecord(r: any): string | null {
  if (!r || typeof r !== 'object') return 'invalid record';
  if (!isCloudSyncedStore(r.store)) return 'store not allowed';
  if (typeof r.id !== 'string' || r.id.trim() === '' || r.id.length > 200) return 'invalid id';
  if (typeof r.business_id !== 'string' || r.business_id.trim() === '' || r.business_id.length > 200) {
    return 'invalid business_id';
  }
  if (!r.deleted) {
    if (r.data === null || typeof r.data !== 'object') return 'missing data';
  }
  return null;
}

export async function writeCloudRecords(
  context: ServerTenantContext,
  input: CloudRecordInput[]
): Promise<CloudWriteResult> {
  if (!Array.isArray(input)) throw new Error('records must be an array');
  if (input.length > MAX_RECORDS_PER_WRITE) {
    throw new Error(`Too many records in one request (max ${MAX_RECORDS_PER_WRITE})`);
  }

  const pool = getDatabasePool();
  const skipped: CloudWriteResult['skipped'] = [];
  const rows: { business_id: string; store: string; id: string; data: any; deleted: boolean }[] = [];

  for (const raw of input) {
    const problem = validateRecord(raw);
    if (problem) {
      skipped.push({ store: String(raw?.store), id: String(raw?.id), business_id: String(raw?.business_id), reason: problem });
      continue;
    }
    const deleted = Boolean(raw.deleted);
    if (deleted && APPEND_ONLY_STORES.has(raw.store)) {
      skipped.push({ store: raw.store, id: raw.id, business_id: raw.business_id, reason: 'history records cannot be deleted' });
      continue;
    }
    const data = deleted ? null : stripSecrets(raw.data);
    if (data) {
      const size = JSON.stringify(data).length;
      if (size > MAX_RECORD_BYTES) {
        skipped.push({ store: raw.store, id: raw.id, business_id: raw.business_id, reason: 'record too large' });
        continue;
      }
    }
    rows.push({ business_id: raw.business_id.trim(), store: raw.store, id: raw.id.trim(), data, deleted });
  }

  const client = await pool.connect();
  let savedCount = 0;
  try {
    await client.query('BEGIN');
    const allowed = await getAllowedBusinessIds(client, context);

    // Nayi company (admin ne banayi) ko pehle register karo
    for (const r of rows) {
      if (r.store === 'fmcg_business_companies' && !r.deleted && !isAllowed(context, allowed, r.business_id)) {
        const ok = await ensureBusinessCompanyForAdmin(client, context, r as CloudRecordInput);
        if (ok) allowed.add(r.business_id);
      }
    }

    const permitted = rows.filter(r => {
      if (isAllowed(context, allowed, r.business_id)) return true;
      skipped.push({ store: r.store, id: r.id, business_id: r.business_id, reason: 'no access to this company' });
      return false;
    });

    for (let i = 0; i < permitted.length; i += INSERT_CHUNK) {
      const chunk = permitted.slice(i, i + INSERT_CHUNK);

      // Append-only history: pehli baar insert, baad me kabhi overwrite nahi
      const appendOnly = chunk.filter(r => APPEND_ONLY_STORES.has(r.store));
      const normal = chunk.filter(r => !APPEND_ONLY_STORES.has(r.store));

      if (normal.length > 0) {
        const res = await client.query(
          `INSERT INTO app_records (business_id, store, id, data, deleted, updated_by)
           SELECT x.business_id, x.store, x.id, x.data, COALESCE(x.deleted, false), $2
             FROM jsonb_to_recordset($1::jsonb) AS x(business_id text, store text, id text, data jsonb, deleted boolean)
           ON CONFLICT (business_id, store, id) DO UPDATE SET
             data = CASE WHEN EXCLUDED.deleted THEN app_records.data ELSE EXCLUDED.data END,
             deleted = EXCLUDED.deleted,
             updated_at = clock_timestamp(),
             updated_by = EXCLUDED.updated_by;`,
          [JSON.stringify(normal), context.userId]
        );
        savedCount += res.rowCount || 0;
      }

      if (appendOnly.length > 0) {
        const res = await client.query(
          `INSERT INTO app_records (business_id, store, id, data, deleted, updated_by)
           SELECT x.business_id, x.store, x.id, x.data, false, $2
             FROM jsonb_to_recordset($1::jsonb) AS x(business_id text, store text, id text, data jsonb)
           ON CONFLICT (business_id, store, id) DO NOTHING;`,
          [JSON.stringify(appendOnly), context.userId]
        );
        // Already-present history rows count as saved too
        void res;
        savedCount += appendOnly.length;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }

  return { success: true, savedCount, skipped, serverTime: new Date().toISOString() };
}

// ----------------------------------------------------------------------------
// Load
// ----------------------------------------------------------------------------

export async function loadCloudRecords(
  context: ServerTenantContext,
  params: { business_id: string; since?: string | null; after?: CloudLoadCursor | null; limit?: number }
): Promise<CloudLoadResult> {
  const pool = getDatabasePool();
  const businessId = String(params.business_id || context.businessId).trim();
  const allowed = await getAllowedBusinessIds(pool, context);
  if (!isAllowed(context, allowed, businessId)) {
    throw new UnauthorizedError('You do not have access to this company');
  }

  const limit = Math.min(Math.max(1, Math.floor(params.limit || 2000)), 5000);
  const since = params.since ? String(params.since) : '1970-01-01T00:00:00.000000Z';
  if (isNaN(new Date(since).getTime())) throw new Error('Invalid "since" timestamp');

  const after = params.after && params.after.updated_at ? params.after : null;
  const businessIds = Array.from(allowed);

  // Records of this company + the company list (all companies the user may switch to)
  const res = await pool.query(
    `SELECT business_id, store, id, data, deleted,
            to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at_text
       FROM app_records
      WHERE (business_id = $1 OR (store = 'fmcg_business_companies' AND (business_id = ANY($2::text[]) OR $3::boolean)))
        AND updated_at > $4::timestamptz
        AND ($5::timestamptz IS NULL OR (updated_at, store, id) > ($5::timestamptz, $6::text, $7::text))
      ORDER BY updated_at ASC, store ASC, id ASC
      LIMIT $8;`,
    [
      businessId,
      businessIds,
      context.isPlatformAdmin,
      since,
      after ? after.updated_at : null,
      after ? after.store : '',
      after ? after.id : '',
      limit + 1
    ]
  );

  const hasMore = res.rows.length > limit;
  const page = hasMore ? res.rows.slice(0, limit) : res.rows;
  const records: CloudRecordRow[] = page.map((r: any) => ({
    business_id: r.business_id,
    store: r.store,
    id: r.id,
    data: r.data,
    deleted: Boolean(r.deleted),
    updated_at: String(r.updated_at_text)
  }));
  const last = page[page.length - 1];

  return {
    success: true,
    records,
    hasMore,
    // Full microsecond precision, warna paging same row par atak sakti hai
    next: last ? { updated_at: String(last.updated_at_text), store: last.store, id: last.id } : null,
    serverTime: new Date().toISOString()
  };
}
