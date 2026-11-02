import { NextRequest, NextResponse } from 'next/server';
import { listServerSnapshots } from '@/lib/serverSnapshotManager';
import { getAuthenticatedUser } from '@/lib/authSession';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please log in.' }, { status: 401 });
    }
    if (auth.session.role !== 'admin' && auth.session.profileType !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

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
