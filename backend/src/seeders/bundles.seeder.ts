import mongoose from 'mongoose';
import Bundle from '../models/bundle.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import User from '../models/user.model';
import Tenant from '../models/tenant.model';
import logger from '../utils/logger';

/**
 * Sample Bundle Data
 * Based on provided bundle information with services linked to actual service documents
 */
const SAMPLE_BUNDLES = [
  {
    name: 'Bridal Beauty Package',
    description: 'Complete bridal beauty package including hair styling, makeup, henna, and nail services',
    originalPrice: 2000,
    bundlePrice: 1499,
    savingsPercentage: 25,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    isActive: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&q=80',
    tags: ['bridal', 'beauty', 'package'],
    serviceRefs: ['Balayage Color Treatment', 'Bridal Makeup', 'Luxury Gel Manicure', 'Nail Art Design'],
    categorySlug: 'makeup',
  },
  {
    name: 'Self-Care Sunday Package',
    description: 'Relax and unwind with massage, facial, and nail services',
    originalPrice: 850,
    bundlePrice: 649,
    savingsPercentage: 24,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    isActive: true,
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
    tags: ['spa', 'relaxation', 'self-care'],
    serviceRefs: ['Swedish Massage', 'Hydrafacial Elite', 'Luxury Gel Manicure'],
    categorySlug: 'skin-aesthetics',
  },
  {
    name: 'Hair Makeover Package',
    description: 'Transform your look with haircut, coloring, and treatment',
    originalPrice: 1100,
    bundlePrice: 849,
    savingsPercentage: 23,
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    isActive: true,
    isFeatured: false,
    image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=80',
    tags: ['hair', 'makeover', 'color'],
    serviceRefs: ['Luxury Haircut & Styling', 'Balayage Color Treatment', 'Keratin Blowout'],
    categorySlug: 'hair',
  },
];

async function seedBundles() {
  try {
    // Check if bundles already exist
    const existingCount = await Bundle.countDocuments();
    if (existingCount > 0) {
      logger.info(`Bundles seeder: ${existingCount} bundles already exist. Skipping.`);
      return { success: true, message: `${existingCount} bundles already exist` };
    }

    // Get the admin user for createdBy field
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      logger.warn('Bundles seeder: No admin user found. Using first available user.');
    }
    const createdBy = adminUser?._id || (await User.findOne())?._id;
    if (!createdBy) {
      logger.error('Bundles seeder: No users found in database. Cannot create bundles.');
      return { success: false, message: 'No users found' };
    }

    // Get all categories for mapping
    const categories = await ServiceCategory.find({});
    const categoryMap = new Map(categories.map(cat => [cat.slug, cat._id]));

    // Get all services for mapping
    const services = await Service.find({});
    const serviceMap = new Map(services.map(svc => [svc.name, svc]));

    // Prepare all bundle data first
    const CHUNK_SIZE = 50;
    const bundlesToCreate = [];
    let skippedBundles = 0;

    for (const bundleData of SAMPLE_BUNDLES) {
      // Build services array for the bundle
      const bundleServices = [];
      let calculatedOriginalPrice = 0;

      for (const serviceName of bundleData.serviceRefs) {
        const service = serviceMap.get(serviceName);
        if (service) {
          const servicePrice = service.price?.amount || 0;
          calculatedOriginalPrice += servicePrice;

          bundleServices.push({
            serviceId: service._id,
            serviceName: service.name,
            quantity: 1,
            originalPrice: servicePrice,
            description: service.description,
          });
        } else {
          logger.warn(`Bundles seeder: Service not found: ${serviceName}`);
        }
      }

      // Skip if no services found for this bundle
      if (bundleServices.length === 0) {
        logger.warn(`Bundles seeder: No services found for bundle: ${bundleData.name}. Skipping.`);
        skippedBundles++;
        continue;
      }

      // Calculate savings
      const savingsAmount = calculatedOriginalPrice - bundleData.bundlePrice;
      const savingsPercentage =
        calculatedOriginalPrice > 0
          ? Math.round((savingsAmount / calculatedOriginalPrice) * 100)
          : 0;

      // Get category ID
      const categoryId = categoryMap.get(bundleData.categorySlug);

      // Get tenant ID for the bundles
      const tenant = await Tenant.findOne({ slug: 'default', isActive: true });
      const tenantId = tenant?._id || new mongoose.Types.ObjectId();

      bundlesToCreate.push({
        name: bundleData.name,
        tenantId: tenantId,
        description: bundleData.description,
        services: bundleServices,
        categoryId: categoryId || undefined,
        originalPrice: calculatedOriginalPrice,
        bundlePrice: bundleData.bundlePrice,
        savingsAmount: savingsAmount,
        savingsPercentage: savingsPercentage,
        validFrom: bundleData.validFrom,
        validUntil: bundleData.validUntil,
        maxRedemptions: 100,
        redemptionsUsed: 0,
        maxPurchasesPerCustomer: 3,
        isActive: bundleData.isActive,
        isFeatured: bundleData.isFeatured,
        image: bundleData.image,
        tags: bundleData.tags,
        rating: {
          average: 4.0 + Math.random(),
          count: Math.floor(Math.random() * 30) + 5,
        },
        providerCount: 1,
        createdBy: createdBy,
      });
    }

    // Bulk insert bundles in chunks
    let createdCount = 0;
    for (let i = 0; i < bundlesToCreate.length; i += CHUNK_SIZE) {
      const chunk = bundlesToCreate.slice(i, i + CHUNK_SIZE);
      const inserted = await Bundle.insertMany(chunk, { ordered: false });
      createdCount += inserted.length;
    }

    logger.info(`Bundles seeder: Created ${createdCount} bundles (skipped ${skippedBundles})`);
    return { success: true, count: createdCount };
  } catch (error: any) {
    logger.error('Bundles seeder error:', error);
    throw error;
  }
}

export default seedBundles;
