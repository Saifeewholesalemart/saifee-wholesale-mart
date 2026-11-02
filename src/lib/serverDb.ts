/**
 * Server-Side PostgreSQL Database Engine & Multi-Tenant Security Gateway
 * FMCG Wholesale Distribution & Trade Management System
 * File: src/lib/serverDb.ts
 *
 * SAFETY & ARCHITECTURE PRINCIPLES:
 * 1. STRICT SERVER-ONLY: Enforces execution strictly within Node.js server environments.
 *    Browser execution throws an immediate security exception.
 * 2. ZERO CLIENT-SIDE EXPOSURE: Credentials (DATABASE_URL, service keys) are never prefixed
 *    with NEXT_PUBLIC_ and are never bundled into client-side JS chunks.
 * 3. CONNECTION POOLING: Singleton connection pool for serverless/route handlers to avoid connection leaks.
 * 4. PARAMETERIZED QUERIES: Enforces strict SQL parameterization ($1, $2, ...) to prevent SQL injection.
 * 5. TENANT CONTEXT FROM CRYPTOGRAPHIC HMAC: Tenant business_id is derived strictly from the
 *    authenticated session. Client-supplied business_id parameters are never trusted.
 * 6. DEFENSE-IN-DEPTH RLS INTEGRATION:
 *    - Sets session variable `app.current_business_id` for PostgreSQL RLS policies.
 *    - Appends explicit `business_id = $1` filters on all tenant queries because service-role
 *      connections bypass PostgreSQL RLS by default.
 * 7. SANITIZED ERROR HANDLING: Database internals, connection strings, and server credentials
 *    are stripped from all thrown errors.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { SessionPayload, verifySessionToken, getSessionFromRequest } from './authSession';

// ----------------------------------------------------------------------------
// 1. STRICT SERVER-ONLY ENFORCEMENT
// ----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  throw new Error('[CRITICAL SECURITY VIOLATION]: serverDb must only be imported and executed in server-side Node.js environment!');
}

// ----------------------------------------------------------------------------
// 2. ERROR DEFINITIONS & SAFE ERROR SANITIZATION
// ----------------------------------------------------------------------------
export class DatabaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'DATABASE_ERROR', statusCode = 500) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends DatabaseError {
  constructor(message = 'Unauthorized: Access denied for this tenant or role') {
    super(message, 'UNAUTHORIZED', 403);
    this.name = 'UnauthorizedError';
  }
}

export class TenantMismatchError extends DatabaseError {
  constructor(message = 'Security Violation: Tenant identifier mismatch detected') {
    super(message, 'TENANT_MISMATCH', 403);
    this.name = 'TenantMismatchError';
  }
}

export class DatabaseNotConfiguredError extends DatabaseError {
  constructor(message = 'Database connection string is not configured on this server') {
    super(message, 'DATABASE_NOT_CONFIGURED', 503);
    this.name = 'DatabaseNotConfiguredError';
  }
}

/**
 * Sanitizes any raw database error object to ensure connection strings, passwords,
 * internal hosts, and SQL fragments are never leaked.
 */
export function sanitizeDatabaseError(error: any, contextDescription?: string): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  const rawMessage = error?.message || 'Unknown database exception';

  // Scrub any database URL or credentials (postgres://user:pass@host:port/db)
  const scrubbed = rawMessage
    .replace(/postgres(?:ql)?:\/\/[^@]+@[^/]+/gi, 'postgres://[REDACTED_USER]:[REDACTED_PASS]@[REDACTED_HOST]')
    .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_JWT]');

  const prefix = contextDescription ? `[${contextDescription}] ` : '';

  // Common PostgreSQL error codes
  if (error?.code === '28P01') {
    return new DatabaseError(`${prefix}Database authentication failed`, error?.code || 'AUTH_FAILED', 500);
  }
  if (error?.code === '3D000') {
    return new DatabaseError(`${prefix}Database does not exist`, error?.code || 'DB_NOT_FOUND', 500);
  }
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
    const hostHint = error?.hostname ? ` (${error.hostname})` : '';
    return new DatabaseError(`${prefix}Database server DNS resolution failed or host unreachable${hostHint}`, error?.code || 'CONNECTION_TIMEOUT', 503);
  }

  return new DatabaseError(`${prefix}Database operation failed: ${scrubbed}`, error?.code || 'QUERY_FAILED', 500);
}

