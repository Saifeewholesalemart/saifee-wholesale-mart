import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateBackupFileName } from '@/lib/backupEngine';

export async function GET() {
  try {
    const snapshot = db.exportFullDatabaseBackup();
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
