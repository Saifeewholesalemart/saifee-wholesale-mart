import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveSnapshotToServer } from '@/lib/serverSnapshotManager';
import { getAuthenticatedUser, validateCsrfOrigin } from '@/lib/authSession';

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

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid backup payload. Expected JSON object.' },
        { status: 400 }
      );
    }

    const tables = body.tables || body;
    if (!tables || typeof tables !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid backup format. Missing table collections.' },
        { status: 400 }
      );
    }

    // Restore into server db instance
    const restoreResult = db.restoreFullDatabaseBackup(body);

    // Also persist a disk snapshot of this restored state for safe keeping
    try {
      saveSnapshotToServer(body, false);
    } catch (diskErr) {
      console.warn('[Restore] Note: Could not write restored snapshot to disk:', diskErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Database backup restored successfully into active memory and storage.',
      counts: restoreResult.counts,
      restoredAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[API Backup Restore Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to restore database backup.' },
      { status: 500 }
    );
  }
}
