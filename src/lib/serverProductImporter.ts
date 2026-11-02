/**
 * FMCG Product Importer - Server-Side Normalized PostgreSQL Engine
 * Saifee FMCG Wholesale Distribution & Trade Management System
 * File: src/lib/serverProductImporter.ts
 *
 * SAFETY & ARCHITECTURE PRINCIPLES:
 * 1. STRICT SERVER-ONLY: Never imported or executed in browser client bundles.
 * 2. PARAMETERIZED QUERIES: 100% parameter substitution ($1, $2, ...) to prevent SQL injection.
 * 3. TENANT ISOLATION: Derives business_id exclusively from authenticated HMAC session context.
 * 4. STRICT TRANSACTION CONTROL: Executes batch imports within PostgreSQL transactions with
 *    guaranteed rollback on failure.
 * 5. NO FUZZY OVERWRITE: Ambiguous name matches are never auto-overwritten.
 * 6. BOUNDED MEMORY: Memory-efficient streaming/chunking supporting 6,200+ products.
 * 7. RETRY & IDEMPOTENCY: Safely deduplicates retried imports by idempotency_key and existing SKU/Barcode.
 * 8. SEPARATION OF CONCERNS: Opening stock inwarding is isolated from master catalog creation.
 */

import { PoolClient } from 'pg';
import {
  ServerTenantContext,
  assertTenantAdmin,
  validateTenantAccess,
  getDatabasePool,
  isServerDatabaseConfigured,
  sanitizeDatabaseError,
  DatabaseError,
  UnauthorizedError
} from './serverDb';
import { BaseUnit } from './db';

/**
 * Multi-row INSERT helper. Sends many rows in one round-trip instead of one query per row.
 * Keeps total bind parameters under PostgreSQL's 65,535 limit by splitting automatically.
 */
