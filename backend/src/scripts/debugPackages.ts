import mongoose from 'mongoose';
import database from '../config/database';
import Bundle from '../models/bundle.model';
import Tenant from '../models/tenant.model';
import ProviderProfile from '../models/providerProfile.model';

async function debug() {
  await database.connect();

  const tenant = await Tenant.findOne({ slug: 'default' });
  const tenantId = tenant?._id?.toString();
  console.log('Tenant ID:', tenantId);

  // Check bundles
  console.log('\n=== BUNDLES ===');
  const bundles = await Bundle.find({ tenantId });
  console.log('Bundles with tenantId:', bundles.length);

  // Check bundles without tenant filter
  const allBundles = await Bundle.find({});
  console.log('Total bundles:', allBundles.length);

  // Check what ProviderProfile looks like
  console.log('\n=== PROVIDER PROFILES ===');
  const providers = await ProviderProfile.find({}).limit(3);
  console.log('ProviderProfiles found:', await ProviderProfile.countDocuments());

  if (providers.length > 0) {
    const p = providers[0];
    console.log('Sample ProviderProfile:');
    console.log('  tenantId:', p.tenantId?.toString());
    console.log('  isActive:', p.isActive);
    console.log('  services count:', p.services?.length);
    console.log('  has services.isActive:', p.services?.some((s: any) => s.isActive));
  }

  // Try the exact query from getServicePackages
  console.log('\n=== QUERY TEST ===');
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

  const query = {
    tenantId: tenantObjectId,
    isActive: true,
    'services.isActive': true,
  };

  const queryResult = await ProviderProfile.find(query);
  console.log('ProviderProfile query result:', queryResult.length);

  await database.disconnect();
}

debug();
