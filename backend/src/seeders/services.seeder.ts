import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import logger from '../utils/logger';

const SAMPLE_SERVICES = [
  // Hair Services
  {
    name: 'Luxury Haircut & Styling',
    category: 'Hair',
    subcategory: 'Haircut & Styling',
    description: 'Premium haircut with wash, style, and finishing. Includes consultation and scalp massage.',
    duration: 60,
    price: { amount: 150, currency: 'AED', type: 'fixed' },
    tags: ['haircut', 'styling', 'luxury'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80'],
  },
  {
    name: 'Balayage Color Treatment',
    category: 'Hair',
    subcategory: 'Hair Coloring',
    description: 'Hand-painted balayage for a natural, sun-kissed look. Includes toner and deep conditioning.',
    duration: 180,
    price: { amount: 550, currency: 'AED', type: 'fixed' },
    tags: ['balayage', 'color', 'highlights'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80'],
  },
  {
    name: 'Keratin Blowout',
    category: 'Hair',
    subcategory: 'Hair Treatment',
    description: 'Professional keratin treatment for smooth, frizz-free hair lasting up to 3 months.',
    duration: 120,
    price: { amount: 400, currency: 'AED', type: 'fixed' },
    tags: ['keratin', 'treatment', 'smoothing'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=600&q=80'],
  },
  // Makeup Services
  {
    name: 'Bridal Makeup',
    category: 'Makeup',
    subcategory: 'Bridal Makeup',
    description: 'Complete bridal look including trial session, day-of makeup, and touch-up kit.',
    duration: 120,
    price: { amount: 800, currency: 'AED', type: 'fixed' },
    tags: ['bridal', 'makeup', 'wedding'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=600&q=80'],
  },
  {
    name: 'Glam Evening Makeup',
    category: 'Makeup',
    subcategory: 'Special Occasion',
    description: 'Stunning makeup for parties, events, and special occasions with lash application.',
    duration: 60,
    price: { amount: 300, currency: 'AED', type: 'fixed' },
    tags: ['glam', 'evening', 'party'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&q=80'],
  },
  // Nail Services
  {
    name: 'Luxury Gel Manicure',
    category: 'Nails',
    subcategory: 'Manicure',
    description: 'Premium gel polish application with cuticle care, hand massage, and nail art options.',
    duration: 60,
    price: { amount: 120, currency: 'AED', type: 'fixed' },
    tags: ['gel', 'manicure', 'nails'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80'],
  },
  {
    name: 'Nail Art Design',
    category: 'Nails',
    subcategory: 'Nail Art',
    description: 'Custom nail art by our skilled artists. Choose from various designs and techniques.',
    duration: 45,
    price: { amount: 80, currency: 'AED', type: 'per_design' },
    tags: ['nail art', 'design', 'custom'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=600&q=80'],
  },
  // Skin & Aesthetics
  {
    name: 'Hydrafacial Elite',
    category: 'Skin & Aesthetics',
    subcategory: 'Facial Treatment',
    description: 'Deep cleansing, exfoliation, extraction, and hydration with antioxidants.',
    duration: 75,
    price: { amount: 450, currency: 'AED', type: 'fixed' },
    tags: ['hydrafacial', 'facial', 'skincare'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1570172619644-dfd03ed5b881?w=600&q=80'],
  },
  {
    name: 'LED Light Therapy',
    category: 'Skin & Aesthetics',
    subcategory: 'Skin Rejuvenation',
    description: 'Advanced LED therapy for anti-aging, acne treatment, and skin healing.',
    duration: 30,
    price: { amount: 200, currency: 'AED', type: 'fixed' },
    tags: ['led', 'therapy', 'anti-aging'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80'],
  },
  // Massage & Body
  {
    name: 'Swedish Massage',
    category: 'Massage & Body',
    subcategory: 'Relaxation Massage',
    description: 'Classic full-body massage using long, flowing strokes for ultimate relaxation.',
    duration: 60,
    price: { amount: 250, currency: 'AED', type: 'fixed' },
    tags: ['swedish', 'massage', 'relaxation'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80'],
  },
  {
    name: 'Deep Tissue Massage',
    category: 'Massage & Body',
    subcategory: 'Therapeutic Massage',
    description: 'Intensive massage targeting deep muscle layers for chronic pain and tension.',
    duration: 90,
    price: { amount: 350, currency: 'AED', type: 'fixed' },
    tags: ['deep tissue', 'therapeutic', 'pain relief'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=600&q=80'],
  },
  // Personal Care
  {
    name: 'Signature Brow Design',
    category: 'Personal Care',
    subcategory: 'Brow Services',
    description: 'Expert brow mapping, shaping, tinting, and lamination for perfect arches.',
    duration: 45,
    price: { amount: 100, currency: 'AED', type: 'fixed' },
    tags: ['brows', 'shaping', 'lamination'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80'],
  },
  {
    name: 'Luxury Lash Extensions',
    category: 'Personal Care',
    subcategory: 'Lash Services',
    description: 'Full set of classic or volume lash extensions with professional aftercare.',
    duration: 120,
    price: { amount: 350, currency: 'AED', type: 'fixed' },
    tags: ['lashes', 'extensions', 'volume'],
    location: { address: { city: 'Dubai', state: 'Dubai' } },
    images: ['https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=600&q=80'],
  },
];

async function seedServices() {
  try {
    // Check if services already exist
    const existingCount = await Service.countDocuments();
    if (existingCount > 0) {
      logger.info(`Services seeder: ${existingCount} services already exist. Skipping.`);
      return { success: true, message: `${existingCount} services already exist` };
    }

    // Get a provider to assign services to
    let provider = await ProviderProfile.findOne();

    // If no provider exists, create a test user and provider
    if (!provider) {
      logger.info('Services seeder: No provider found, creating test provider...');

      // Create test user
      const testUser = await User.create({
        email: 'provider@nilin.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        phone: '+971501234567',
        role: 'provider',
        isEmailVerified: true,
      });

      // Create provider profile
      provider = await ProviderProfile.create({
        userId: testUser._id,
        businessName: 'Sarah Beauty Studio',
        bio: 'Professional beauty services with 10+ years experience',
        city: 'Dubai',
        state: 'Dubai',
        isVerified: true,
        rating: { average: 4.8, count: 45 },
        isActive: true,
      });
    }

    // Create services
    const createdServices = [];
    for (const serviceData of SAMPLE_SERVICES) {
      const service = await Service.create({
        ...serviceData,
        providerId: provider._id,
        providerName: provider.businessName || `${provider.userId}'s Services`,
        providerTrustScore: provider.rating?.average || 4.5,
        rating: { average: 4.0 + Math.random() * 1, count: Math.floor(Math.random() * 50) + 5 },
        searchMetadata: {
          searchCount: Math.floor(Math.random() * 100),
          clickCount: Math.floor(Math.random() * 50),
          bookingCount: Math.floor(Math.random() * 30),
          popularityScore: Math.random(),
        },
        status: 'active',
        isActive: true,
        isFeatured: Math.random() > 0.7,
      });
      createdServices.push(service);
    }

    logger.info(`Services seeder: Created ${createdServices.length} services`);
    return { success: true, count: createdServices.length };
  } catch (error: any) {
    logger.error('Services seeder error:', error);
    throw error;
  }
}

export default seedServices;
