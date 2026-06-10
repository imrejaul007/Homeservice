/**
 * Migration Script: Add tenantId to existing bundles
 *
 * This script adds tenantId to bundles that were created without it.
 * Run with: npx ts-node src/scripts/migrateBundleTenantId.ts
 */

import mongoose from 'mongoose';
import database from '../config/database';
import Bundle from '../models/bundle.model';
import Tenant from '../models/tenant.model';
import logger from '../utils/logger';

async function migrate() {
  try {
    await database.connect();
    console.log('Connected to database');

    // Get the default tenant
    const tenant = await Tenant.findOne({ slug: 'default', isActive: true });
    const tenantId = tenant?._id;

    if (!tenantId) {
      console.error('No default tenant found! Please run tenant seeder first.');
      await database.disconnect();
      process.exit(1);
    }

    console.log(`Using tenant: ${tenant?.name} (${tenantId})`);

    // Find bundles without tenantId
    const bundlesWithoutTenant = await Bundle.find({ tenantId: { $exists: false } });
    console.log(`Found ${bundlesWithoutTenant.length} bundles without tenantId`);

    if (bundlesWithoutTenant.length === 0) {
      console.log('No bundles need migration');
    } else {
      // Update bundles to add tenantId
      const result = await Bundle.updateMany(
        { tenantId: { $exists: false } },
        { $set: { tenantId: tenantId } }
      );

      console.log(`Updated ${result.modifiedCount} bundles with tenantId`);
    }

    // Verify the migration
    const bundlesAfter = await Bundle.countDocuments({ tenantId: { $exists: false } });
    console.log(`Bundles still without tenantId: ${bundlesAfter}`);

    await database.disconnect();
    console.log('Migration complete!');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    await database.disconnect();
    process.exit(1);
  }
}

migrate();
