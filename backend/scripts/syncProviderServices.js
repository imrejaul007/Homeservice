const { MongoClient } = require('mongodb');
require('dotenv').config();

async function syncProviderServices() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/rezz');
  
  try {
    await client.connect();
    const db = client.db();
    
    const providersCollection = db.collection('providerprofiles');
    const servicesCollection = db.collection('services');
    
    // Get all approved providers with services
    const approvedProviders = await providersCollection.find({
      'verificationStatus.overall': 'approved',
      'services': { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`\n🔄 Syncing services for ${approvedProviders.length} approved providers...`);
    
    let totalCreated = 0;
    let totalSkipped = 0;
    
    for (const provider of approvedProviders) {
      console.log(`\n👔 Processing: ${provider.businessInfo.businessName}`);
      
      for (const service of provider.services) {
        // Check if service already exists
        const existingService = await servicesCollection.findOne({
          providerId: provider.userId,
          name: service.name
        });
        
        if (!existingService) {
          // Create new service document
          const newService = {
            providerId: provider.userId,
            name: service.name,
            category: service.category,
            subcategory: service.subcategory || '',
            description: service.description,
            shortDescription: service.description ? service.description.substring(0, 100) : '',
            
            price: {
              amount: service.price?.amount || 0,
              currency: service.price?.currency || 'USD',
              type: service.price?.type || 'fixed',
              discounts: service.price?.discounts || []
            },
            
            duration: service.duration || 60,
            images: service.images || [],
            tags: service.tags || [],
            requirements: service.requirements || [],
            includedItems: service.includedItems || [],
            addOns: service.addOns || [],
            
            location: {
              address: {
                street: provider.locationInfo?.primaryAddress?.street || '',
                city: provider.locationInfo?.primaryAddress?.city || '',
                state: provider.locationInfo?.primaryAddress?.state || '',
                zipCode: provider.locationInfo?.primaryAddress?.zipCode || '',
                country: provider.locationInfo?.primaryAddress?.country || 'US'
              },
              coordinates: {
                type: 'Point',
                coordinates: [
                  provider.locationInfo?.primaryAddress?.coordinates?.lng || -74.006,
                  provider.locationInfo?.primaryAddress?.coordinates?.lat || 40.7128
                ]
              },
              serviceArea: {
                type: 'radius',
                value: provider.businessInfo?.serviceRadius || 25,
                maxDistance: provider.businessInfo?.serviceRadius || 25
              },
              travelFee: {
                baseFee: 0,
                perKmFee: 0
              }
            },
            
            availability: {
              schedule: {
                monday: { isAvailable: true, timeSlots: [] },
                tuesday: { isAvailable: true, timeSlots: [] },
                wednesday: { isAvailable: true, timeSlots: [] },
                thursday: { isAvailable: true, timeSlots: [] },
                friday: { isAvailable: true, timeSlots: [] },
                saturday: { isAvailable: true, timeSlots: [] },
                sunday: { isAvailable: false, timeSlots: [] }
              },
              exceptions: [],
              bufferTime: 15,
              instantBooking: false,
              advanceBookingDays: 30
            },
            
            rating: {
              average: 0,
              count: 0,
              distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
            },
            
            isActive: service.isActive !== false,
            isFeatured: false,
            isPopular: false,
            
            searchMetadata: {
              searchCount: 0,
              clickCount: 0,
              bookingCount: 0,
              popularityScore: 0,
              searchKeywords: [service.name.toLowerCase(), service.category.toLowerCase()].concat(service.tags || [])
            },
            
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await servicesCollection.insertOne(newService);
          console.log(`  ✅ Created: ${service.name} ($${service.price?.amount}) - ${service.category}`);
          totalCreated++;
        } else {
          console.log(`  ⏭️  Skipped: ${service.name} (already exists)`);
          totalSkipped++;
        }
      }
    }
    
    console.log(`\n✨ Sync Complete!`);
    console.log(`   Created: ${totalCreated} services`);
    console.log(`   Skipped: ${totalSkipped} services`);
    
    // Verify final count
    const totalServices = await servicesCollection.countDocuments();
    console.log(`\n📊 Total services in database: ${totalServices}`);
    
  } catch (error) {
    console.error('❌ Error syncing services:', error);
  } finally {
    await client.close();
  }
}

syncProviderServices();