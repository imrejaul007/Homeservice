/**
 * Check provider verification status (ProviderProfile + User)
 *
 * Usage:
 *   node scripts/check-provider-verification.js
 *   node scripts/check-provider-verification.js <providerUserId>
 *   node scripts/check-provider-verification.js --email provider@example.com
 *   node scripts/check-provider-verification.js --all
 *
 * Requires MONGODB_URI in backend/.env
 */

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const VERIFIED_STATUSES = new Set(['approved', 'verified']);

function canReceiveBookings(profile) {
  if (!profile) return { eligible: false, reason: 'No provider profile' };
  if (profile.isDeleted) return { eligible: false, reason: 'Profile is deleted' };
  if (profile.isActive === false) return { eligible: false, reason: 'Profile is inactive' };
  const overall = profile.verificationStatus?.overall;
  if (overall === 'suspended') return { eligible: false, reason: 'Account suspended' };
  if (!VERIFIED_STATUSES.has(overall)) {
    return { eligible: false, reason: `Verification status is "${overall ?? 'missing'}"` };
  }
  return { eligible: true, reason: 'OK — can receive bookings' };
}

function formatProfileRow(profile, user) {
  const overall = profile.verificationStatus?.overall ?? '(none)';
  const { eligible, reason } = canReceiveBookings(profile);
  const name =
    profile.businessInfo?.businessName ||
    (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '') ||
    '(no name)';

  return {
    userId: profile.userId?.toString(),
    profileId: profile._id?.toString(),
    name,
    email: user?.email ?? '(unknown)',
    verificationOverall: overall,
    identity: profile.verificationStatus?.identity?.status,
    business: profile.verificationStatus?.business?.status,
    isActive: profile.isActive !== false,
    isProfileComplete: profile.isProfileComplete,
    completionPercentage: profile.completionPercentage,
    canBook: eligible ? 'YES' : 'NO',
    bookingNote: reason,
  };
}

async function findUserByEmail(db, email) {
  return db.collection('users').findOne({ email: email.toLowerCase().trim() });
}

async function findProfileByUserId(db, userId) {
  const oid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
  if (!oid) return null;
  return db.collection('providerprofiles').findOne({ userId: oid });
}

async function printOne(db, userIdOrEmail, isEmail) {
  let user = null;
  let userId = userIdOrEmail;

  if (isEmail) {
    user = await findUserByEmail(db, userIdOrEmail);
    if (!user) {
      console.error(`\n❌ No user found with email: ${userIdOrEmail}`);
      process.exit(1);
    }
    userId = user._id.toString();
    console.log(`\n📧 Found user: ${user.email} (${user.role})`);
  } else {
    if (!ObjectId.isValid(userId)) {
      console.error(`\n❌ Invalid provider user id: ${userId}`);
      process.exit(1);
    }
    user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  }

  const profile = await findProfileByUserId(db, userId);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Provider verification check');
  console.log('═══════════════════════════════════════════════════\n');

  if (!user) {
    console.log(`User ${userId}: NOT FOUND in users collection`);
  } else {
    console.log('User');
    console.log('  _id:      ', user._id.toString());
    console.log('  email:    ', user.email);
    console.log('  role:     ', user.role);
    console.log('  status:   ', user.accountStatus ?? user.status ?? '(n/a)');
  }

  if (!profile) {
    console.log('\nProviderProfile: NOT FOUND for this userId');
    console.log('  → Bookings will fail with "Provider profile not found"');
    process.exit(1);
  }

  const row = formatProfileRow(profile, user);
  console.log('\nProviderProfile');
  console.log('  _id:                  ', row.profileId);
  console.log('  userId:               ', row.userId);
  console.log('  business / name:      ', row.name);
  console.log('  verification.overall: ', row.verificationOverall);
  console.log('  identity:             ', row.identity ?? '(n/a)');
  console.log('  business doc:         ', row.business ?? '(n/a)');
  console.log('  isActive:             ', row.isActive);
  console.log('  isProfileComplete:    ', row.isProfileComplete);
  console.log('  completion %:         ', row.completionPercentage ?? '(n/a)');

  console.log('\nBooking eligibility');
  console.log('  Can receive bookings: ', row.canBook);
  console.log('  Note:                 ', row.bookingNote);

  if (row.canBook === 'NO') {
    console.log('\n💡 To allow bookings, set in MongoDB (providerprofiles):');
    console.log('   { "verificationStatus.overall": "approved" }');
    console.log('   Or approve the provider in Admin → Verification queue.');
  }

  console.log('');
}

async function printAll(db, limit = 50) {
  const profiles = await db
    .collection('providerprofiles')
    .find({ isDeleted: { $ne: true } })
    .limit(limit)
    .toArray();

  const userIds = profiles.map((p) => p.userId).filter(Boolean);
  const users = await db
    .collection('users')
    .find({ _id: { $in: userIds } })
    .toArray();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  console.log(`\n📋 Provider profiles (showing up to ${limit}):\n`);
  console.log(
    'userId'.padEnd(26) +
      'verification'.padEnd(14) +
      'canBook'.padEnd(8) +
      'business / email'
  );
  console.log('-'.repeat(90));

  for (const profile of profiles) {
    const user = userMap.get(profile.userId?.toString());
    const row = formatProfileRow(profile, user);
    const label = row.name !== '(no name)' ? row.name : row.email;
    console.log(
      (row.userId || '').padEnd(26) +
        String(row.verificationOverall).padEnd(14) +
        row.canBook.padEnd(8) +
        label
    );
  }

  const eligible = profiles.filter((p) => canReceiveBookings(p).eligible).length;
  console.log(`\n✅ ${eligible} / ${profiles.length} can receive bookings\n`);
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ Set MONGODB_URI in backend/.env');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    console.log('✅ Connected to MongoDB');

    if (args.length === 0 || args[0] === '--all') {
      await printAll(db, args[0] === '--all' ? 200 : 50);
    } else if (args[0] === '--email' && args[1]) {
      await printOne(db, args[1], true);
    } else if (args[0] === '--help' || args[0] === '-h') {
      console.log(`
Usage:
  node scripts/check-provider-verification.js              # summary table (50 providers)
  node scripts/check-provider-verification.js --all        # up to 200 providers
  node scripts/check-provider-verification.js <userId>   # one provider by User _id
  node scripts/check-provider-verification.js --email x@y.com
`);
    } else {
      await printOne(db, args[0], false);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
