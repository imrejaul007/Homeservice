/**
 * Migration: 002_backpopulate_bundle_services
 *
 * This migration back-populates Bundle.services array with:
 * 1. Actual Service references (serviceId validation)
 * 2. Correct serviceName values from the Service collection
 *
 * Run with: mongosh < backend/src/migrations/002_backpopulate_bundle_services.js
 * Or via mongoose migration system if configured
 */

db = db.getSiblingDB('homeservice');

print('===========================================');
print('Migration: 002_backpopulate_bundle_services');
print('Started at: ' + new Date().toISOString());
print('===========================================');

// ============================================
// Helper function to update a single bundle
// ============================================
function updateBundleServices(bundle) {
  let hasChanges = false;
  const updatedServices = bundle.services.map(service => {
    // Skip if serviceId is null/missing
    if (!service.serviceId) {
      return service;
    }

    // Find the service by ID
    const serviceDoc = db.services.findOne({ _id: service.serviceId });

    if (serviceDoc) {
      // Service found - update serviceName if different
      if (service.serviceName !== serviceDoc.name) {
        service.serviceName = serviceDoc.name;
        hasChanges = true;
      }
    } else {
      // Service not found - log warning
      print(`  Warning: Service ${service.serviceId} not found for bundle ${bundle._id}`);
    }

    return service;
  });

  if (hasChanges) {
    db.bundles.updateOne(
      { _id: bundle._id },
      { $set: { services: updatedServices, updatedAt: new Date() } }
    );
    return true;
  }
  return false;
}

// ============================================
// Count statistics
// ============================================
const totalBundles = db.bundles.countDocuments();
const bundlesWithServices = db.bundles.countDocuments({
  services: { $exists: true, $ne: [] }
});

print(`\n[Statistics]`);
print(`  Total bundles: ${totalBundles}`);
print(`  Bundles with services: ${bundlesWithServices}`);

// ============================================
// Migration: 1/3 - Find and update bundles with missing/invalid serviceName
// ============================================
print('\n[1/3] Finding bundles with services needing back-population...');

const bundlesNeedingUpdate = db.bundles.find({
  services: {
    $exists: true,
    $ne: []
  }
}).toArray();

print(`  Found ${bundlesNeedingUpdate.length} bundles with services to check`);

// ============================================
// Migration: 2/3 - Back-populate serviceName from Service collection
// ============================================
print('\n[2/3] Back-populating serviceName values...');

let updatedCount = 0;
let unchangedCount = 0;
let errorCount = 0;

bundlesNeedingUpdate.forEach(bundle => {
  try {
    const wasUpdated = updateBundleServices(bundle);
    if (wasUpdated) {
      updatedCount++;
    } else {
      unchangedCount++;
    }
  } catch (e) {
    print(`  Error processing bundle ${bundle._id}: ${e.message}`);
    errorCount++;
  }
});

print(`  Updated: ${updatedCount} bundles`);
print(`  Unchanged: ${unchangedCount} bundles`);
print(`  Errors: ${errorCount} bundles`);

// ============================================
// Migration: 3/3 - Validation: Ensure all serviceIds reference valid services
// ============================================
print('\n[3/3] Validating service references...');

const invalidServiceRefs = [];

bundlesNeedingUpdate.forEach(bundle => {
  bundle.services.forEach(service => {
    if (service.serviceId) {
      const serviceDoc = db.services.findOne({ _id: service.serviceId });
      if (!serviceDoc) {
        invalidServiceRefs.push({
          bundleId: bundle._id,
          serviceId: service.serviceId,
          serviceName: service.serviceName
        });
      }
    }
  });
});

if (invalidServiceRefs.length > 0) {
  print(`  Found ${invalidServiceRefs.length} invalid service references:`);
  invalidServiceRefs.forEach(ref => {
    print(`    Bundle: ${ref.bundleId}, Invalid ServiceId: ${ref.serviceId}, serviceName: ${ref.serviceName}`);
  });
} else {
  print('  All service references are valid');
}

// ============================================
// Migration: 4/3 - Create index on services.serviceId if not exists
// ============================================
print('\n[4/3] Ensuring index on services.serviceId...');

try {
  db.bundles.createIndex({ 'services.serviceId': 1 });
  print('  Index on services.serviceId created/verified');
} catch (e) {
  print(`  Index creation: ${e.message}`);
}

// ============================================
// Final Summary
// ============================================
print('\n===========================================');
print('Migration Summary');
print('===========================================');
print(`  Bundles processed: ${bundlesNeedingUpdate.length}`);
print(`  Bundles updated: ${updatedCount}`);
print(`  Bundles unchanged: ${unchangedCount}`);
print(`  Errors: ${errorCount}`);
print(`  Invalid service references: ${invalidServiceRefs.length}`);
print(`  Completed at: ${new Date().toISOString()}`);
print('===========================================');

if (invalidServiceRefs.length > 0) {
  print('\nWARNING: Some bundles have invalid service references!');
  print('These services may have been deleted. Manual review recommended.');
  print('Invalid references have been logged above.');
}

// ============================================
// Rollback note
// ============================================
print('\nNote: To rollback this migration, you would need a backup.');
print('This migration is designed to be idempotent - running it again is safe.');
