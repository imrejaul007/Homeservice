import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import Database from '../config/database';

/**
 * Migration Script: Extract Services from ProviderProfile to Standalone Service Model
 *
 * This script:
 * 1. Reads all provider profiles with services
 * 2. Creates new Service documents for each service using bulk insert
 * 3. Maintains references between providers and services
 * 4. Preserves all existing service data
 * 5. Handles location data from provider profile
 */

const CHUNK_SIZE = 1000; // Bulk insert chunk size

interface MigrationStats {
  totalProviders: number;
  providersWithServices: number;
  totalServices: number;
  successfulMigrations: number;
  failedMigrations: number;
  errors: Array<{
    providerId: string;
    serviceIndex: number;
    error: string;
  }>;
}

class ServiceMigration {
  private stats: MigrationStats = {
    totalProviders: 0,
    providersWithServices: 0,
    totalServices: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    errors: []
  };

  async run(): Promise<void> {
    try {
      console.log('Starting Service Migration...');
      console.log('=====================================');

      // Connect to database
      await Database.connect();

      // Check if services already exist (prevent duplicate migration)
      const existingServices = await Service.countDocuments();
      if (existingServices > 0) {
        console.log(`Warning: ${existingServices} services already exist in the database.`);
        console.log('This might be a duplicate migration. Continue? (y/N)');
        // In production, you'd want user input here
        // For now, we'll proceed but with caution
      }

      // Start migration
      await this.migrateServices();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      await Database.disconnect();
    }
  }

  private async migrateServices(): Promise<void> {
    // Get all provider profiles with services
    const providers = await ProviderProfile.find({
      services: { $exists: true, $not: { $size: 0 } } }
    );

    this.stats.totalProviders = await ProviderProfile.countDocuments();
    this.stats.providersWithServices = providers.length;

    console.log(`Found ${providers.length} providers with services to migrate`);

    // Collect all services to be migrated
    const allServicesData: any[] = [];

    for (const provider of providers) {
      console.log(`\nPreparing services for provider: ${provider._id}`);

      for (let i = 0; i < provider.services.length; i++) {
        const service = provider.services[i];
        this.stats.totalServices++;

        try {
          const serviceData = this.prepareServiceData(provider, service);
          allServicesData.push(serviceData);
          console.log(`  Prepared service: ${service.name}`);
        } catch (error: any) {
          this.stats.failedMigrations++;
          this.stats.errors.push({
            providerId: provider._id.toString(),
            serviceIndex: i,
            error: error.message
          });
          console.log(`  Failed to prepare service: ${service.name} - ${error.message}`);
        }
      }
    }

    // Bulk insert services in chunks with transaction
    console.log('\nBulk inserting services in chunks...');
    await this.bulkInsertServices(allServicesData);
  }

  private prepareServiceData(provider: any, service: any): any {
    // Prepare location data from provider profile
    const location = this.prepareLocationData(provider);

    // Prepare service data
    return {
      providerId: provider.userId,

      // Basic service information
      name: service.name,
      category: service.category,
      subcategory: service.subcategory,
      description: service.description,
      shortDescription: service.description?.substring(0, 200), // Create short description

      // Pricing information
      price: {
        amount: service.price?.amount || 0,
        currency: service.price?.currency || 'USD',
        type: service.price?.type || 'fixed',
        discounts: service.price?.discounts || []
      },

      // Service details
      duration: service.duration || 60,
      images: service.images || [],
      tags: service.tags || [],
      requirements: service.requirements || [],
      includedItems: service.includedItems || [],
      addOns: service.addOns || [],

      // Location data (from provider profile)
      location,

      // Service settings (default availability)
      availability: this.createDefaultAvailability(provider),

      // Performance metrics (initialize with defaults)
      rating: {
        average: 0,
        count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      },

      // Search metadata (initialize)
      searchMetadata: {
        searchCount: 0,
        clickCount: 0,
        bookingCount: 0,
        popularityScore: 0,
        searchKeywords: []
      },

      // Business logic
      isActive: service.isActive !== undefined ? service.isActive : true,
      isFeatured: false,
      isPopular: service.isPopular || false,

      // Preserve timestamps if they exist
      createdAt: service.createdAt || new Date(),
      updatedAt: service.updatedAt || new Date()
    };
  }