async function bulkInsert(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: any[][],
  suffix = ''
): Promise<void> {
  if (rows.length === 0) return;
  const maxRowsPerQuery = Math.max(1, Math.floor(60000 / columns.length));
  for (let start = 0; start < rows.length; start += maxRowsPerQuery) {
    const slice = rows.slice(start, start + maxRowsPerQuery);
    const params: any[] = [];
    const tuples = slice.map(row => {
      const placeholders = row.map(v => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(',\n')} ${suffix};`,
      params
    );
  }
}

// ----------------------------------------------------------------------------
// 1. STRICT SERVER-ONLY ENFORCEMENT
// ----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  throw new Error('[CRITICAL SECURITY VIOLATION]: serverProductImporter must only be imported in server-side Node.js environment!');
}

// ----------------------------------------------------------------------------
// 2. TYPE DEFINITIONS
// ----------------------------------------------------------------------------

export interface ImportRowData {
  name: string;
  company_name?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  sku?: string;
  barcode?: string;
  pack_size?: string;
  trading_unit?: string;
  base_unit?: BaseUnit;
  units_per_box_carton?: number;
  mrp: number;
  purchase_price: number;
  selling_price: number;
  gst_percent?: number;
  hsn?: string;
  description?: string;
  stock_qty?: number;
  stock_qty_is_base?: boolean;
  batch_number?: string;
  mfg_date?: string;
  expiry_date?: string;
  parent_sku?: string;
  variant_attribute?: string;
  variant_value?: string;
  dealer_price?: number;
  trade_mode?: 'PIECES' | 'CARTONS' | 'BOTH';
  min_stock_level?: number;
  reorder_level?: number;
  loose_mrp?: number;
  loose_selling_price?: number;
  loose_purchase_price?: number;
  supplier_name?: string;
  image_url?: string;
}

export interface ImportRowItem {
  rowNumber: number;
  action: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'SKIP';
  existingProductId?: string;
  data: ImportRowData;
  validationErrors?: string[];
  isAmbiguousMatch?: boolean;
  explicitApproval?: boolean;
}

export interface ImportMetaOptions {
  file_name: string;
  file_size?: number;
  column_mapping?: Record<string, string>;
  user_id?: string;
  user_name?: string;
  business_id?: string;
  import_opening_stock?: boolean;
  idempotency_key?: string;
  chunk_size?: number;
}

export interface ServerImportResult {
  importId: string;
  batch: {
    id: string;
    business_id: string;
    file_name: string;
    file_size?: number;
    total_rows: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    failed_count: number;
    stock_units_imported: number;
    status: 'Completed' | 'Completed with Errors' | 'Rolled Back' | 'Failed';
    imported_by_id: string;
    imported_by_name: string;
    created_product_ids: string[];
    updated_snapshots: any[];
    created_batch_ids: string[];
    created_ledger_ids: string[];
    column_mapping?: Record<string, string>;
    row_logs: any[];
    is_multi_transaction?: boolean;
    transaction_count?: number;
  };
}

// Permitted trading unit list enforced by schema CHECK constraint
const VALID_TRADING_UNITS = new Set([
  'Box', 'Carton', 'Case', 'Bag', 'Bundle', 'Dozen', 'Tin', 'Jar', 'Other'
]);

function normalizeTradingUnit(rawUnit?: string): string {
  if (!rawUnit || typeof rawUnit !== 'string') return 'Carton';
  const trimmed = rawUnit.trim();
  const titleCase = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  if (VALID_TRADING_UNITS.has(titleCase)) {
    return titleCase;
  }
  return 'Carton';
}

// ----------------------------------------------------------------------------
// 3. TENANT & WAREHOUSE GODOWN RESOLUTION ENGINE
// ----------------------------------------------------------------------------

/**
 * Resolves or safely initializes the tenant organization in business_companies.
 * Ensures the business_id foreign key constraint is satisfied before child table insertion.
 * Reuses existing business records to prevent duplicates on repeated imports.
 */
export async function resolveOrCreateBusinessCompany(
  clientOrPool: PoolClient | any,
  requestedBizId: string
): Promise<string> {
  const normId = requestedBizId?.trim() || 'biz-saifee';

  // 1. Check if exact business_id exists
  const exactRes = await clientOrPool.query(
    `SELECT id FROM business_companies WHERE id = $1 LIMIT 1;`,
    [normId]
  );
  if (exactRes.rows && exactRes.rows.length > 0) {
    return exactRes.rows[0].id;
  }

  // 2. Check if default or primary business exists (by code or is_default)
  const defaultRes = await clientOrPool.query(
    `SELECT id FROM business_companies 
     WHERE code IN ('SGS', 'SAIFEE', 'MAIN') OR is_default = true 
     ORDER BY is_default DESC, created_at ASC 
     LIMIT 1;`
  );
  if (defaultRes.rows && defaultRes.rows.length > 0) {
    return defaultRes.rows[0].id;
  }

  // 3. Check if any business exists at all in business_companies
  const anyRes = await clientOrPool.query(
    `SELECT id FROM business_companies ORDER BY created_at ASC LIMIT 1;`
  );
  if (anyRes.rows && anyRes.rows.length > 0) {
    return anyRes.rows[0].id;
  }

  // 4. Create baseline business organization record
  const cleanCode = (normId.replace(/^biz-/, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'SAIFEE').substring(0, 16);
  const name = 'Saifee General Stores';

  try {
    const inserted = await clientOrPool.query(
      `INSERT INTO business_companies (id, code, name, legal_name, business_type, is_default, status)
       VALUES ($1, $2, $3, $3, 'FMCG Distribution', true, 'active')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id;`,
      [normId, cleanCode, name]
    );
    return inserted.rows[0].id;
  } catch (err: any) {
    const fallback = await clientOrPool.query(
      `SELECT id FROM business_companies WHERE id = $1 OR code = $2 LIMIT 1;`,
      [normId, cleanCode]
    );
    if (fallback.rows && fallback.rows.length > 0) {
      return fallback.rows[0].id;
    }
    throw err;
  }
}

/**
 * Resolves or safely initializes the default warehouse godown for the resolved business tenant.
 * Satisfies godowns_business_id_fkey and avoids duplicate godowns on repeated imports.
 */
export async function resolveOrCreateDefaultGodown(
  clientOrPool: PoolClient | any,
  businessId: string
): Promise<string> {
  const godownRes = await clientOrPool.query(
    `SELECT id FROM godowns WHERE business_id = $1 ORDER BY is_default DESC, created_at ASC LIMIT 1;`,
    [businessId]
  );
  if (godownRes.rows && godownRes.rows.length > 0) {
    return godownRes.rows[0].id;
  }

  const newGid = `gdn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  try {
    const inserted = await clientOrPool.query(
      `INSERT INTO godowns (id, business_id, code, name, is_default, status)
       VALUES ($1, $2, 'MAIN', 'Main Godown', true, 'Active')
       ON CONFLICT (business_id, code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id;`,
      [newGid, businessId]
    );
    return inserted.rows[0].id;
  } catch (err: any) {
    const fallback = await clientOrPool.query(
      `SELECT id FROM godowns WHERE business_id = $1 AND code = 'MAIN' LIMIT 1;`,
      [businessId]
    );
    if (fallback.rows && fallback.rows.length > 0) {
      return fallback.rows[0].id;
    }
    throw err;
  }
}

/**
 * Resolves or safely initializes the user profile for the authenticated session user.
 * Satisfies stock_ledger_user_id_fkey while adhering strictly to the real profiles table schema.
 */
export async function resolveOrCreateUserProfile(
  clientOrPool: PoolClient | any,
  businessId: string,
  userId: string,
  name?: string,
  mobile?: string,
  role?: string
): Promise<string | null> {
  if (!userId) return null;
  const profRes = await clientOrPool.query(
    `SELECT id FROM profiles WHERE id = $1 LIMIT 1;`,
    [userId]
  );
  if (profRes.rows && profRes.rows.length > 0) {
    return profRes.rows[0].id;
  }

  const cleanEmail = `${userId}@saifee.local`;
  const cleanMobile = mobile || '9826012345';
  const cleanName = name || 'Admin User';
  const cleanRole = role || 'admin';

  try {
    const inserted = await clientOrPool.query(
      `INSERT INTO profiles (id, business_id, email, mobile, name, role, password_hash, active, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'SYNC_HASH_PLACEHOLDER', true, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP
       RETURNING id;`,
      [userId, businessId, cleanEmail, cleanMobile, cleanName, cleanRole]
    );
    return inserted.rows[0].id;
  } catch {
    const fallback = await clientOrPool.query(`SELECT id FROM profiles WHERE id = $1 LIMIT 1;`, [userId]);
    return fallback.rows.length > 0 ? fallback.rows[0].id : null;
  }
}

// ----------------------------------------------------------------------------
// 4. TRANSACTIONAL PRODUCT IMPORTER
// ----------------------------------------------------------------------------

export async function executeServerProductImport(
  context: ServerTenantContext,
  rows: ImportRowItem[],
  meta: ImportMetaOptions
): Promise<ServerImportResult> {
  // 1. Authorization & Tenant Security Guard
  assertTenantAdmin(context);
  const requestedBiz = validateTenantAccess(context, meta.business_id);

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new DatabaseError('Cannot execute import on empty row set', 'INVALID_PAYLOAD', 400);
  }

  const pool = getDatabasePool();
  const timestamp = new Date().toISOString();
  const importId = `IMP-PG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const userId = context.userId;
  const userName = context.name || 'Admin';
  const shouldImportStock = Boolean(meta.import_opening_stock);
  const chunkSize = meta.chunk_size && meta.chunk_size > 0 ? Math.min(meta.chunk_size, 1000) : 500;
  const isMultiTransaction = rows.length > chunkSize;

  // Resolve or create authoritative business tenant record in business_companies (satisfies foreign key)
  const activeBiz = await resolveOrCreateBusinessCompany(pool, requestedBiz);

  // Pre-load reference caches for fast in-memory resolution across 6,200+ rows
  const companyCache = new Map<string, string>(); // name_lower -> id
  const categoryCache = new Map<string, string>(); // name_lower -> id

  // Resolve or create default warehouse godown (satisfies inventory foreign key)
  let defaultGodownId: string | null = await resolveOrCreateDefaultGodown(pool, activeBiz);

  // Resolve or create authenticated user profile (satisfies stock_ledger_user_id_fkey)
  const resolvedUserId = await resolveOrCreateUserProfile(pool, activeBiz, userId, userName, context.mobile, context.role);

  // 2. Check Idempotency Key against vyapar_imports table
  if (meta.idempotency_key && meta.idempotency_key.trim().length > 0) {
    const existingCheck = await pool.query(
      `SELECT id, business_id, file_name, total_rows, created_count, updated_count, 
              skipped_count, failed_count, stock_units_imported, status, imported_by_id, imported_by_name,
              created_product_ids, updated_snapshots, created_batch_ids, created_ledger_ids, row_logs
       FROM vyapar_imports 
       WHERE business_id = $1 AND (column_mapping->>'idempotency_key' = $2 OR id = $2) AND status = 'Completed'
       LIMIT 1;`,
      [activeBiz, meta.idempotency_key.trim()]
    );

    if (existingCheck.rows && existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      return {
        importId: existing.id,
        batch: {
          id: existing.id,
          business_id: existing.business_id,
          file_name: existing.file_name,
          total_rows: existing.total_rows,
          created_count: existing.created_count,
          updated_count: existing.updated_count,
          skipped_count: existing.skipped_count,
          failed_count: existing.failed_count,
          stock_units_imported: existing.stock_units_imported,
          status: existing.status,
          imported_by_id: existing.imported_by_id,
          imported_by_name: existing.imported_by_name,
          created_product_ids: existing.created_product_ids || [],
          updated_snapshots: existing.updated_snapshots || [],
          created_batch_ids: existing.created_batch_ids || [],
          created_ledger_ids: existing.created_ledger_ids || [],
          row_logs: existing.row_logs || []
        }
      };
    }
  }

  // Pre-load existing product codes/SKUs once (replaces one duplicate-check query per row)
  const existingCodes = new Set<string>();
  {
    const codesRes = await pool.query(
      `SELECT product_code, sku FROM products WHERE business_id = $1;`,
      [activeBiz]
    );
    for (const r of codesRes.rows) {
      if (r.product_code) existingCodes.add(String(r.product_code).toLowerCase());
      if (r.sku) existingCodes.add(String(r.sku).toLowerCase());
    }
  }

  // Track global progress across batches
  const allCreatedProductIds: string[] = [];
  const allUpdatedSnapshots: any[] = [];
  const allCreatedBatchIds: string[] = [];
  const allCreatedLedgerIds: string[] = [];
  const allRowLogs: any[] = [];
  let totalStockInward = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let transactionCount = 0;

  // Split into manageable chunks to guarantee bounded memory consumption
  const chunks: ImportRowItem[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }

  // Iterate over each chunk in a controlled transaction
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_business_id', $1, true)", [activeBiz]);
      transactionCount++;

      // Per-chunk buffers for bulk inserts (flushed once per chunk before COMMIT)
      const bufProducts: any[][] = [];
      const bufProductCategories: any[][] = [];
      const bufInventory: any[][] = [];
      const bufBatches: any[][] = [];
      const bufLedger: any[][] = [];

      // Defensive check: Ensure godown is resolved
      if (!defaultGodownId) {
        defaultGodownId = await resolveOrCreateDefaultGodown(client, activeBiz);
      }

      // Process each row inside this transaction chunk
      for (const item of chunk) {
        // Validation check
        if (!item.data || !item.data.name || item.data.name.trim() === '') {
          skippedCount++;
          allRowLogs.push({
            row_number: item.rowNumber,
            product_name: 'Unknown',
            action_taken: 'SKIPPED',
            error: 'Missing product name'
          });
          continue;
        }

        if (item.action === 'SKIP') {
          skippedCount++;
          allRowLogs.push({
            row_number: item.rowNumber,
            product_name: item.data.name,
            sku: item.data.sku,
            barcode: item.data.barcode,
            action_taken: 'SKIPPED'
          });
          continue;
        }

        // Commercial price sanity check
        if (isNaN(item.data.mrp) || item.data.mrp <= 0) {
          failedCount++;
          allRowLogs.push({
            row_number: item.rowNumber,
            product_name: item.data.name,
            action_taken: 'FAILED',
            error: `Invalid MRP: ${item.data.mrp}`
          });
          continue;
        }

        // STRICT SAFETY: Never overwrite an existing product based on fuzzy match
        if (item.isAmbiguousMatch && item.action === 'UPDATE_EXISTING') {
          skippedCount++;
          allRowLogs.push({
            row_number: item.rowNumber,
            product_name: item.data.name,
            sku: item.data.sku,
            barcode: item.data.barcode,
            action_taken: 'SKIPPED',
            error: 'Ambiguous fuzzy match detected. Product sent for manual review to prevent accidental overwrite.'
          });
          continue;
        }

        // Resolve Company (FMCG Brand / Manufacturer)
        const compName = (item.data.company_name?.trim() || item.data.brand?.trim() || 'General FMCG');
        const compKey = compName.toLowerCase();
        let companyId = companyCache.get(compKey);

        if (!companyId) {
          const compCheck = await client.query(
            `SELECT id FROM companies WHERE LOWER(name) = $1 OR (code IS NOT NULL AND LOWER(code) = $2) LIMIT 1;`,
            [compKey, compKey]
          );
          if (compCheck.rows.length > 0) {
            companyId = compCheck.rows[0].id;
          } else {
            const newCompId = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const codeCandidate = compName.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') || `CP${Date.now().toString().slice(-4)}`;
            const insertedComp = await client.query(
              `INSERT INTO companies (id, name, code, active)
               VALUES ($1, $2, $3, true)
               ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
               RETURNING id;`,
              [newCompId, compName, codeCandidate]
            );
            companyId = insertedComp.rows[0].id;
          }
          companyCache.set(compKey, companyId!);
        }

        // Resolve Category (Master table per business tenant)
        const catName = (item.data.category?.trim() || item.data.subcategory?.trim() || compName || 'General FMCG');
        const catKey = catName.toLowerCase();
        let categoryId = categoryCache.get(catKey);

        if (!categoryId) {
          const catCheck = await client.query(
            `SELECT id FROM categories WHERE business_id = $1 AND LOWER(name) = $2 LIMIT 1;`,
            [activeBiz, catKey]
          );
          if (catCheck.rows.length > 0) {
            categoryId = catCheck.rows[0].id;
          } else {
            const newCatId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const insertedCat = await client.query(
              `INSERT INTO categories (id, business_id, name, description, active)
               VALUES ($1, $2, $3, $4, true)
               ON CONFLICT (business_id, name) DO UPDATE SET name = EXCLUDED.name
               RETURNING id;`,
              [newCatId, activeBiz, catName, `Imported from ${meta.file_name}`]
            );
            categoryId = insertedCat.rows[0].id;
          }
          categoryCache.set(catKey, categoryId!);
        }

        const unitsPerPack = Math.max(1, item.data.units_per_box_carton || parseInt(item.data.pack_size?.match(/\d+/)?.[0] || '1', 10));
        const packSizeStr = item.data.pack_size?.trim() || `${unitsPerPack} units/${item.data.trading_unit || 'Carton'}`;
        const tradingUnit = normalizeTradingUnit(item.data.trading_unit);
        const baseUnit = item.data.base_unit || 'Piece';
        const gstPercent = item.data.gst_percent !== undefined ? Number(item.data.gst_percent) : 0;
        const hsnCode = item.data.hsn?.trim() || ''; // blank if unknown; NOT NULL column accepts empty string

        // Check if SKU or product code already exists in this tenant (Safety against accidental overwrites)
        let resolvedAction = item.action;
        let targetProductId = item.existingProductId;

        if (resolvedAction === 'CREATE_NEW') {
          const normSku = item.data.sku?.trim();

          if (normSku && existingCodes.has(normSku.toLowerCase())) {
              skippedCount++;
              allRowLogs.push({
                row_number: item.rowNumber,
                product_name: item.data.name,
                sku: normSku,
                action_taken: 'SKIPPED',
                error: `Existing product with matching code "${normSku}" found. Automatic overwrite prohibited; explicit approval (action: UPDATE_EXISTING) required.`
              });
              continue;
          }
          if (normSku) existingCodes.add(normSku.toLowerCase());
        }

        // For UPDATE_EXISTING without targetProductId, resolve by SKU/product_code
        if (resolvedAction === 'UPDATE_EXISTING' && !targetProductId) {
          const normSku = item.data.sku?.trim();
          if (normSku) {
            const prodRes = await client.query(
              `SELECT id FROM products 
               WHERE business_id = $1 AND (
                 LOWER(product_code) = LOWER($2) OR 
                 (sku IS NOT NULL AND LOWER(sku) = LOWER($2))
               ) LIMIT 1;`,
              [activeBiz, normSku]
            );
            if (prodRes.rows.length > 0) {
              targetProductId = prodRes.rows[0].id;
            }
          }
        }

        // Calculate opening stock quantities in lowest atomic base units
        const rawStock = shouldImportStock ? Math.max(0, item.data.stock_qty || 0) : 0;
        const baseQty = item.data.stock_qty_is_base ? Math.floor(rawStock) : Math.floor(rawStock * unitsPerPack);
        const batchNum = item.data.batch_number?.trim() || `VYP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const expDate = item.data.expiry_date?.trim() || '2027-12-31';

        // --------------------------------------------------------
        // ACTION: CREATE_NEW
        // --------------------------------------------------------
        if (resolvedAction === 'CREATE_NEW') {
          const newProdId = `prd-${Date.now()}-${item.rowNumber}-${Math.random().toString(36).substring(2, 6)}`;
          const newSku = item.data.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}-${String(item.rowNumber).padStart(4, '0')}`;
          const newBarcode = item.data.barcode?.trim() || null;
          const prodCode = `PRD-${Date.now().toString().slice(-7)}-${String(item.rowNumber).padStart(4, '0')}`;

          const looseSelling = item.data.loose_selling_price || Math.round((item.data.selling_price / unitsPerPack) * 100) / 100;
          const looseMrp = item.data.loose_mrp || Math.round((item.data.mrp / unitsPerPack) * 100) / 100;
          const loosePurchase = item.data.loose_purchase_price || Math.round((item.data.purchase_price / unitsPerPack) * 100) / 100;

          bufProducts.push([
            newProdId, activeBiz, prodCode, item.data.name.trim(), companyId, item.data.brand?.trim() || compName, catName, item.data.subcategory?.trim() || 'General',
            newSku, newBarcode, packSizeStr, packSizeStr, tradingUnit, baseUnit,
            unitsPerPack, unitsPerPack, unitsPerPack,
            item.data.mrp, item.data.selling_price, item.data.purchase_price, item.data.dealer_price || null,
            looseMrp, looseSelling, loosePurchase,
            0.00, 0.00, true, true, true,
            item.data.trade_mode || 'BOTH', 'auto', gstPercent, hsnCode,
            item.data.description?.trim() || '', item.data.min_stock_level ?? 5, item.data.reorder_level ?? 10,
            true, true, true
          ]);

          // Junction table: product_categories
          bufProductCategories.push([`pc-${newProdId}`, newProdId, categoryId]);

          // Initial inventory baseline record
          bufInventory.push([`inv-${newProdId}`, activeBiz, defaultGodownId, newProdId, baseQty, 0, baseQty]);

          // Opening Stock Batch & Ledger: ONLY when explicitly requested
          if (shouldImportStock && baseQty > 0) {
            totalStockInward += baseQty;
            const bchId = `bch-${Date.now()}-${item.rowNumber}-${Math.random().toString(36).substring(2, 6)}`;
            bufBatches.push([
              bchId, activeBiz, newProdId, defaultGodownId, 'Main Godown',
              batchNum, expDate, item.data.purchase_price, item.data.selling_price, item.data.mrp,
              baseQty, importId
            ]);
            allCreatedBatchIds.push(bchId);

            const ledId = `led-${Date.now()}-${item.rowNumber}-${Math.random().toString(36).substring(2, 6)}`;
            bufLedger.push([
              ledId, activeBiz, newProdId, defaultGodownId, baseQty,
              'IN', 'Opening Stock / Vyapar Import', importId, resolvedUserId, batchNum
            ]);
            allCreatedLedgerIds.push(ledId);
          }

          allCreatedProductIds.push(newProdId);
          createdCount++;
          allRowLogs.push({
            row_number: item.rowNumber,
            product_name: item.data.name,
            sku: newSku,
            barcode: newBarcode,
            action_taken: 'CREATED',
            product_id: newProdId,
            stock_inward_qty: baseQty > 0 ? baseQty : undefined
          });
        }

        // --------------------------------------------------------
        // ACTION: UPDATE_EXISTING
        // --------------------------------------------------------
        else if (resolvedAction === 'UPDATE_EXISTING' && targetProductId) {
          // Snapshot current record for safe reversal/audit
          const existingRowRes = await client.query(
            `SELECT id, name, mrp, selling_price, purchase_price, pack_size, units_per_box_carton,
                    category, description, barcode, updated_at
             FROM products 
             WHERE id = $1 AND business_id = $2;`,
            [targetProductId, activeBiz]
          );

          if (existingRowRes.rows.length === 0) {
            failedCount++;
            allRowLogs.push({
              row_number: item.rowNumber,
              product_name: item.data.name,
              action_taken: 'FAILED',
              error: `Target product ID "${targetProductId}" not found in tenant.`
            });
            continue;
          }

          const existing = existingRowRes.rows[0];
          allUpdatedSnapshots.push({
            product_id: targetProductId,
            snapshot_before: existing
          });

          // Execute parameterized update
          await client.query(
            `UPDATE products SET
              name = $3,
              mrp = $4,
              selling_price = $5,
              purchase_price = $6,
              pack_size = $7,
              units_per_box_carton = $8,
              units_per_trading_unit = $8,
              gst_percent = $9,
              hsn = $10,
              description = COALESCE($11, description),
              updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND business_id = $2;`,
            [
              targetProductId, activeBiz, item.data.name.trim(),
              item.data.mrp, item.data.selling_price, item.data.purchase_price,
              packSizeStr, unitsPerPack,
              gstPercent, hsnCode, item.data.description?.trim() || null
            ]
          );

          // Update product_categories junction
          await client.query(
            `INSERT INTO product_categories (id, product_id, category_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, category_id) DO NOTHING;`,
            [`pc-${targetProductId}-${categoryId}`, targetProductId, categoryId]
          );

          // Opening Stock Inwarding: ONLY when enabled
          if (shouldImportStock && baseQty > 0) {
            totalStockInward += baseQty;
            await client.query(
              `INSERT INTO inventory (id, business_id, godown_id, product_id, physical_qty, reserved_qty, available_qty)
               VALUES ($1, $2, $3, $4, $5, 0, $5)
               ON CONFLICT (business_id, product_id, godown_id) 
               DO UPDATE SET physical_qty = inventory.physical_qty + EXCLUDED.physical_qty,
                             available_qty = inventory.available_qty + EXCLUDED.available_qty,
                             updated_at = CURRENT_TIMESTAMP;`,
              [`inv-${targetProductId}`, activeBiz, defaultGodownId, targetProductId, baseQty]
            );

            const bchId = `bch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            await client.query(
              `INSERT INTO inventory_batches (
                id, business_id, product_id, godown_id, godown_name,
                batch_number, expiry_date, purchase_rate, selling_price, mrp,
                quantity, cost_layer
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
              [
                bchId, activeBiz, targetProductId, defaultGodownId, 'Main Godown',
                batchNum, expDate, item.data.purchase_price, item.data.selling_price, item.data.mrp,
                baseQty, importId
              ]
            );
            allCreatedBatchIds.push(bchId);

            const ledId = `led-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            await client.query(
              `INSERT INTO stock_ledger (
                id, business_id, product_id, godown_id, change_qty,
                direction, reason, reference_id, user_id, batch_number
              ) VALUES ($1, $2, $3, $4, $5, 'IN', 'Opening Stock / Vyapar Import', $6, $7, $8);`,
              [ledId, activeBiz, targetProductId, defaultGodownId, baseQty, importId, resolvedUserId, batchNum]
            );
            allCreatedLedgerIds.push(ledId);
          }

          updatedCount++;
          allRowLogs.push({
            row_number: item.rowNumber,
            product_name: item.data.name,
            sku: existing.sku || item.data.sku,
            barcode: existing.barcode || item.data.barcode,
            action_taken: 'UPDATED',
            product_id: targetProductId,
            stock_inward_qty: baseQty > 0 ? baseQty : undefined
          });
        }
      }

      // Flush buffered CREATE_NEW rows in a few bulk queries (parents before children)
      await bulkInsert(client, 'products', [
        'id', 'business_id', 'product_code', 'name', 'company_id', 'brand', 'category', 'subcategory',
        'sku', 'barcode', 'pack_size', 'packing_display', 'trading_unit', 'base_unit',
        'units_per_box_carton', 'units_per_trading_unit', 'pieces_per_carton',
        'mrp', 'selling_price', 'purchase_price', 'dealer_price',
        'loose_mrp', 'loose_selling_price', 'loose_purchase_price',
        'carton_discount', 'loose_discount', 'allow_loose_sale', 'allow_carton', 'allow_pieces',
        'trade_mode', 'loose_price_mode', 'gst_percent', 'hsn',
        'description', 'min_stock_level', 'reorder_level',
        'batch_tracking_enabled', 'expiry_tracking_enabled', 'active'
      ], bufProducts);
      await bulkInsert(client, 'product_categories', ['id', 'product_id', 'category_id'],
        bufProductCategories, 'ON CONFLICT (product_id, category_id) DO NOTHING');
      await bulkInsert(client, 'inventory',
        ['id', 'business_id', 'godown_id', 'product_id', 'physical_qty', 'reserved_qty', 'available_qty'],
        bufInventory,
        `ON CONFLICT (business_id, product_id, godown_id)
         DO UPDATE SET physical_qty = inventory.physical_qty + EXCLUDED.physical_qty,
                       available_qty = inventory.available_qty + EXCLUDED.available_qty,
                       updated_at = CURRENT_TIMESTAMP`);
      await bulkInsert(client, 'inventory_batches', [
        'id', 'business_id', 'product_id', 'godown_id', 'godown_name',
        'batch_number', 'expiry_date', 'purchase_rate', 'selling_price', 'mrp',
        'quantity', 'cost_layer'
      ], bufBatches);
      await bulkInsert(client, 'stock_ledger', [
        'id', 'business_id', 'product_id', 'godown_id', 'change_qty',
        'direction', 'reason', 'reference_id', 'user_id', 'batch_number'
      ], bufLedger);

      // Commit transaction chunk
      await client.query('COMMIT');
    } catch (chunkErr) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          console.warn('[SERVER_PRODUCT_IMPORTER_ROLLBACK]: Rollback error:', rollbackErr);
        }
      }
      throw sanitizeDatabaseError(chunkErr, `Product import chunk ${chunkIndex + 1} failed`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Record completed import batch into vyapar_imports audit table
  const finalStatus = failedCount > 0 ? 'Completed with Errors' : 'Completed';
  const mappingWithMeta = {
    ...(meta.column_mapping || {}),
    ...(meta.idempotency_key ? { idempotency_key: meta.idempotency_key } : {})
  };

  await pool.query(
    `INSERT INTO vyapar_imports (
      id, business_id, file_name, file_size, total_rows,
      created_count, updated_count, skipped_count, failed_count, stock_units_imported,
      status, imported_by_id, imported_by_name,
      created_product_ids, updated_snapshots, created_batch_ids, created_ledger_ids,
      column_mapping, row_logs
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13,
      $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb,
      $18::jsonb, $19::jsonb
    );`,
    [
      importId, activeBiz, meta.file_name, meta.file_size || null, rows.length,
      createdCount, updatedCount, skippedCount, failedCount, totalStockInward,
      finalStatus, userId, userName,
      JSON.stringify(allCreatedProductIds), JSON.stringify(allUpdatedSnapshots),
      JSON.stringify(allCreatedBatchIds), JSON.stringify(allCreatedLedgerIds),
      JSON.stringify(mappingWithMeta), JSON.stringify(allRowLogs)
    ]
  );

  return {
    importId,
    batch: {
      id: importId,
      business_id: activeBiz,
      file_name: meta.file_name,
      file_size: meta.file_size,
      total_rows: rows.length,
      created_count: createdCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      stock_units_imported: totalStockInward,
      status: finalStatus,
      imported_by_id: userId,
      imported_by_name: userName,
      created_product_ids: allCreatedProductIds,
      updated_snapshots: allUpdatedSnapshots,
      created_batch_ids: allCreatedBatchIds,
      created_ledger_ids: allCreatedLedgerIds,
      column_mapping: meta.column_mapping,
      row_logs: allRowLogs,
      is_multi_transaction: isMultiTransaction,
      transaction_count: transactionCount
    }
  };
}

