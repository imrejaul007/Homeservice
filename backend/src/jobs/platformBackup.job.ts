import { runPlatformBackup } from '../services/platformBackup.service';
import logger from '../utils/logger';

export async function executePlatformBackupJob(): Promise<void> {
  const result = await runPlatformBackup();
  if (!result.success && result.error !== 'Backup disabled in platform settings') {
    logger.warn('Platform backup job finished with errors', {
      backupStatus: result.error,
      action: 'PLATFORM_BACKUP_JOB',
    });
  }
}
