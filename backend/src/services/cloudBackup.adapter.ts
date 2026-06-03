import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

export interface CloudBackupUploadResult {
  url?: string;
  provider: string;
  skipped?: boolean;
  message?: string;
}

export interface CloudBackupAdapter {
  upload(filePath: string, key: string): Promise<CloudBackupUploadResult>;
  isConfigured(): boolean;
}

export class NoopCloudBackupAdapter implements CloudBackupAdapter {
  isConfigured(): boolean {
    return false;
  }

  async upload(filePath: string, key: string): Promise<CloudBackupUploadResult> {
    logger.info('Cloud backup skipped (storage disabled)', {
      filePath,
      key,
      backupStatus: 'skipped',
      action: 'BACKUP_CLOUD_NOOP',
    });
    return { provider: 'none', skipped: true, message: 'Cloud storage disabled' };
  }
}

export class LocalOnlyCloudBackupAdapter implements CloudBackupAdapter {
  isConfigured(): boolean {
    return true;
  }

  async upload(filePath: string, key: string): Promise<CloudBackupUploadResult> {
    logger.info('Backup kept locally — S3 not configured', {
      filePath,
      key,
      backupStatus: 'local_only',
      action: 'BACKUP_CLOUD_LOCAL_ONLY',
    });
    return {
      provider: 'local',
      skipped: true,
      message: 'Backup saved locally. Configure AWS_S3_BACKUP_BUCKET to enable S3 upload.',
    };
  }
}

export class AwsS3CloudBackupAdapter implements CloudBackupAdapter {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BACKUP_BUCKET || '';
    this.region = process.env.AWS_REGION || 'us-east-1';
  }

  isConfigured(): boolean {
    return Boolean(
      this.bucket &&
        (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) &&
        (process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_PROFILE)
    );
  }

  async upload(filePath: string, key: string): Promise<CloudBackupUploadResult> {
    if (!this.isConfigured()) {
      logger.warn('AWS S3 backup not configured — keeping local file only', {
        filePath,
        key,
        backupStatus: 's3_not_configured',
        action: 'BACKUP_S3_STUB',
      });
      return {
        provider: 'aws-stub',
        skipped: true,
        message:
          'S3 upload placeholder: set AWS_S3_BACKUP_BUCKET, AWS_REGION, and credentials to enable uploads.',
      };
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filePath}`);
    }

    // Placeholder until @aws-sdk/client-s3 is added — log intent without failing the job
    logger.info('S3 backup upload placeholder', {
      bucket: this.bucket,
      region: this.region,
      key,
      fileSize: fs.statSync(filePath).size,
      backupStatus: 's3_placeholder',
      action: 'BACKUP_S3_PLACEHOLDER',
    });

    return {
      provider: 'aws-stub',
      url: `s3://${this.bucket}/${key}`,
      message: 'S3 adapter stub — file retained locally until SDK integration',
    };
  }
}

export function createCloudBackupAdapter(
  storage: 'none' | 'aws' | 'gcp' | 'azure'
): CloudBackupAdapter {
  switch (storage) {
    case 'aws':
      return new AwsS3CloudBackupAdapter();
    case 'gcp':
    case 'azure':
      return new LocalOnlyCloudBackupAdapter();
    case 'none':
    default:
      return new NoopCloudBackupAdapter();
  }
}
