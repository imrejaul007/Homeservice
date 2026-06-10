import mongoose from 'mongoose';
import database from '../config/database';
import Bundle from '../models/bundle.model';
import Tenant from '../models/tenant.model';

async function check() {
  await database.connect();

  const bundles = await Bundle.find({}).limit(3);
  const tenant = await Tenant.findOne({ slug: 'default' });

  console.log('=== DEBUG CHECK ===');
  console.log('Default Tenant ID:', tenant?._id?.toString());
  console.log('');
  console.log('Total Bundles in DB:', await Bundle.countDocuments());
  console.log('');
  console.log('Bundles:');
  bundles.forEach(b => {
    console.log('  Name:', b.name);
    console.log('  tenantId:', b.tenantId?.toString());
    console.log('  isActive:', b.isActive);
    console.log('  services count:', b.services?.length);
    console.log('---');
  });

  // Check with tenant filter
  if (tenant?._id) {
    const filtered = await Bundle.find({ tenantId: tenant._id, isActive: true });
    console.log('');
    console.log('Bundles matching tenantId + isActive:', filtered.length);
  }

  await database.disconnect();
}

check();
