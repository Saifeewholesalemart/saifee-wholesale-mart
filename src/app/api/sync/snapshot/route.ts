import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';
import { isServerDatabaseConfigured, executeRawQuery } from '@/lib/serverDb';
import { listServerSnapshots, readSnapshotFromServer, saveSnapshotToServer } from '@/lib/serverSnapshotManager';

/**
 * Server-Side Synchronized Snapshot Gateway
 * File: src/app/api/sync/snapshot/route.ts
 *
 * Preserves legacy FMCG full database snapshot sync functionality while enforcing:
 * 1. Strict HMAC session authentication (rejects anon and unauthenticated requests).
 * 2. Administrative role verification (only admin/owner can read or write database snapshots).
 * 3. Origin/CSRF validation on mutation endpoints.
 * 4. Parameterized PostgreSQL query execution via serverDb connection pool.
 * 5. Transparent fallback to disk backup manager when server database is offline.
 */

const CLOUD_SYNC_KEY = 'fmcg_cloud_database_v1';

/**
 * GET /api/sync/snapshot
 * Retrieves the cloud database snapshot.
 * Requires authenticated administrative user.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    if (auth.session.role !== 'admin' && auth.session.profileType !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Administrative role required to access cloud database snapshots.' },
        { status: 403 }
      );
    }

    // 1. Try querying system_settings from configured server database pool
    if (isServerDatabaseConfigured()) {
      try {
        const result = await executeRawQuery<{ key: string; value: any; updated_at: string }>(
          'SELECT key, value, updated_at FROM system_settings WHERE key = $1 LIMIT 1',
          [CLOUD_SYNC_KEY]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          let val = row.value;
          if (typeof val === 'string') {
            try {
              val = JSON.parse(val);
            } catch {
              // keep as string
            }
          }
          return NextResponse.json({
            success: true,
            key: row.key,
            data: val,
            updatedAt: row.updated_at
          });
        }
      } catch (dbErr: any) {
        console.warn('[SyncSnapshotAPI] Database read error, attempting disk backup fallback:', dbErr?.message);
      }
    }

    // 2. Fallback to latest local server snapshot if available
    try {
      const snapshots = listServerSnapshots();
      if (snapshots.length > 0) {
        const latest = readSnapshotFromServer(snapshots[0].fileName);
        if (latest) {
          return NextResponse.json({
            success: true,
            key: CLOUD_SYNC_KEY,
            data: latest,
            updatedAt: snapshots[0].createdAt
          });
        }
      }
    } catch (diskErr) {
      console.warn('[SyncSnapshotAPI] Disk fallback check error:', diskErr);
    }

    return NextResponse.json({
      success: true,
      key: CLOUD_SYNC_KEY,
      data: null,
      message: 'No cloud database snapshot available.'
    });
  } catch (err: any) {
    console.error('[SyncSnapshotAPI Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch database snapshot' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/snapshot
 * Pushes/upserts the cloud database snapshot.
 * Requires CSRF validation and authenticated administrative user.
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

    if (auth.session.role !== 'admin' && auth.session.profileType !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Administrative role required to push cloud database snapshots.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid snapshot payload. Expected JSON body.' },
        { status: 400 }
      );
    }

    const key = body.key || CLOUD_SYNC_KEY;
    const value = body.value !== undefined ? body.value : body;
    const updatedAt = body.updated_at || new Date().toISOString();
    let savedToDb = false;

    // 1. Upsert into system_settings table if server database is configured
    if (isServerDatabaseConfigured()) {
      try {
        const valueJson = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await executeRawQuery(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_at = EXCLUDED.updated_at;`,
          [key, valueJson, updatedAt]
        );
        savedToDb = true;
      } catch (dbErr: any) {
        console.warn('[SyncSnapshotAPI] Database upsert notice:', dbErr?.message);
      }
    }

    // 2. Also persist uncompressed tables payload to server local disk for disaster recovery
    try {
      if (value && typeof value === 'object' && value.tables) {
        saveSnapshotToServer(value, false);
      }
    } catch (diskErr) {
      console.warn('[SyncSnapshotAPI] Local disk backup notice:', diskErr);
    }

    if (!savedToDb) {
      return NextResponse.json(
        {
          success: false,
          savedToDb: false,
          error: 'Cloud database is not configured or failed to persist system snapshot. Persistence could not be confirmed.'
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      savedToDb: true,
      updatedAt,
      message: 'Snapshot synchronized successfully.'
    });
  } catch (err: any) {
    console.error('[SyncSnapshotAPI Push Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to push database snapshot' },
      { status: 500 }
    );
  }
}

