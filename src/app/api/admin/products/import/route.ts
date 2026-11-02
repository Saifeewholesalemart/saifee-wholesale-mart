import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';
import {
  isServerDatabaseConfigured,
  getServerTenantContext,
  assertTenantAdmin,
  getDatabasePool,
  sanitizeDatabaseError
} from '@/lib/serverDb';
import {
  executeServerProductImport,
  resolveOrCreateBusinessCompany
} from '@/lib/serverProductImporter';

/**
 * GET /api/admin/products/import
 * Returns list of completed/historical import batches for the authenticated tenant.
 * Enforces authentication, server authorization, and tenant isolation.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please log in.' }, { status: 401 });
    }
    if (auth.session.role !== 'admin' && auth.session.profileType !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    // Tenant isolation: Always derive business_id from server session
    const tenantId = auth.session.businessId || (auth.profile as any).business_id || 'biz-saifee';

    if (isServerDatabaseConfigured()) {
      const context = getServerTenantContext(req);
      assertTenantAdmin(context);
      const pool = getDatabasePool();
      const targetBiz = await resolveOrCreateBusinessCompany(pool, context.businessId);
      const res = await pool.query(
        `SELECT id, business_id, file_name, file_size, imported_at, total_rows,
                created_count, updated_count, skipped_count, failed_count,
                stock_units_imported, status, imported_by_id, imported_by_name,
                created_product_ids, updated_snapshots, created_batch_ids,
                created_ledger_ids, column_mapping, row_logs, rollback_at, rollback_reason
         FROM vyapar_imports
         WHERE business_id = $1 OR business_id = $2
         ORDER BY imported_at DESC;`,
        [context.businessId, targetBiz]
      );
      return NextResponse.json({
        success: true,
        count: res.rows.length,
        imports: res.rows
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Database connection is not configured on this server. Product imports history requires an active server database.',
        imports: []
      },
      { status: 503 }
    );
  } catch (err: any) {
    const sanitized = sanitizeDatabaseError(err, 'Product Import History');
    return NextResponse.json(
      { success: false, error: sanitized.message, imports: [] },
      { status: sanitized.statusCode || 500 }
    );
  }
}

/**
 * POST /api/admin/products/import
 * Executes an atomic batch import of products into normalized tables.
 * Enforces CSRF defense, admin authentication, tenant isolation, and audit logging.
 */
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
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { rows, meta } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid import payload. Expected non-empty array of rows.' },
        { status: 400 }
      );
    }

    // CRITICAL SECURITY RULE: Tenant isolation and user attribution are strictly server-derived.
    // Client-supplied business_id or user_id in the body MUST NOT be trusted.
    const tenantId = auth.session.businessId || (auth.profile as any).business_id || 'biz-saifee';
    const userId = auth.session.userId;
    const userName = auth.profile.name || auth.profile.full_name || 'Admin';

    const safeMeta = {
      file_name: typeof meta?.file_name === 'string' ? meta.file_name.trim() : 'products_import.xlsx',
      file_size: typeof meta?.file_size === 'number' ? meta.file_size : undefined,
      column_mapping: meta?.column_mapping && typeof meta.column_mapping === 'object' ? meta.column_mapping : {},
      business_id: tenantId,
      user_id: userId,
      user_name: userName,
      import_opening_stock: Boolean(meta?.import_opening_stock),
      idempotency_key: typeof meta?.idempotency_key === 'string' ? meta.idempotency_key.trim() : undefined,
      chunk_size: typeof meta?.chunk_size === 'number' ? meta.chunk_size : undefined
    };

    // If server PostgreSQL database is configured, use transactional PostgreSQL engine
    if (isServerDatabaseConfigured()) {
      const context = getServerTenantContext(req);
      assertTenantAdmin(context);

      const pgResult = await executeServerProductImport(context, rows, safeMeta);
      return NextResponse.json({
        success: true,
        message: `Batch import completed. ${pgResult.batch.created_count} created, ${pgResult.batch.updated_count} updated, ${pgResult.batch.skipped_count} skipped.`,
        importId: pgResult.importId,
        batch: pgResult.batch,
        result: {
          importId: pgResult.importId,
          batch: pgResult.batch
        }
      });
    }

    // Fail closed: Never silently fall back to ephemeral in-memory storage on product imports.
    // Cloud persistence requires an active, configured server PostgreSQL database.
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection is not configured on this server. Product import requires an active server database to guarantee persistence.'
      },
      { status: 503 }
    );
  } catch (err: any) {
    const sanitized = sanitizeDatabaseError(err, 'Product Import');
    console.error('[API Product Import Error]:', sanitized.message);
    return NextResponse.json(
      { success: false, error: sanitized.message },
      { status: sanitized.statusCode || 500 }
    );
  }
}