// ----------------------------------------------------------------------------
// 3. SECURE CONNECTION POOL LIFECYCLE
// ----------------------------------------------------------------------------
declare global {
  // Global declaration prevents multiple pool instances during dev hot-reloads
  // eslint-disable-next-line no-var
  var __saifee_server_pg_pool: Pool | undefined;
}

const BLOCKED_PRODUCTION_REFS = ['wxctglnnybhhptkxwxur'];
const EXPECTED_STAGING_REF = 'jtofsoriinobcabpjswl';

/**
 * Derives the server database connection string from server-only environment variables.
 * Never reads or exposes NEXT_PUBLIC_ variables.
 * Enforces production blocklist and staging reference validation.
 */
export function getServerDatabaseUrl(): string | null {
  let url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || process.env.STAGING_DATABASE_URL;

  // Fallback: Safely read from .env.staging if DATABASE_URL is not yet in process.env
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    try {
      if (typeof window === 'undefined') {
        const fs = require('fs');
        const path = require('path');
        const stagingEnvPath = path.resolve(process.cwd(), '.env.staging');
        if (fs.existsSync(stagingEnvPath)) {
          const content = fs.readFileSync(stagingEnvPath, 'utf8');
          for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const idx = trimmed.indexOf('=');
              if (idx !== -1) {
                const k = trimmed.substring(0, idx).trim();
                const v = trimmed.substring(idx + 1).trim();
                if (k === 'STAGING_DATABASE_URL' || k === 'DATABASE_URL') {
                  url = v;
                  process.env.DATABASE_URL = v;
                  break;
                }
              }
            }
          }
        }
      }
    } catch {
      // Safe fallback if fs read is restricted
    }
  }

  if (url && typeof url === 'string' && url.trim().length > 0) {
    const trimmed = url.trim();

    // STRICT DEFENSE-IN-DEPTH: Block any attempt to connect to production database
    if (BLOCKED_PRODUCTION_REFS.some(ref => trimmed.includes(ref))) {
      throw new DatabaseError(
        '[CRITICAL SECURITY VIOLATION]: Connection to production database wxctglnnybhhptkxwxur is strictly blocked!',
        'PRODUCTION_BLOCKED',
        403
      );
    }

    return trimmed;
  }
  return null;
}

/**
 * Indicates whether a server database connection has been configured.
 */
export function isServerDatabaseConfigured(): boolean {
  try {
    return getServerDatabaseUrl() !== null;
  } catch {
    return false;
  }
}

/**
 * Returns or initializes the shared PostgreSQL connection pool singleton.
 */
export function getDatabasePool(): Pool {
  if (globalThis.__saifee_server_pg_pool) {
    return globalThis.__saifee_server_pg_pool;
  }

  const connectionString = getServerDatabaseUrl();
  if (!connectionString) {
    throw new DatabaseNotConfiguredError();
  }

  // Enforce secure pool defaults
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 5000),
    ssl: process.env.PG_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false }
  });

  pool.on('error', (err) => {
    console.error('[SERVER_DB_POOL_ERROR]: Unexpected idle client error:', sanitizeDatabaseError(err).message);
  });

  globalThis.__saifee_server_pg_pool = pool;
  return pool;
}

/**
 * For testing or teardown: safely closes the connection pool.
 */
export async function closeDatabasePool(): Promise<void> {
  if (globalThis.__saifee_server_pg_pool) {
    const p = globalThis.__saifee_server_pg_pool;
    globalThis.__saifee_server_pg_pool = undefined;
    await p.end();
  }
}

/**
 * For testing purposes: allows injecting a mock pool or adapter.
 */
export function setMockDatabasePool(pool: Pool | undefined): void {
  globalThis.__saifee_server_pg_pool = pool;
}

// ----------------------------------------------------------------------------
// 4. PARAMETERIZED QUERY ENGINE
// ----------------------------------------------------------------------------

/**
 * Executes a raw parameterized query with guaranteed error sanitization and pool recycling.
 */
