import { NextResponse } from 'next/server';
import { listServerSnapshots } from '@/lib/serverSnapshotManager';

export async function GET() {
  try {
    const snapshots = listServerSnapshots();
    return NextResponse.json({
      success: true,
      snapshots,
      totalSnapshots: snapshots.length,
      retentionPolicyDays: 30
    });
  } catch (error: any) {
    console.error('[API Snapshots List Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to list server snapshots.' },
      { status: 500 }
    );
  }
}
