import mongoose from 'mongoose';
import User from '../models/user.model';
import ServiceCategory from '../models/serviceCategory.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  connection: {
    readyState: number;
    readyStateName: string;
    host: string;
    name: string;
  };
  collections: {
    name: string;
    count: number;
    indexes: number;
  }[];
  performance: {
    pingTime: number;
    queryTime: number;
  };
  issues: string[];
}

export const checkDatabaseHealth = async (): Promise<HealthCheckResult> => {
  const result: HealthCheckResult = {
    status: 'healthy',
    connection: {
      readyState: mongoose.connection.readyState,
      readyStateName: getReadyStateName(mongoose.connection.readyState),
      host: mongoose.connection.host || 'unknown',
      name: mongoose.connection.name || 'unknown'
    },
    collections: [],
    performance: {
      pingTime: 0,
      queryTime: 0
    },
    issues: []
  };

  try {
    // Check connection status
    if (mongoose.connection.readyState !== 1) {
      result.status = 'critical';
      result.issues.push('Database connection is not active');
      return result;
    }

    // Ping test
    const pingStart = Date.now();
    await mongoose.connection.db?.admin().ping();
    result.performance.pingTime = Date.now() - pingStart;

    if (result.performance.pingTime > 1000) {
      result.status = 'warning';
      result.issues.push(`High ping time: ${result.performance.pingTime}ms`);
    }

    // Query performance test
    const queryStart = Date.now();
    await User.findOne().limit(1);
    result.performance.queryTime = Date.now() - queryStart;

    if (result.performance.queryTime > 500) {
      result.status = 'warning';
      result.issues.push(`Slow query performance: ${result.performance.queryTime}ms`);
    }

    // Check collections
    const models = [
      { name: 'users', model: User },
      { name: 'customerprofiles', model: CustomerProfile },
      { name: 'providerprofiles', model: ProviderProfile },
      { name: 'servicecategories', model: ServiceCategory }
    ];

    for (const { name, model } of models) {
      try {
        const count = await model.countDocuments();
        const indexes = await model.collection.listIndexes().toArray();
        
        result.collections.push({
          name,
          count,
          indexes: indexes.length
        });

        // Check for critical collections
        if (name === 'servicecategories' && count === 0) {
          result.status = 'warning';
          result.issues.push('No service categories found - database may not be seeded');
        }

        // Check for proper indexing
        if (name === 'users' && indexes.length < 3) {
          result.status = 'warning';
          result.issues.push(`User collection has insufficient indexes (${indexes.length})`);
        }

      } catch (error) {
        result.status = 'critical';
        result.issues.push(`Failed to check collection ${name}: ${(error as Error).message}`);
      }
    }

    // Check database size and memory usage
    try {
      const stats = await mongoose.connection.db?.stats();
      if (stats) {
        const sizeInMB = stats.dataSize / (1024 * 1024);
        
        if (sizeInMB > 1000) { // More than 1GB
          result.status = 'warning';
          result.issues.push(`Large database size: ${sizeInMB.toFixed(2)}MB`);
        }
      }

    } catch (error) {
      result.issues.push(`Could not retrieve database stats: ${(error as Error).message}`);
    }

  } catch (error) {
    result.status = 'critical';
    result.issues.push(`Health check failed: ${(error as Error).message}`);
  }

  return result;
};

export const validateDataIntegrity = async (): Promise<{
  status: 'valid' | 'issues';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail';
    message: string;
  }>;
}> => {
  const checks = [];

  try {
    // Check for orphaned customer profiles
    const customerProfilesCount = await CustomerProfile.countDocuments();
    const customersCount = await User.countDocuments({ role: 'customer' });
    
    if (customerProfilesCount > customersCount) {
      checks.push({
        name: 'Customer Profile Integrity',
        status: 'fail' as const,
        message: `Found ${customerProfilesCount - customersCount} orphaned customer profiles`
      });
    } else {
      checks.push({
        name: 'Customer Profile Integrity',
        status: 'pass' as const,
        message: 'All customer profiles have corresponding users'
      });
    }

    // Check for orphaned provider profiles
    const providerProfilesCount = await ProviderProfile.countDocuments();
    const providersCount = await User.countDocuments({ role: 'provider' });
    
    if (providerProfilesCount > providersCount) {
      checks.push({
        name: 'Provider Profile Integrity',
        status: 'fail' as const,
        message: `Found ${providerProfilesCount - providersCount} orphaned provider profiles`
      });
    } else {
      checks.push({
        name: 'Provider Profile Integrity',
        status: 'pass' as const,
        message: 'All provider profiles have corresponding users'
      });
    }

    // Check for users without profiles
    const usersWithoutCustomerProfiles = await User.countDocuments({
      role: 'customer',
      _id: { 
        $nin: await CustomerProfile.distinct('userId') 
      }
    });

    if (usersWithoutCustomerProfiles > 0) {
      checks.push({
        name: 'Customer Users Without Profiles',
        status: 'fail' as const,
        message: `Found ${usersWithoutCustomerProfiles} customer users without profiles`
      });
    } else {
      checks.push({
        name: 'Customer Users Without Profiles',
        status: 'pass' as const,
        message: 'All customer users have profiles'
      });
    }

    const usersWithoutProviderProfiles = await User.countDocuments({
      role: 'provider',
      _id: { 
        $nin: await ProviderProfile.distinct('userId') 
      }
    });

    if (usersWithoutProviderProfiles > 0) {
      checks.push({
        name: 'Provider Users Without Profiles',
        status: 'fail' as const,
        message: `Found ${usersWithoutProviderProfiles} provider users without profiles`
      });
    } else {
      checks.push({
        name: 'Provider Users Without Profiles',
        status: 'pass' as const,
        message: 'All provider users have profiles'
      });
    }

    // Check for admin user
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      checks.push({
        name: 'Admin User Exists',
        status: 'fail' as const,
        message: 'No admin users found'
      });
    } else {
      checks.push({
        name: 'Admin User Exists',
        status: 'pass' as const,
        message: `Found ${adminCount} admin user(s)`
      });
    }

    // Check for service categories
    const categoryCount = await ServiceCategory.countDocuments();
    if (categoryCount === 0) {
      checks.push({
        name: 'Service Categories',
        status: 'fail' as const,
        message: 'No service categories found - run seeder'
      });
    } else {
      checks.push({
        name: 'Service Categories',
        status: 'pass' as const,
        message: `Found ${categoryCount} service categories`
      });
    }

  } catch (error) {
    checks.push({
      name: 'Data Integrity Check',
      status: 'fail' as const,
      message: `Failed to run integrity checks: ${(error as Error).message}`
    });
  }

  const hasIssues = checks.some(check => check.status === 'fail');

  return {
    status: hasIssues ? 'issues' : 'valid',
    checks
  };
};

export const getDatabaseStats = async () => {
  try {
    const [
      totalUsers,
      totalCustomers,
      totalProviders, 
      totalAdmins,
      totalCategories,
      verifiedUsers,
      activeUsers,
      dbStats
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'provider' }),
      User.countDocuments({ role: 'admin' }),
      ServiceCategory.countDocuments(),
      User.countDocuments({ isEmailVerified: true }),
      User.countDocuments({ accountStatus: 'active' }),
      mongoose.connection.db?.stats()
    ]);

    return {
      users: {
        total: totalUsers,
        customers: totalCustomers,
        providers: totalProviders,
        admins: totalAdmins,
        verified: verifiedUsers,
        active: activeUsers
      },
      categories: totalCategories,
      database: {
        sizeInBytes: dbStats?.dataSize || 0,
        sizeInMB: dbStats ? (dbStats.dataSize / (1024 * 1024)).toFixed(2) : '0',
        collections: dbStats?.collections || 0,
        indexes: dbStats?.indexes || 0,
        avgObjSize: dbStats?.avgObjSize || 0
      }
    };
  } catch (error) {
    throw new Error(`Failed to get database stats: ${(error as Error).message}`);
  }
};

function getReadyStateName(state: number): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[state] || 'unknown';
}