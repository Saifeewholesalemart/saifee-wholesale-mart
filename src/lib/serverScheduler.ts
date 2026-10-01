// Server Nightly Backup Scheduler & Retention Manager
import { db } from '@/lib/db';
import { saveSnapshotToServer, cleanupExpiredSnapshots, listServerSnapshots } from '@/lib/serverSnapshotManager';

let schedulerInitialized = false;

/**
 * Checks and triggers nightly backup if due
 */
export function checkAndExecuteNightlyBackup(): { executed: boolean; message: string } {
  try {
    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];
    
    // Check existing snapshots to see if today's nightly snapshot already exists
    const snapshots = listServerSnapshots();
    const alreadyBackedUpToday = snapshots.some(s => s.fileName.includes(todayDateStr) && s.isAutomatic);

    // Enforce 30-day retention
    cleanupExpiredSnapshots(30);

    // If backup not done today and current hour is near end of day (>= 23:00) or requested
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const isNightlyWindow = (currentHour === 23 && currentMinute >= 50);

    if (!alreadyBackedUpToday && isNightlyWindow) {
      const snapshotPayload = db.exportFullDatabaseBackup();
      const savedInfo = saveSnapshotToServer(snapshotPayload, true);
      return {
        executed: true,
        message: `Automated nightly backup created: ${savedInfo.fileName}`
      };
    }

    return {
      executed: false,
      message: alreadyBackedUpToday ? 'Nightly backup already completed for today.' : 'Not in nightly scheduled backup window (11:59 PM).'
    };
  } catch (error: any) {
    console.error('[Nightly Scheduler Error]:', error);
    return {
      executed: false,
      message: error?.message || 'Error executing nightly backup.'
    };
  }
}

/**
 * Initializes the background timer for scheduled tasks
 */
export function initNightlyBackupScheduler() {
  if (schedulerInitialized) return;
  schedulerInitialized = true;

  // Run initial check and schedule hourly check
  try {
    checkAndExecuteNightlyBackup();
  } catch (e) {
    console.warn('[Scheduler] Initial check warning:', e);
  }

  // Check every 15 minutes
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      try {
        checkAndExecuteNightlyBackup();
      } catch (err) {
        console.error('[Scheduler Interval Error]:', err);
      }
    }, 15 * 60 * 1000);
  }
}