export async function executeRawQuery<T extends QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  if (!Array.isArray(params)) {
    throw new DatabaseError('Query parameters must be passed as an array to prevent injection', 'INVALID_PARAMS', 400);
  }

  const pool = getDatabasePool();
  try {
    return await pool.query<T>(sql, params);
  } catch (err) {
    throw sanitizeDatabaseError(err);
  }
}

// ----------------------------------------------------------------------------
// 5. TENANT SECURITY CONTEXT & ROLE AUTHORIZATION
// ----------------------------------------------------------------------------

export interface ServerTenantContext {
  userId: string;
  mobile: string;
  name: string;
  role: 'admin' | 'sales_dist' | 'sales_co' | 'retailer' | 'staff';
  profileType: string;
  businessId: string;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  isSalesperson: boolean;
  isRetailer: boolean;
  isStaff: boolean;
}

/**
 * Derives a certified ServerTenantContext from a cryptographically validated HMAC session payload.
 * NEVER accepts user-supplied business_id or spoofed roles.
 */
export function createServerTenantContext(session: SessionPayload): ServerTenantContext {
  if (!session || !session.userId || !session.businessId || !session.role) {
    throw new UnauthorizedError('Invalid or corrupted session payload');
  }

  const isTenantAdmin = session.role === 'admin';
  // Platform administrator: dedicated platform business context or explicit platform user ID
  const isPlatformAdmin = isTenantAdmin && (
    session.businessId === 'biz-platform-root' ||
    session.userId === process.env.PLATFORM_ADMIN_USER_ID
  );

  const isSalesperson = session.role === 'sales_dist' || session.role === 'sales_co';
  const isRetailer = session.role === 'retailer';
  const isStaff = session.role === 'staff';

  return {
    userId: session.userId,
    mobile: session.mobile || '',
    name: session.name || '',
    role: session.role,
    profileType: session.profileType || 'STAFF',
    businessId: session.businessId,
    isPlatformAdmin,
    isTenantAdmin,
    isSalesperson,
    isRetailer,
    isStaff
  };
}

/**
 * Resolves and validates the authenticated caller's tenant context.
 * Accepts a raw HMAC session token string, NextRequest / Request, or an existing SessionPayload.
 * Cryptographically verifies token integrity and rejects missing or forged business_id.
 */
export function getServerTenantContext(
  input: string | Request | SessionPayload | null | undefined
): ServerTenantContext {
  if (!input) {
    throw new UnauthorizedError('Authentication required: Missing session credentials');
  }

  let session: SessionPayload | null = null;

  if (typeof input === 'string') {
    session = verifySessionToken(input);
  } else if (typeof input === 'object' && ('userId' in input && 'businessId' in input && 'role' in input)) {
    session = input as SessionPayload;
  } else if (typeof input === 'object' && 'headers' in input) {
    session = getSessionFromRequest(input as Request);
  }

  if (!session) {
    throw new UnauthorizedError('Authentication failed: Invalid, expired, or tampered session token');
  }

  return createServerTenantContext(session);
}

/**
 * Enforces that the caller is a Tenant Administrator for their business.
 */
export function assertTenantAdmin(context: ServerTenantContext): void {
  if (!context.isTenantAdmin) {
    throw new UnauthorizedError('Administrator privileges required for this business tenant');
  }
}

/**
 * Enforces that the caller is a Platform Administrator.
 */
export function assertPlatformAdmin(context: ServerTenantContext): void {
  if (!context.isPlatformAdmin) {
    throw new UnauthorizedError('Platform Administrator privileges required');
  }
}

/**
 * Enforces that the caller has either Salesperson or Administrator privileges.
 */
export function assertSalesOrAdmin(context: ServerTenantContext): void {
  if (!context.isSalesperson && !context.isTenantAdmin) {
    throw new UnauthorizedError('Salesperson or Administrator privileges required');
  }
}

/**
 * Enforces that the caller has one of the specified allowed roles.
 */
export function assertRole(context: ServerTenantContext, allowedRoles: string[]): void {
  if (!allowedRoles.includes(context.role)) {
    throw new UnauthorizedError(`Access forbidden for role "${context.role}". Allowed roles: ${allowedRoles.join(', ')}`);
  }
}

/**
 * Defends against client-supplied tenant spoofing.
 * If client requested a specific tenant, it MUST match the HMAC session context unless
 * the caller is a certified Platform Administrator.
 */
