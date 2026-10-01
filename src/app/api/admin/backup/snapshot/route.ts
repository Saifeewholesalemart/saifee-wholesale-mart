import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveSnapshotToServer, readSnapshotFromServer, deleteSnapshotFromServer } from '@/lib/serverSnapshotManager';

export async function POST(req: NextRequest) {
  try {
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
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ success: false, error: 'File name is required.' }, { status: 400 });
    }

    const snapshotData = readSnapshotFromServer(fileName);

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