  private async bulkInsertServices(servicesData: any[]): Promise<void> {
    const totalChunks = Math.ceil(servicesData.length / CHUNK_SIZE);
    console.log(`Inserting ${servicesData.length} services in ${totalChunks} chunks of ${CHUNK_SIZE}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (let i = 0; i < servicesData.length; i += CHUNK_SIZE) {
        const chunk = servicesData.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;

        try {
          const result = await Service.insertMany(chunk, {
            session,
            ordered: false // Continue inserting even if some fail
          });

          this.stats.successfulMigrations += result.length;
          console.log(`  Chunk ${chunkIndex}/${totalChunks}: Inserted ${result.length} services`);
        } catch (error: any) {
          // Handle partial failures
          if (error.writeErrors) {
            const successCount = chunk.length - error.writeErrors.length;
            this.stats.successfulMigrations += successCount;
            console.log(`  Chunk ${chunkIndex}/${totalChunks}: Inserted ${successCount} services, ${error.writeErrors.length} failed`);
          } else {
            this.stats.failedMigrations += chunk.length;
            console.log(`  Chunk ${chunkIndex}/${totalChunks}: All ${chunk.length} services failed - ${error.message}`);
          }
        }
      }

      await session.commitTransaction();
      console.log('\nBulk insert completed successfully');
    } catch (error) {
      await session.abortTransaction();
      console.error('Bulk insert transaction failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  private prepareLocationData(provider: any): any {
    const primaryAddress = provider.locationInfo?.primaryAddress;

    if (!primaryAddress) {
      throw new Error('Provider has no primary address');
    }

    return {
      address: {
        street: primaryAddress.street,
        city: primaryAddress.city,
        state: primaryAddress.state,
        zipCode: primaryAddress.zipCode,
        country: primaryAddress.country || 'US'
      },
      coordinates: {
        type: 'Point',
        coordinates: [
          primaryAddress.coordinates?.lng || -74.0060, // Default NYC longitude
          primaryAddress.coordinates?.lat || 40.7128   // Default NYC latitude
        ]
      },
      serviceArea: {
        type: 'radius',
        value: provider.businessInfo?.serviceRadius || 25,
        maxDistance: provider.businessInfo?.serviceRadius || 25
      },
      travelFee: {
        baseFee: provider.locationInfo?.travelFee?.baseFee || 0,
        perKmFee: provider.locationInfo?.travelFee?.perKmFee || 0
      }
    };
  }

  private createDefaultAvailability(provider: any): any {
    // Use provider's business hours if available, otherwise create default
    const businessHours = provider.businessInfo?.businessHours;

    const defaultSchedule = {
      monday: { isAvailable: true, timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      tuesday: { isAvailable: true, timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      wednesday: { isAvailable: true, timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      thursday: { isAvailable: true, timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      friday: { isAvailable: true, timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      saturday: { isAvailable: true, timeSlots: ['10:00', '11:00', '14:00', '15:00'] },
      sunday: { isAvailable: false, timeSlots: [] }
    };

    return {
      schedule: businessHours || defaultSchedule,
      exceptions: [],
      bufferTime: 15,
      instantBooking: provider.businessInfo?.instantBooking || false,
      advanceBookingDays: provider.businessInfo?.advanceBookingDays || 30
    };
  }

  private displayResults(): void {
    console.log('\n=====================================');
    console.log('Migration Complete!');
    console.log('=====================================');
    console.log(`Total Providers: ${this.stats.totalProviders}`);
    console.log(`Providers with Services: ${this.stats.providersWithServices}`);
    console.log(`Total Services Found: ${this.stats.totalServices}`);
    console.log(`Successful Migrations: ${this.stats.successfulMigrations}`);
    console.log(`Failed Migrations: ${this.stats.failedMigrations}`);

    if (this.stats.errors.length > 0) {
      console.log('\nMigration Errors:');
      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. Provider ${error.providerId}, Service ${error.serviceIndex}: ${error.error}`);
      });
    }

    console.log('\nNext Steps:');
    console.log('1. Verify service data in the database');
    console.log('2. Test search functionality');
    console.log('3. Update application code to use new Service model');
    console.log('4. Consider removing services array from ProviderProfile (after verification)');
  }
}

// Verification function to check migration results
export async function verifyMigration(): Promise<void> {
  try {
    await Database.connect();

    const serviceCount = await Service.countDocuments();
    const activeServices = await Service.countDocuments({ isActive: true });
    const servicesWithLocation = await Service.countDocuments({ 'location.coordinates': { $exists: true } });

    console.log('\nMigration Verification:');
    console.log(`Total Services: ${serviceCount}`);
    console.log(`Active Services: ${activeServices}`);
    console.log(`Services with Location: ${servicesWithLocation}`);

    // Test search functionality
    const textSearchResults = await Service.find({ $text: { $search: 'cleaning' } }).limit(5);
    console.log(`Text Search Test ('cleaning'): ${textSearchResults.length} results`);

    // Test geospatial search (NYC area)
    const geoSearchResults = await Service.find({
      'location.coordinates': {
        $near: {
          $geometry: { type: 'Point', coordinates: [-74.0060, 40.7128] },
          $maxDistance: 10000 // 10km in meters
        }
      }
    }).limit(5);
    console.log(`Geo Search Test (NYC, 10km): ${geoSearchResults.length} results`);

    console.log('Verification Complete!');

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await Database.disconnect();
  }
}

// CLI execution
if (require.main === module) {
  const migration = new ServiceMigration();

  const command = process.argv[2];

  if (command === 'verify') {
    verifyMigration().catch(console.error);
  } else {
    migration.run().catch(console.error);
  }
}

export default ServiceMigration;