export function validateTenantAccess(context: ServerTenantContext, requestedBusinessId?: string | null): string {
  if (!requestedBusinessId || requestedBusinessId.trim() === '') {
    return context.businessId;
  }

  const requested = requestedBusinessId.trim();
  if (requested === context.businessId) {
    return context.businessId;
  }

  // Cross-tenant access is permitted ONLY for platform administrators
  if (context.isPlatformAdmin) {
    return requested;
  }

  throw new TenantMismatchError(
    `Security Violation: Caller tenant "${context.businessId}" attempted to access unauthorized tenant "${requested}"`
  );
}

// ----------------------------------------------------------------------------
// 6. TENANT-SCOPED TRANSACTION & QUERY EXECUTION (DEFENSE-IN-DEPTH)
// ----------------------------------------------------------------------------

/**
 * Executes a callback within a managed PostgreSQL transaction where:
 * 1. `app.current_business_id` is set via `SELECT set_config('app.current_business_id', $1, true)`.
 * 2. All operations run atomically (BEGIN / COMMIT / ROLLBACK).
 * 3. Connection is guaranteed returned to pool.
 */
export async function executeTenantTransaction<T>(
  context: ServerTenantContext,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDatabasePool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Set PostgreSQL RLS tenant context for this transaction
    // set_config(setting, value, is_local=true) sets the variable ONLY for the active transaction
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [context.businessId]);

    // 2. Execute caller business operations
    const result = await callback(client);

    // 3. Commit transaction
    await client.query('COMMIT');
    return result;
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.warn('[SERVER_DB_ROLLBACK_NOTICE]: Rollback error:', rollbackErr);
      }
    }
    throw sanitizeDatabaseError(err);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Executes a tenant-isolated query where `business_id` is automatically injected
 * into the parameter list as $1, enforcing defense-in-depth regardless of PostgreSQL
 * service-role RLS bypass.
 */
export async function executeTenantScopedQuery<T extends QueryResultRow = any>(
  context: ServerTenantContext,
  sql: string,
  extraParams: any[] = []
): Promise<QueryResult<T>> {
  if (!Array.isArray(extraParams)) {
    throw new DatabaseError('Query parameters must be passed as an array to prevent injection', 'INVALID_PARAMS', 400);
  }

  // Parameterized tenant validation: if caller supplied business_id as first parameter, verify it matches
  let finalParams: any[];
  if (extraParams.length > 0 && typeof extraParams[0] === 'string' && extraParams[0].startsWith('biz_')) {
    if (extraParams[0] !== context.businessId && !context.isPlatformAdmin) {
      throw new TenantMismatchError(
        `Security Violation: Query parameter tenant "${extraParams[0]}" does not match session tenant "${context.businessId}"`
      );
    }
    finalParams = extraParams;
  } else {
    // Prepend the validated session business_id as $1
    finalParams = [context.businessId, ...extraParams];
  }

  return executeRawQuery<T>(sql, finalParams);
}

// ----------------------------------------------------------------------------
// 7. HIGH-LEVEL SECURE TENANT QUERY HELPERS
// ----------------------------------------------------------------------------

export interface TenantProductRow {
  id: string;
  business_id: string;
  product_code: string;
  name: string;
  company_id: string;
  brand: string;
  category: string;
  mrp: number;
  selling_price: number;
  purchase_price: number;
  trading_unit: string;
  base_unit: string;
  units_per_trading_unit: number;
  active: boolean;
  physical_qty?: number;
  available_qty?: number;
}

/**
 * Fetches products for the active tenant with optional category/active filters.
 * strictly scopes to context.businessId.
 */
