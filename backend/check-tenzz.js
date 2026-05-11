const mongoose = require('mongoose');
require('dotenv').config();

async function checkTenzz() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Find Tenzz user by email
    const users = await db.collection('users').find({
      email: 'tenzz@nilin.com'
    }).toArray();

    if (users.length === 0) {
      console.log('Tenzz user NOT FOUND');
      await mongoose.disconnect();
      return;
    }

    const tenzz = users[0];
    console.log('Tenzz user found:');
    console.log('  ID:', tenzz._id.toString());
    console.log('  Name:', tenzz.name);
    console.log('  Email:', tenzz.email);
    console.log('  Role:', tenzz.role);

    // Find Tenzz's services
    const services = await db.collection('services').find({
      providerId: tenzz._id
    }).toArray();

    console.log('\nTenzz services in database:', services.length);
    services.forEach(s => {
      console.log('  -', s.name);
      console.log('    Category:', s.category, '| Subcategory:', s.subcategory);
      console.log('    Status:', s.status, '| isActive:', s.isActive);
    });

    // Check provider profile
    const profile = await db.collection('providerprofiles').findOne({
      userId: tenzz._id
    });

    if (profile) {
      console.log('\nProvider profile found:');
      console.log('  Business:', profile.businessInfo?.businessName);
      console.log('  Tier:', profile.tier);
      console.log('  Verified:', profile.isVerified);
    } else {
      console.log('\nNo provider profile found!');
    }

    await mongoose.disconnect();
    console.log('\nDone');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTenzz();
