import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveSnapshotToServer } from '@/lib/serverSnapshotManager';
import { checkAndExecuteNightlyBackup } from '@/lib/serverScheduler';
import { getAuthenticatedUser, sanitizeProfiles, validateCsrfOrigin } from '@/lib/authSession';

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

    // Force create a nightly snapshot with sanitized credentials
    const payload = db.exportFullDatabaseBackup();
    if (payload.tables) {
      if (payload.tables.profiles) {
        payload.tables.profiles = sanitizeProfiles(payload.tables.profiles) as any;
      }
      if (payload.tables.retailers) {
        payload.tables.retailers = sanitizeProfiles(payload.tables.retailers) as any;
      }
    }

    const savedInfo = saveSnapshotToServer(payload, true);

    return NextResponse.json({
      success: true,
      message: 'Nightly backup snapshot generated successfully.',
      snapshot: savedInfo
    });
  } catch (error: any) {
    console.error('[Nightly Trigger Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to trigger nightly backup.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please log in.' }, { status: 401 });
    }
    if (auth.session.role !== 'admin' && auth.session.profileType !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const result = checkAndExecuteNightlyBackup();
    return NextResponse.json({
      success: true,
      status: result
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to evaluate nightly backup status.' },
      { status: 500 }
    );
  }
}
