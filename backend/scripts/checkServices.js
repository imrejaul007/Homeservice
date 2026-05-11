const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkServices() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz');
  
  try {
    await client.connect();
    const db = client.db();
    
    // Check Services collection
    const servicesCollection = db.collection('services');
    const servicesCount = await servicesCollection.countDocuments();
    console.log(`\n📊 Services Collection: ${servicesCount} documents`);
    
    if (servicesCount > 0) {
      const services = await servicesCollection.find({}).limit(5).toArray();
      console.log('Sample services:', services.map(s => `- ${s.name} (${s.category}) by ${s.providerId}`));
    } else {
      console.log('❌ No services found in Services collection');
    }

    // Check approved providers with services
    const providersCollection = db.collection('providerprofiles');
    const approvedProviders = await providersCollection.find({
      'verificationStatus.overall': 'approved',
      'services': { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`\n👔 Approved Providers with services: ${approvedProviders.length}`);
    
    approvedProviders.forEach(provider => {
      console.log(`- ${provider.businessInfo.businessName}: ${provider.services.length} services`);
      provider.services.forEach(service => {
        console.log(`  • ${service.name} ($${service.price.amount}) - ${service.category}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkServices();