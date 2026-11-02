import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveSnapshotToServer, readSnapshotFromServer, deleteSnapshotFromServer } from '@/lib/serverSnapshotManager';
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

    let payload;
    try {
      const body = await req.json();
      if (body && (body.tables || body.metadata)) {
        payload = body;
      }
    } catch {
      // Body not provided or empty, use server database instance
    }

    if (!payload) {
      payload = db.exportFullDatabaseBackup();
    }

    // Sanitize credentials so passwords are not written to snapshot files
    if (payload.tables) {
      if (payload.tables.profiles) {
        payload.tables.profiles = sanitizeProfiles(payload.tables.profiles) as any;
      }
      if (payload.tables.retailers) {
        payload.tables.retailers = sanitizeProfiles(payload.tables.retailers) as any;
      }
    }

    const snapshotInfo = saveSnapshotToServer(payload, false);

    return NextResponse.json({
      success: true,
      message: 'Server backup snapshot created successfully on local disk.',
      snapshot: snapshotInfo
    });
  } catch (error: any) {
    console.error('[API Create Snapshot Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create server snapshot.' },
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

    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ success: false, error: 'File name is required.' }, { status: 400 });
    }

    const snapshotData = readSnapshotFromServer(fileName);

    // Sanitize credentials before returning
    if (snapshotData && snapshotData.tables) {
      if (snapshotData.tables.profiles) {
        snapshotData.tables.profiles = sanitizeProfiles(snapshotData.tables.profiles) as any;
      }
      if (snapshotData.tables.retailers) {
        snapshotData.tables.retailers = sanitizeProfiles(snapshotData.tables.retailers) as any;
      }
    }

    return new NextResponse(JSON.stringify(snapshotData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (error: any) {
    console.error('[API Read Snapshot Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to read server snapshot.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ success: false, error: 'File name is required.' }, { status: 400 });
    }

    const deleted = deleteSnapshotFromServer(fileName);

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Snapshot not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Snapshot ${fileName} deleted successfully.`
    });
  } catch (error: any) {
    console.error('[API Delete Snapshot Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete server snapshot.' },
      { status: 500 }
    );
  }
}
