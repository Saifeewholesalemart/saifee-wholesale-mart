import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';
import {
  isServerDatabaseConfigured,
  getServerTenantContext
} from '@/lib/serverDb';
import { executeServerSyncPush } from '@/lib/serverSyncEngine';

/**
 * POST /api/sync/push
 * Transacts offline changes to normalized PostgreSQL tables.
 * Enforces CSRF defense, HMAC session verification, tenant isolation,
 * anti-stale overwrite protection, and append-only ledger immutability.
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cross-site request rejected.' },
        { status: 403 }
      );
    }

    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    // Retailer logins never change products, stock or other master data
    if (auth.profile?.role === 'retailer' || String(auth.profile?.profile_type || '').toUpperCase() === 'RETAILER') {
      return NextResponse.json(
        { success: false, error: 'Retailer logins cannot change master data.' },
        { status: 403 }
      );
    }

    if (!isServerDatabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'PostgreSQL database is not configured. Incremental push requires a configured server database.',
          isConfigured: false
        },
        { status: 503 }
      );
    }

    const context = getServerTenantContext(req);
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object' || !body.changes) {
      return NextResponse.json(
        { success: false, error: 'Invalid sync payload. Expected object with "changes".' },
        { status: 400 }
      );
    }

    const result = await executeServerSyncPush(context, {
      clientSyncTimestamp: body.clientSyncTimestamp || new Date().toISOString(),
      business_id: body.business_id, // Validated against context.businessId inside executeServerSyncPush
      changes: body.changes || {},
      tombstones: Array.isArray(body.tombstones) ? body.tombstones : undefined
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API Sync Push Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to push sync changes' },
      { status: err?.statusCode || 500 }
    );
  }
}
