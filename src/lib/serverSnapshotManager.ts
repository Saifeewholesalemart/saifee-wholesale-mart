import fs from 'fs';
import path from 'path';

export interface ServerSnapshotInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  createdDate: string;
  isAutomatic: boolean;
  totalRecords?: number;
  metadata?: any;
}

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');

/**
 * Ensures backups directory exists
 */
export function ensureBackupsDirectory(): string {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  return BACKUPS_DIR;
}

/**
 * Formats byte size into human readable string (KB, MB)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Cleans up snapshots older than 30 days (Rolling Retention Policy)
 */
export function cleanupExpiredSnapshots(retentionDays = 30): { deletedCount: number; deletedFiles: string[] } {
  const dir = ensureBackupsDirectory();
  const files = fs.readdirSync(dir);
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

  const deletedFiles: string[] = [];

  files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const fullPath = path.join(dir, file);
    try {
      const stats = fs.statSync(fullPath);
      const fileAgeMs = now - stats.mtimeMs;
      if (fileAgeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        deletedFiles.push(file);
      }
    } catch (err) {
      console.error(`[Backup Retention] Error checking file ${file}:`, err);
    }
  });

  return {
    deletedCount: deletedFiles.length,
    deletedFiles
  };
}

/**
 * Lists all available backup snapshots stored on the server
 */
export function listServerSnapshots(): ServerSnapshotInfo[] {
  const dir = ensureBackupsDirectory();
  // Enforce 30-day retention cleanup on each list check
  cleanupExpiredSnapshots(30);

  const files = fs.readdirSync(dir);
  const snapshots: ServerSnapshotInfo[] = [];

  files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const fullPath = path.join(dir, file);
    try {
      const stats = fs.statSync(fullPath);
      let totalRecords: number | undefined = undefined;
      let metadata: any = undefined;

      try {
        // Read file header to parse metadata without reading giant files
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.metadata) {
          totalRecords = parsed.metadata.totalRecords;
          metadata = parsed.metadata;
        }
      } catch {
        // ignore parse error for light listing
      }

      snapshots.push({
        fileName: file,
        filePath: fullPath,
        sizeBytes: stats.size,
        sizeFormatted: formatBytes(stats.size),
        createdAt: stats.mtime.toISOString(),
        createdDate: stats.mtime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        isAutomatic: file.includes('auto') || file.includes('nightly'),
        totalRecords,
        metadata
      });
    } catch (err) {
      console.error(`[ServerSnapshot] Error reading snapshot ${file}:`, err);
    }
  });

  // Sort descending by creation date
  snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return snapshots;
}

/**
 * Saves a backup snapshot payload to server local disk
 */
export function saveSnapshotToServer(payload: any, isNightly = false): ServerSnapshotInfo {
  const dir = ensureBackupsDirectory();
  cleanupExpiredSnapshots(30);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  const prefix = isNightly ? 'saifee_fmcg_nightly_backup' : 'saifee_fmcg_server_snapshot';
  const fileName = `${prefix}_${year}-${month}-${day}_${hours}${minutes}.json`;
  const fullPath = path.join(dir, fileName);

  const jsonContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  fs.writeFileSync(fullPath, jsonContent, 'utf-8');

  const stats = fs.statSync(fullPath);

  return {
    fileName,
    filePath: fullPath,
    sizeBytes: stats.size,
    sizeFormatted: formatBytes(stats.size),
    createdAt: stats.mtime.toISOString(),
    createdDate: stats.mtime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    isAutomatic: isNightly,
    totalRecords: payload?.metadata?.totalRecords,
    metadata: payload?.metadata
  };
}

/**
 * Reads a snapshot file from disk
 */
export function readSnapshotFromServer(fileName: string): any {
  const safeName = path.basename(fileName);
  const fullPath = path.join(BACKUPS_DIR, safeName);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Backup snapshot file ${safeName} does not exist on the server.`);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Deletes a snapshot file from disk
 */
export function deleteSnapshotFromServer(fileName: string): boolean {
  const safeName = path.basename(fileName);
  const fullPath = path.join(BACKUPS_DIR, safeName);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    return true;
  }
  return false;
}
