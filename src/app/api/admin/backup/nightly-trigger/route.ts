import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveSnapshotToServer } from '@/lib/serverSnapshotManager';
import { checkAndExecuteNightlyBackup } from '@/lib/serverScheduler';

export async function POST() {
  try {
    // Force create a nightly snapshot
    const payload = db.exportFullDatabaseBackup();
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

export async function GET() {
  try {
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
