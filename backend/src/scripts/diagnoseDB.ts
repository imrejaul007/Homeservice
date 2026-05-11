import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function diagnose() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) { console.error('No MONGODB_URI'); process.exit(1); }
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  console.log('========== PROVIDER USERS ==========');
  const providerUsers = await db.collection('users').find({ role: 'provider' }).toArray();
  console.log('Total provider users:', providerUsers.length);
  for (const u of providerUsers) {
    console.log(`  ${u._id} | ${u.name} | ${u.email} | active: ${u.isActive}`);
  }

  console.log('\n========== PROVIDER PROFILES ==========');
  const profiles = await db.collection('providerprofiles').find({}).toArray();
  console.log('Total provider profiles:', profiles.length);
  for (const p of profiles) {
    console.log(`  profileId: ${p._id}`);
    console.log(`    userId: ${p.userId}`);
    console.log(`    businessName: ${p.businessName}`);
    console.log(`    specializations: ${JSON.stringify(p.specializations)}`);
    console.log(`    services: ${p.services?.length || 0}`);
    console.log(`    city: ${p.locationInfo?.primaryAddress?.city}, country: ${p.locationInfo?.primaryAddress?.country}`);
    console.log(`    verified: ${p.isVerified}, status: ${p.status}`);
  }

  console.log('\n========== SERVICES (grouped by subcategory) ==========');
  const services = await db.collection('services').find({}).toArray();
  console.log('Total services:', services.length);
  const bySubcat: Record<string, any[]> = {};
  for (const s of services) {
    const sub = s.subcategory || 'unknown';
    if (!bySubcat[sub]) bySubcat[sub] = [];
    bySubcat[sub].push(s);
  }
  for (const [sub, svcs] of Object.entries(bySubcat)) {
    console.log(`\n  ${sub} (${svcs.length} services):`);
    for (const s of svcs) {
      console.log(`    - ${s.name} | AED ${s.price?.amount} | providerId: ${s.providerId}`);
    }
  }

  console.log('\n========== PROVIDER ID VALIDATION ==========');
  const profileIdSet = new Set(profiles.map(p => p._id.toString()));
  const userIdSet = new Set([...providerUsers.map(u => u._id.toString()), ...profiles.map(p => p.userId?.toString()).filter(Boolean)]);
  const allValidIds = new Set([...profileIdSet, ...userIdSet]);
  let orphaned = 0;
  for (const s of services) {
    if (!allValidIds.has(s.providerId?.toString())) orphaned++;
  }
  console.log(`Valid: ${services.length - orphaned}, Orphaned: ${orphaned}`);

  console.log('\n========== BEAUTY & WELLNESS SUBCATEGORIES ==========');
  const bwCat = await db.collection('servicecategories').findOne({ slug: 'beauty-wellness' });
  for (const sc of (bwCat?.subcategories || [])) {
    console.log(`  - ${sc.name} (slug: ${sc.slug})`);
  }

  console.log('\n========== CUSTOMER USERS ==========');
  const customers = await db.collection('users').find({ role: 'customer' }).toArray();
  console.log('Total:', customers.length);
  for (const u of customers) console.log(`  - ${u.name} | ${u.email}`);

  console.log('\n========== ADMIN USERS ==========');
  const admins = await db.collection('users').find({ role: 'admin' }).toArray();
  console.log('Total:', admins.length);
  for (const u of admins) console.log(`  - ${u.name} | ${u.email}`);

  await mongoose.disconnect();
}
diagnose().catch(e => { console.error(e); process.exit(1); });
