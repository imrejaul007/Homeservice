const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('=== COLLECTIONS IN DATABASE ===');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log('  ' + col.name + ': ' + count + ' documents');
    }

    // Check services
    console.log('\n=== SERVICES DATA ===');
    const services = await db.collection('services').find({}).toArray();
    console.log('Total services: ' + services.length);
    if (services.length > 0) {
      console.log('Sample service:');
      console.log(JSON.stringify(services[0], null, 2));

      // Get unique categories
      const categories = [...new Set(services.map(s => s.category))];
      console.log('\nUnique categories in services:', categories);
    }

    // Check servicecategories
    console.log('\n=== SERVICE CATEGORIES DATA ===');
    const serviceCategories = await db.collection('servicecategories').find({}).toArray();
    console.log('Total service categories: ' + serviceCategories.length);
    if (serviceCategories.length > 0) {
      console.log('Categories:');
      serviceCategories.forEach(cat => {
        const subCount = cat.subcategories ? cat.subcategories.length : 0;
        console.log('  - ' + cat.name + ' (' + subCount + ' subcategories)');
      });
    }

    // Check users
    console.log('\n=== USERS DATA ===');
    const users = await db.collection('users').find({}).toArray();
    console.log('Total users: ' + users.length);
    const roles = {};
    users.forEach(u => {
      roles[u.role] = (roles[u.role] || 0) + 1;
    });
    console.log('By role:', roles);

    // Check provider profiles
    console.log('\n=== PROVIDER PROFILES ===');
    const providers = await db.collection('providerprofiles').find({}).toArray();
    console.log('Total provider profiles: ' + providers.length);

    // Check bookings
    console.log('\n=== BOOKINGS ===');
    const bookings = await db.collection('bookings').find({}).toArray();
    console.log('Total bookings: ' + bookings.length);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