export async function getTenantProducts(
  context: ServerTenantContext,
  options: { categoryId?: string; activeOnly?: boolean; limit?: number; offset?: number } = {}
): Promise<TenantProductRow[]> {
  const conditions = ['p.business_id = $1'];
  const params: any[] = [];
  let paramIndex = 2;

  if (options.activeOnly !== false) {
    conditions.push('p.active = TRUE');
  }

  if (options.categoryId) {
    conditions.push(`p.id IN (SELECT product_id FROM product_categories WHERE category_id = $${paramIndex})`);
    params.push(options.categoryId);
    paramIndex++;
  }

  const limit = Math.min(Math.max(1, options.limit || 50), 500);
  const offset = Math.max(0, options.offset || 0);

  const sql = `
    SELECT 
      p.id, p.business_id, p.product_code, p.name, p.company_id, p.brand, p.category,
      p.mrp, p.selling_price, p.purchase_price, p.trading_unit, p.base_unit,
      p.units_per_trading_unit, p.active,
      COALESCE(i.physical_qty, 0) AS physical_qty,
      COALESCE(i.available_qty, 0) AS available_qty
    FROM products p
    LEFT JOIN (
      SELECT business_id, product_id,
             SUM(physical_qty)::integer AS physical_qty,
             SUM(available_qty)::integer AS available_qty
      FROM inventory
      GROUP BY business_id, product_id
    ) i ON i.product_id = p.id AND i.business_id = p.business_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.name ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
  `;

  params.push(limit, offset);
  const result = await executeTenantScopedQuery<TenantProductRow>(context, sql, params);
  return result.rows;
}

export interface TenantOrderRow {
  id: string;
  business_id: string;
  order_number: string;
  retailer_id: string;
  retailer_name?: string;
  source: string;
  channel?: string;
  order_date: string;
  total_amount: number;
  status: string;
  item_count?: number;
}

/**
 * Fetches orders for the active tenant.
 * - Retailers are strictly restricted to their own orders.
 * - Salespersons are restricted to their assigned orders / territory.
 * - Admins can view all orders in the tenant.
 */
export async function getTenantOrders(
  context: ServerTenantContext,
  options: { retailerId?: string; status?: string; limit?: number; offset?: number } = {}
): Promise<TenantOrderRow[]> {
  const conditions = ['o.business_id = $1'];
  const params: any[] = [];
  let paramIndex = 2;

  // Retailer role enforcement: retailer can NEVER view another retailer's orders
  if (context.isRetailer) {
    conditions.push(`o.retailer_id = $${paramIndex}`);
    params.push(context.userId); // In retailer session, userId corresponds to profile/retailer link
    paramIndex++;
  } else if (options.retailerId) {
    conditions.push(`o.retailer_id = $${paramIndex}`);
    params.push(options.retailerId);
    paramIndex++;
  }

  if (options.status) {
    conditions.push(`o.status = $${paramIndex}`);
    params.push(options.status);
    paramIndex++;
  }

  const limit = Math.min(Math.max(1, options.limit || 50), 200);
  const offset = Math.max(0, options.offset || 0);

  const sql = `
    SELECT 
      o.id, o.business_id, o.order_number, o.retailer_id,
      r.shop_name AS retailer_name,
      o.source, o.channel, o.order_date, o.total_amount, o.status,
      COUNT(oi.id) AS item_count
    FROM orders o
    LEFT JOIN retailers r ON r.id = o.retailer_id AND r.business_id = o.business_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY o.id, r.shop_name
    ORDER BY o.order_date DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
  `;

  params.push(limit, offset);
  const result = await executeTenantScopedQuery<TenantOrderRow>(context, sql, params);
  return result.rows;
}

export interface TenantRetailerRow {
  id: string;
  business_id: string;
  retailer_code: string;
  shop_name: string;
  owner_name: string;
  mobile: string;
  city: string;
  credit_limit: number;
  outstanding: number;
  active: boolean;
}

/**
 * Fetches retailer accounts for the active tenant.
 */
export async function getTenantRetailers(
  context: ServerTenantContext,
  options: { activeOnly?: boolean; limit?: number } = {}
): Promise<TenantRetailerRow[]> {
  // Only admin and sales can list all retailers
  assertSalesOrAdmin(context);

  const conditions = ['business_id = $1'];
  if (options.activeOnly !== false) {
    conditions.push('active = TRUE');
  }

  const limit = Math.min(Math.max(1, options.limit || 100), 500);

  const sql = `
    SELECT id, business_id, retailer_code, shop_name, owner_name, mobile, city, credit_limit, outstanding, active
    FROM retailers
    WHERE ${conditions.join(' AND ')}
    ORDER BY shop_name ASC
    LIMIT $2;
  `;

  const result = await executeTenantScopedQuery<TenantRetailerRow>(context, sql, [limit]);
  return result.rows;
}
