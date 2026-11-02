import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';
import {
  isServerDatabaseConfigured,
  getServerTenantContext,
  assertTenantAdmin,
  sanitizeDatabaseError
} from '@/lib/serverDb';
import { rollbackServerProductImport } from '@/lib/serverProductImporter';

/**
 * POST /api/admin/products/import/rollback
 * Executes a safe, transactional rollback of an imported batch.
 * Verifies foreign key dependencies against orders/invoices before reversal.
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
    const { importId, reason } = body;

    if (!importId || typeof importId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Import ID is required for rollback.' },
        { status: 400 }
      );
    }

    const trimmedId = importId.trim();

    if (isServerDatabaseConfigured()) {
      const context = getServerTenantContext(req);
      assertTenantAdmin(context);

      const result = await rollbackServerProductImport(context, trimmedId, reason?.trim());
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.message },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        message: result.message
      });
    }

    // Fail closed: Never silently fall back to ephemeral in-memory storage on rollback.
    // Rollback requires an active, configured server PostgreSQL database.
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection is not configured on this server. Rollback requires an active server database to guarantee persistence.'
      },
      { status: 503 }
    );
  } catch (err: any) {
    const sanitized = sanitizeDatabaseError(err, 'Product Import Rollback');
    console.error('[API Product Import Rollback Error]:', sanitized.message);
    return NextResponse.json(
      { success: false, error: sanitized.message },
      { status: sanitized.statusCode || 500 }
    );
  }
}
