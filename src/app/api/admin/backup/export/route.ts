import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateBackupFileName } from '@/lib/backupEngine';
import { getAuthenticatedUser, sanitizeProfiles } from '@/lib/authSession';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please log in.' }, { status: 401 });
    }
    if (auth.session.role !== 'admin' && auth.session.profileType !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required to export database backup' }, { status: 403 });
    }

    const snapshot = db.exportFullDatabaseBackup();

    // Sanitize credentials so passwords/hashes are NEVER exported in API backups
    if (snapshot.tables) {
      if (snapshot.tables.profiles) {
        snapshot.tables.profiles = sanitizeProfiles(snapshot.tables.profiles) as any;
      }
      if (snapshot.tables.retailers) {
        snapshot.tables.retailers = sanitizeProfiles(snapshot.tables.retailers) as any;
      }
    }

    const fileName = generateBackupFileName('saifee_fmcg_backup', 'json');

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (error: any) {
    console.error('[API Backup Export Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to export database backup' },
      { status: 500 }
    );
  }
}
