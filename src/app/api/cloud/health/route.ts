import { NextResponse } from 'next/server';
import { isServerDatabaseConfigured } from '@/lib/serverDb';
import { getCloudHealth } from '@/lib/serverCloudRecords';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cloud/health
 * App start hote hi check karta hai: server cloud database tak pahunch pa raha hai ya nahi,
 * aur app_records table bana hua hai ya nahi.
 */
export async function GET() {
  if (!isServerDatabaseConfigured()) {
    return NextResponse.json(
      { success: false, dbConfigured: false, dbReachable: false, tableReady: false, error: 'Cloud database is not configured on the server.' },
      { status: 503 }
    );
  }
  try {
    const health = await getCloudHealth();
    return NextResponse.json({ success: true, dbConfigured: true, ...health });
  } catch (err: any) {
    console.error('[API Cloud Health Error]:', err?.message);
    return NextResponse.json(
      { success: false, dbConfigured: true, dbReachable: false, tableReady: false, error: 'Server cannot reach the cloud database.' },
      { status: 503 }
    );
  }
}
