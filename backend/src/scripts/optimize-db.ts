import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

// Import all models to register them
import User from '../models/user.model';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import ProviderProfile from '../models/providerProfile.model';
import CustomerProfile from '../models/customerProfile.model';
import Availability from '../models/availability.model';
import AuditLog from '../models/auditLog.model';

interface IndexInfo {
  collection: string;
  indexes: Array<{
    name: string;
    key: Record<string, number | string>;
    background?: boolean;
  }>;
  total: number;
}

interface OptimizationResult {
  success: boolean;
  analyzed: IndexInfo[];
  created: string[];
  removed: string[];
  recommendations: string[];
}

const ANALYZED_COLLECTIONS = [
  'users',
  'bookings',
  'services',
  'servicecategories',
  'providerprofiles',
  'customerprofiles',
  'availabilities',
  'bookingnotifications',
  'auditlogs',
];

const analyzeIndexes = async (): Promise<IndexInfo[]> => {
  const results: IndexInfo[] = [];

  for (const collectionName of ANALYZED_COLLECTIONS) {
    try {
      const db = mongoose.connection.db;
      if (!db) continue;

      const collection = db.collection(collectionName);
      const indexes = await collection.indexes();

      results.push({
        collection: collectionName,
        indexes: indexes.map((idx) => ({
          name: idx.name || 'unknown',
          key: idx.key as Record<string, number | string>,
          background: true,
        })),
        total: indexes.length,
      });

      console.log(`[${collectionName}] Found ${indexes.length} indexes`);
    } catch (error) {
      console.warn(`[${collectionName}] Could not analyze indexes:`, error);
    }
  }

  return results;
};

const createOptimizedIndexes = async (): Promise<string[]> => {
  const created: string[] = [];

  console.log('\n📊 Creating optimized indexes...\n');

  // User indexes
  try {
    await User.collection.createIndex({ email: 1 }, { unique: true, background: true });
    created.push('users.email_unique');

    await User.collection.createIndex(
      { role: 1, createdAt: -1 },
      { background: true }
    );
    created.push('users.role_createdAt');

    await User.collection.createIndex(
      { 'loyaltySystem.referralCode': 1 },
      { sparse: true, background: true }
    );
    created.push('users.referralCode_sparse');
  } catch (error) {
    console.warn('Users indexes already exist or error:', error);
  }

  // Booking indexes
  try {
    await Booking.collection.createIndex(
      { bookingNumber: 1 },
      { unique: true, background: true }
    );
    created.push('bookings.bookingNumber_unique');

    await Booking.collection.createIndex(
      { customerId: 1, status: 1, scheduledDate: -1 },
      { background: true }
    );
    created.push('bookings.customer_status_date');

    await Booking.collection.createIndex(
      { providerId: 1, status: 1, scheduledDate: -1 },
      { background: true }
    );
    created.push('bookings.provider_status_date');

    await Booking.collection.createIndex(
      { status: 1, scheduledDate: 1 },
      { background: true }
    );
    created.push('bookings.status_date');

    await Booking.collection.createIndex(
      { 'payment.transactionId': 1 },
      { sparse: true, background: true }
    );
    created.push('bookings.paymentTransactionId_sparse');
  } catch (error) {
    console.warn('Bookings indexes already exist or error:', error);
  }

  // Service indexes
  try {
    await Service.collection.createIndex(
      { providerId: 1, isActive: 1 },
      { background: true }
    );
    created.push('services.provider_active');

    await Service.collection.createIndex(
      { category: 1, isActive: 1, isFeatured: -1 },
      { background: true }
    );
    created.push('services.category_active_featured');

    await Service.collection.createIndex(
      { title: 'text', description: 'text' },
      { background: true }
    );
    created.push('services.text_search');

    await Service.collection.createIndex(
      { isFeatured: 1, 'rating.average': -1 },
      { background: true }
    );
    created.push('services.featured_rating');
  } catch (error) {
    console.warn('Services indexes already exist or error:', error);
  }

  // ServiceCategory indexes
  try {
    await ServiceCategory.collection.createIndex(
      { slug: 1 },
      { unique: true, background: true }
    );
    created.push('servicecategories.slug_unique');

    await ServiceCategory.collection.createIndex(
      { isActive: 1, displayOrder: 1 },
      { background: true }
    );
    created.push('servicecategories.active_order');
  } catch (error) {
    console.warn('ServiceCategory indexes already exist or error:', error);
  }

  // ProviderProfile indexes
  try {
    await ProviderProfile.collection.createIndex(
      { userId: 1 },
      { unique: true, background: true }
    );
    created.push('providerprofiles.userId_unique');

    await ProviderProfile.collection.createIndex(
      { verificationStatus: 1, createdAt: -1 },
      { background: true }
    );
    created.push('providerprofiles.verification_status');
  } catch (error) {
    console.warn('ProviderProfile indexes already exist or error:', error);
  }

  // CustomerProfile indexes
  try {
    await CustomerProfile.collection.createIndex(
      { userId: 1 },
      { unique: true, background: true }
    );
    created.push('customerprofiles.userId_unique');
  } catch (error) {
    console.warn('CustomerProfile indexes already exist or error:', error);
  }

  // Availability indexes
  try {
    await Availability.collection.createIndex(
      { providerId: 1, date: 1 },
      { background: true }
    );
    created.push('availabilities.provider_date');

    await Availability.collection.createIndex(
      { providerId: 1, isBlocked: 1 },
      { background: true }
    );
    created.push('availabilities.provider_blocked');
  } catch (error) {
    console.warn('Availability indexes already exist or error:', error);
  }

  // AuditLog indexes
  try {
    await AuditLog.collection.createIndex(
      { userId: 1, createdAt: -1 },
      { background: true }
    );
    created.push('auditlogs.userId_date');

    await AuditLog.collection.createIndex(
      { resource: 1, action: 1, createdAt: -1 },
      { background: true }
    );
    created.push('auditlogs.resource_action_date');
  } catch (error) {
    console.warn('AuditLog indexes already exist or error:', error);
  }

  return created;
};

const getRecommendations = (): string[] => {
  return [
    'Enable MongoDB Atlas Data API for backup automation',
    'Set up MongoDB Atlas monitoring alerts',
    'Configure Atlas Search for advanced text search',
    'Consider read preference for analytics queries',
    'Use Change Streams for real-time updates instead of polling',
  ];
};

const optimizeDatabase = async (): Promise<OptimizationResult> => {
  console.log('🔍 Starting database optimization...\n');

  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Analyze existing indexes
    console.log('📊 Analyzing existing indexes...\n');
    const analyzed = await analyzeIndexes();

    // Create optimized indexes
    console.log('\n');
    const created = await createOptimizedIndexes();

    // Generate recommendations
    const recommendations = getRecommendations();

    console.log('\n📋 Recommendations:\n');
    recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });

    console.log('\n✅ Database optimization complete!\n');
    console.log(`   Created ${created.length} new indexes`);
    console.log(`   Analyzed ${analyzed.length} collections`);

    return {
      success: true,
      analyzed,
      created,
      removed: [],
      recommendations,
    };
  } catch (error: any) {
    console.error('❌ Database optimization failed:', error.message);
    return {
      success: false,
      analyzed: [],
      created: [],
      removed: [],
      recommendations: [],
    };
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// Run if executed directly
if (require.main === module) {
  optimizeDatabase()
    .then((result) => {
      console.log('\nResult:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default optimizeDatabase;