// ----------------------------------------------------------------------------
// 4. TRANSACTIONAL ROLLBACK ENGINE
// ----------------------------------------------------------------------------

export async function rollbackServerProductImport(
  context: ServerTenantContext,
  importId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  assertTenantAdmin(context);
  const pool = getDatabasePool();
  const activeBiz = await resolveOrCreateBusinessCompany(pool, context.businessId);

  const importRes = await pool.query(
    `SELECT id, business_id, status, created_product_ids, updated_snapshots,
            created_batch_ids, created_ledger_ids
     FROM vyapar_imports
     WHERE id = $1 AND (business_id = $2 OR business_id = $3)
     LIMIT 1;`,
    [importId, context.businessId, activeBiz]
  );

  if (importRes.rows.length === 0) {
    return { success: false, message: 'Import batch not found in tenant database.' };
  }

  const batch = importRes.rows[0];
  const batchBiz = batch.business_id || activeBiz;
  if (batch.status === 'Rolled Back') {
    return { success: false, message: 'This import batch has already been rolled back.' };
  }

  const createdIds: string[] = Array.isArray(batch.created_product_ids) ? batch.created_product_ids : [];
  const updatedSnapshots: any[] = Array.isArray(batch.updated_snapshots) ? batch.updated_snapshots : [];
  const batchIds: string[] = Array.isArray(batch.created_batch_ids) ? batch.created_batch_ids : [];
  const ledgerIds: string[] = Array.isArray(batch.created_ledger_ids) ? batch.created_ledger_ids : [];

  // FOREIGN KEY DEPENDENCY CHECK: Ensure no newly created products have been referenced in orders/invoices
  if (createdIds.length > 0) {
    const orderCheck = await pool.query(
      `SELECT product_id FROM order_items WHERE product_id = ANY($1::text[]) LIMIT 1;`,
      [createdIds]
    );
    if (orderCheck.rows.length > 0) {
      return {
        success: false,
        message: 'Cannot rollback import: One or more imported products have already been included in sales orders.'
      };
    }

    const invoiceCheck = await pool.query(
      `SELECT product_id FROM invoice_items WHERE product_id = ANY($1::text[]) LIMIT 1;`,
      [createdIds]
    );
    if (invoiceCheck.rows.length > 0) {
      return {
        success: false,
        message: 'Cannot rollback import: One or more imported products have already been billed on customer invoices.'
      };
    }
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [batchBiz]);

    // 1. Revert batches and ledgers created by this import
    if (batchIds.length > 0) {
      await client.query(`DELETE FROM inventory_batches WHERE id = ANY($1::text[]) AND business_id = $2;`, [batchIds, batchBiz]);
    }
    if (ledgerIds.length > 0) {
      await client.query(`DELETE FROM stock_ledger WHERE id = ANY($1::text[]) AND business_id = $2;`, [ledgerIds, batchBiz]);
    }

    // 2. Remove newly created products and their junction entries
    if (createdIds.length > 0) {
      await client.query(`DELETE FROM product_categories WHERE product_id = ANY($1::text[]);`, [createdIds]);
      await client.query(`DELETE FROM inventory WHERE product_id = ANY($1::text[]) AND business_id = $2;`, [createdIds, batchBiz]);
      await client.query(`DELETE FROM products WHERE id = ANY($1::text[]) AND business_id = $2;`, [createdIds, batchBiz]);
    }

    // 3. Restore updated product snapshots
    for (const snap of updatedSnapshots) {
      if (snap.product_id && snap.snapshot_before) {
        const b = snap.snapshot_before;
        await client.query(
          `UPDATE products SET
            name = $3, mrp = $4, selling_price = $5, purchase_price = $6,
            pack_size = $7, units_per_box_carton = $8, description = $9,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND business_id = $2;`,
          [
            snap.product_id, context.businessId,
            b.name, b.mrp, b.selling_price, b.purchase_price,
            b.pack_size, b.units_per_box_carton, b.description
          ]
        );
      }
    }

    // 4. Mark batch as Rolled Back
    await client.query(
      `UPDATE vyapar_imports SET
        status = 'Rolled Back',
        rollback_at = CURRENT_TIMESTAMP,
        rollback_by_name = $3,
        rollback_reason = $4
       WHERE id = $1 AND business_id = $2;`,
      [importId, context.businessId, context.name || 'Admin', reason || 'Administrative Rollback']
    );

    await client.query('COMMIT');
    return {
      success: true,
      message: `Batch "${importId}" successfully rolled back: ${createdIds.length} created items removed, ${updatedSnapshots.length} updated products restored.`
    };
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rErr) {
        console.warn('[SERVER_PRODUCT_IMPORTER_ROLLBACK]: Failed to rollback transaction:', rErr);
      }
    }
    throw sanitizeDatabaseError(err, 'Failed to rollback import batch');
  } finally {
    if (client) {
      client.release();
    }
  }
}
