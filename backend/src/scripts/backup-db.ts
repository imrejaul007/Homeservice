import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

interface BackupResult {
  success: boolean;
  timestamp: string;
  collections: string[];
  filePath?: string;
  fileSize?: number;
  error?: string;
}

const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const getCollections = async (): Promise<string[]> => {
  const db = mongoose.connection.db;
  if (!db) return [];

  const collections = await db.listCollections().toArray();
  return collections.map((c) => c.name);
};

const backupCollection = async (collectionName: string): Promise<unknown[]> => {
  const collection = mongoose.connection.collection(collectionName);
  const documents = await collection.find({}).toArray();
  return documents;
};

const backupDatabase = async (): Promise<BackupResult> => {
  console.log('🔄 Starting database backup...\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);

  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all collections
    const collections = await getCollections();
    console.log(`📦 Found ${collections.length} collections to backup\n`);

    const backupData: Record<string, unknown[]> = {};
    let totalDocuments = 0;

    // Backup each collection
    for (const collectionName of collections) {
      // Skip system collections
      if (collectionName.startsWith('system.')) continue;

      console.log(`   Backing up: ${collectionName}`);
      const documents = await backupCollection(collectionName);
      backupData[collectionName] = documents;
      totalDocuments += documents.length;
    }

    // Write backup file
    const backupContent = {
      version: '1.0',
      timestamp,
      collections: Object.keys(backupData),
      totalDocuments,
      data: backupData,
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupContent, null, 2));

    const stats = fs.statSync(backupFile);

    console.log(`\n✅ Backup complete!`);
    console.log(`   Collections: ${collections.length}`);
    console.log(`   Documents: ${totalDocuments}`);
    console.log(`   File: ${backupFile}`);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    return {
      success: true,
      timestamp,
      collections,
      filePath: backupFile,
      fileSize: stats.size,
    };
  } catch (error: any) {
    console.error('❌ Backup failed:', error.message);
    return {
      success: false,
      timestamp,
      collections: [],
      error: error.message,
    };
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

const listBackups = (): { name: string; size: number; date: Date }[] => {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        name: f,
        size: stats.size,
        date: stats.birthtime,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
};

const restoreDatabase = async (backupFile: string): Promise<boolean> => {
  console.log(`🔄 Restoring database from: ${backupFile}\n`);

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Read backup file
    const content = fs.readFileSync(backupFile, 'utf-8');
    const backupData = JSON.parse(content);

    console.log(`📦 Backup version: ${backupData.version}`);
    console.log(`📅 Backup date: ${backupData.timestamp}`);
    console.log(`📊 Collections: ${backupData.collections.length}\n`);

    // Restore each collection
    for (const [collectionName, documents] of Object.entries(backupData.data)) {
      console.log(`   Restoring: ${collectionName}`);

      const collection = mongoose.connection.collection(collectionName);

      // Clear existing data
      await collection.deleteMany({});

      // Insert backup data
      if (Array.isArray(documents) && documents.length > 0) {
        // Convert dates back to Date objects
        const processedDocs = documents.map((doc: any) => {
          for (const [key, value] of Object.entries(doc)) {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
              doc[key] = new Date(value);
            }
          }
          return doc;
        });

        await collection.insertMany(processedDocs);
      }
    }

    console.log(`\n✅ Restore complete!`);

    return true;
  } catch (error: any) {
    console.error('❌ Restore failed:', error.message);
    return false;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// CLI handling
const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0] || 'backup';

  switch (command) {
    case 'backup':
      await backupDatabase();
      break;
    case 'list':
      const backups = listBackups();
      console.log('\n📁 Available backups:\n');
      backups.forEach((b, i) => {
        console.log(
          `  ${i + 1}. ${b.name} (${(b.size / 1024 / 1024).toFixed(2)} MB) - ${b.date.toLocaleString()}`
        );
      });
      break;
    case 'restore':
      if (!args[1]) {
        console.error('❌ Please specify backup file: npm run db:restore backup-xxx.json');
        process.exit(1);
      }
      const restorePath = path.join(BACKUP_DIR, args[1]);
      if (!fs.existsSync(restorePath)) {
        console.error(`❌ Backup file not found: ${restorePath}`);
        process.exit(1);
      }
      await restoreDatabase(restorePath);
      break;
    default:
      console.log('Usage:');
      console.log('  npm run db:backup       - Create backup');
      console.log('  npm run db:backup:list  - List backups');
      console.log('  npm run db:restore <file> - Restore from backup');
  }
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { backupDatabase, restoreDatabase, listBackups };
