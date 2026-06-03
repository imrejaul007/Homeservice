import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { getSettings, updateSettings } from './settings.service';
import { getPlatformPolicySync } from './platformSettingsPolicy.service';
import { createCloudBackupAdapter } from './cloudBackup.adapter';
import { exportSettings } from './settings.service';
import logger from '../utils/logger';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUP_BYTES = 500 * 1024 * 1024; // 500 MB guard

export interface PlatformBackupRunResult {
  success: boolean;
  timestamp: string;
  settingsFile?: string;
  databaseFile?: string;
  cloudUpload?: { provider: string; message?: string };
  error?: string;
}

async function ensureBackupDir(): Promise<void> {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export async function exportPlatformSettingsToFile(): Promise<string> {
  await ensureBackupDir();
  const payload = await exportSettings();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(BACKUP_DIR, `settings-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

export async function exportDatabaseCollectionsToFile(): Promise<string> {
  await ensureBackupDir();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection not available for backup');
  }

  const collections = await db.listCollections().toArray();
  const backupData: Record<string, unknown[]> = {};
  let totalDocuments = 0;

  for (const { name: collectionName } of collections) {
    if (collectionName.startsWith('system.')) continue;
    const documents = await db.collection(collectionName).find({}).toArray();
    backupData[collectionName] = documents;
    totalDocuments += documents.length;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(BACKUP_DIR, `db-${timestamp}.json`);
  const content = {
    version: '1.0',
    timestamp,
    collections: Object.keys(backupData),
    totalDocuments,
    data: backupData,
  };

  fs.writeFileSync(filePath, JSON.stringify(content));
  const size = fs.statSync(filePath).size;
  if (size > MAX_BACKUP_BYTES) {
    fs.unlinkSync(filePath);
    throw new Error(`Backup exceeds maximum size (${MAX_BACKUP_BYTES} bytes)`);
  }

  return filePath;
}

export function pruneOldBackups(retentionDays: number): number {
  if (!fs.existsSync(BACKUP_DIR)) return 0;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  for (const file of fs.readdirSync(BACKUP_DIR)) {
    if (!file.endsWith('.json')) continue;
    const fullPath = path.join(BACKUP_DIR, file);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fullPath);
      removed += 1;
    }
  }

  return removed;
}

export async function runPlatformBackup(): Promise<PlatformBackupRunResult> {
  const policy = getPlatformPolicySync();
  if (!policy.backupEnabled) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: 'Backup disabled in platform settings',
    };
  }

  const timestamp = new Date().toISOString();

  try {
    const settingsFile = await exportPlatformSettingsToFile();
    const databaseFile = await exportDatabaseCollectionsToFile();
    const adapter = createCloudBackupAdapter(policy.backupCloudStorage);
    const key = `platform/${path.basename(databaseFile)}`;
    const cloudUpload = await adapter.upload(databaseFile, key);
    const pruned = pruneOldBackups(policy.backupRetentionDays);

    await updateSettings(
      { backupLastRunAt: new Date() } as any,
      undefined,
      'Scheduled platform backup completed'
    );

    logger.info('Platform backup completed', {
      backupStatus: 'success',
      settingsFile,
      databaseFile,
      pruned,
      cloudProvider: cloudUpload.provider,
      action: 'PLATFORM_BACKUP_SUCCESS',
    });

    return {
      success: true,
      timestamp,
      settingsFile,
      databaseFile,
      cloudUpload: { provider: cloudUpload.provider, message: cloudUpload.message },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Platform backup failed', {
      backupStatus: 'failed',
      error: message,
      action: 'PLATFORM_BACKUP_FAILED',
    });
    return { success: false, timestamp, error: message };
  }
}

export function listLocalBackups(): { name: string; size: number; date: Date }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const fullPath = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(fullPath);
      return { name: f, size: stat.size, date: stat.mtime };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
