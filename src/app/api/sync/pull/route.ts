import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authSession';
import { retailerScopeFor } from '@/lib/serverCloudRecords';
import {
  isServerDatabaseConfigured,
  getServerTenantContext
} from '@/lib/serverDb';
import { executeServerSyncPull } from '@/lib/serverSyncEngine';

/**
 * POST /api/sync/pull
 * Fetches incremental database changes since the client's last high-watermark timestamp.
 * Enforces authentication, tenant isolation, and non-blocking delta queries.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    if (!isServerDatabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'PostgreSQL database is not configured. Incremental sync requires a configured server database.',
          isConfigured: false
        },
        { status: 503 }
      );
    }

    const context = getServerTenantContext(req);
    const body = await req.json().catch(() => ({}));
    const { since, limit, offset, tables } = body;

    const result = await executeServerSyncPull(context, {
      since: typeof since === 'string' ? since : null,
      limit: typeof limit === 'number' ? limit : undefined,
      offset: typeof offset === 'number' ? offset : undefined,
      tables: Array.isArray(tables) ? tables : undefined,
      retailerId: retailerScopeFor(context, auth.profile)?.retailerId || null
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API Sync Pull Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to pull incremental changes' },
      { status: err?.statusCode || 500 }
    );
  }
}
