import database from '../config/database';
import Bundle from '../models/bundle.model';
import Tenant from '../models/tenant.model';

async function check() {
  await database.connect();

  console.log('Checking bundles...\n');

  const bundles = await Bundle.find({}).limit(5);
  console.log('Total bundles:', bundles.length);

  bundles.forEach((b: any) => {
    console.log(`- ${b.name}`);
    console.log(`  tenantId: ${b.tenantId?.toString()}`);
    console.log(`  isActive: ${b.isActive}`);
    console.log(`  bundlePrice: ${b.bundlePrice}`);
    console.log('');
  });

  const tenant = await Tenant.findOne({ slug: 'default' });
  console.log('Default tenant:', tenant?._id?.toString());

  if (tenant?._id) {
    const withTenant = await Bundle.find({ tenantId: tenant._id, isActive: true });
    console.log('\nBundles with tenantId + isActive:', withTenant.length);
  }

  await database.disconnect();
  process.exit(0);
}

check();
