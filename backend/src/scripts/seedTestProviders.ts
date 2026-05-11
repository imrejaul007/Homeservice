/**
 * Seed Script for Test Providers
 * Creates 6 verified providers, one for each master category,
 * with services covering all subcategories
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import Availability from '../models/availability.model';

// NILIN Beauty Categories (matching database)
const CATEGORIES = [
  {
    name: 'Hair',
    slug: 'hair',
    color: '#FF8A80',
    provider: {
      firstName: 'Layla',
      lastName: 'Al Maktoum',
      email: 'layla.hair@nilin.test',
      businessName: 'Layla\'s Hair Atelier',
      tagline: 'Your hair, our artistry',
      bio: 'Award-winning hair stylist with 12 years of experience in Dubai. Certified by Toni & Guy Academy. Specializing in bridal hair and balayage.',
    },
    subcategories: [
      { name: "Women's Haircut", slug: 'womens-haircut', services: ["Women's Haircut & Style", 'Layered Cut', 'Trim & Reshape'] },
      { name: "Men's Haircut", slug: 'mens-haircut', services: ["Men's Haircut", 'Fade & Taper', 'Beard Trim & Shape'] },
      { name: 'Coloring', slug: 'coloring', services: ['Full Color', 'Highlights & Balayage', 'Root Touch-Up'] },
      { name: 'Treatments', slug: 'treatments', services: ['Keratin Treatment', 'Deep Conditioning', 'Hair Spa'] },
      { name: 'Blowout', slug: 'blowout', services: ['Classic Blowout', 'Bouncy Blowdry', 'Straightening Blowout'] },
      { name: 'Bridal Hair', slug: 'bridal-hair', services: ['Bridal Updo', 'Bridal Trial Session', 'Bridesmaid Styling'] },
    ]
  },
  {
    name: 'Makeup',
    slug: 'makeup',
    color: '#F48FB1',
    provider: {
      firstName: 'Fatima',
      lastName: 'Hassan',
      email: 'fatima.makeup@nilin.test',
      businessName: 'Fatima Glam Studio',
      tagline: 'Flawless looks for every occasion',
      bio: 'Celebrity makeup artist based in Dubai with 10+ years of experience. Trained at MAC Pro and Bobbi Brown Academy. Featured in Vogue Arabia.',
    },
    subcategories: [
      { name: 'Bridal', slug: 'bridal-makeup', services: ['Bridal Makeup Full', 'Bridal Trial', 'Nikah Makeup'] },
      { name: 'Party & Event', slug: 'party-event-makeup', services: ['Party Glam', 'Red Carpet Look', 'Cocktail Makeup'] },
      { name: 'Everyday', slug: 'everyday-makeup', services: ['Natural Day Look', 'Office Ready', 'Fresh & Dewy'] },
      { name: 'Lessons', slug: 'makeup-lessons', services: ['Beginner Lesson', 'Advanced Techniques', 'Bridal Self-Makeup'] },
      { name: 'Editorial', slug: 'editorial-makeup', services: ['Fashion Shoot', 'Editorial Glam', 'Creative Makeup'] },
    ]
  },
  {
    name: 'Nails',
    slug: 'nails',
    color: '#CE93D8',
    provider: {
      firstName: 'Mariam',
      lastName: 'Khan',
      email: 'mariam.nails@nilin.test',
      businessName: 'Nails by Mariam',
      tagline: 'Art at your fingertips',
      bio: 'Certified nail technician with 8 years of experience. Specializing in gel extensions, nail art, and luxury manicures. OPI & CND certified.',
    },
    subcategories: [
      { name: 'Manicure', slug: 'manicure', services: ['Classic Manicure', 'Luxury Spa Manicure', 'Express Manicure'] },
      { name: 'Pedicure', slug: 'pedicure', services: ['Classic Pedicure', 'Luxury Spa Pedicure', 'Medical Pedicure'] },
      { name: 'Gel', slug: 'gel-nails', services: ['Gel Polish Application', 'Gel Extensions', 'Gel Removal & Redo'] },
      { name: 'Acrylic', slug: 'acrylic-nails', services: ['Acrylic Full Set', 'Acrylic Fill', 'Acrylic Removal'] },
      { name: 'Nail Art', slug: 'nail-art', services: ['Custom Nail Art', 'French Tips', 'Ombre Nails'] },
    ]
  },
  {
    name: 'Skin & Aesthetics',
    slug: 'skin-aesthetics',
    color: '#B39DDB',
    provider: {
      firstName: 'Noura',
      lastName: 'Al Rashid',
      email: 'noura.skin@nilin.test',
      businessName: 'Noura Skin Clinic',
      tagline: 'Glow from within',
      bio: 'Licensed esthetician with 15 years of experience. CIDESCO-certified. Expert in facials, chemical peels, and anti-aging treatments.',
    },
    subcategories: [
      { name: 'Facial', slug: 'facial', services: ['Classic Facial', 'HydraFacial', 'Gold Facial'] },
      { name: 'Chemical Peel', slug: 'chemical-peel', services: ['Glycolic Peel', 'Salicylic Peel', 'Lactic Acid Peel'] },
      { name: 'Anti-Aging', slug: 'anti-aging', services: ['Anti-Wrinkle Facial', 'Collagen Boost', 'Microcurrent Therapy'] },
      { name: 'Acne', slug: 'acne-treatment', services: ['Acne Facial', 'Extraction Treatment', 'LED Blue Light'] },
      { name: 'Consultation', slug: 'skin-consultation', services: ['Skin Analysis', 'Treatment Plan', 'Product Recommendation'] },
    ]
  },
  {
    name: 'Massage & Body',
    slug: 'massage-body',
    color: '#90CAF9',
    provider: {
      firstName: 'Sara',
      lastName: 'Ibrahim',
      email: 'sara.massage@nilin.test',
      businessName: 'Sara\'s Healing Hands',
      tagline: 'Relax, restore, rejuvenate',
      bio: 'Licensed massage therapist with 10 years of experience. Trained in Thai, Swedish, and deep tissue techniques. ITEC Level 3 certified.',
    },
    subcategories: [
      { name: 'Swedish', slug: 'swedish-massage', services: ['Full Body Swedish', '60-min Relaxation', '90-min Deep Relaxation'] },
      { name: 'Deep Tissue', slug: 'deep-tissue', services: ['Full Body Deep Tissue', 'Back & Shoulder Focus', 'Sports Recovery'] },
      { name: 'Hot Stone', slug: 'hot-stone', services: ['Hot Stone Full Body', 'Hot Stone Back & Neck', 'Volcanic Stone Therapy'] },
      { name: 'Aromatherapy', slug: 'aromatherapy', services: ['Lavender Relaxation', 'Eucalyptus Energizing', 'Custom Blend Therapy'] },
      { name: 'Body Scrub', slug: 'body-scrub', services: ['Dead Sea Salt Scrub', 'Coffee Body Scrub', 'Sugar & Honey Scrub'] },
    ]
  },
  {
    name: 'Personal Care',
    slug: 'personal-care',
    color: '#A5D6A7',
    provider: {
      firstName: 'Hana',
      lastName: 'Ahmed',
      email: 'hana.care@nilin.test',
      businessName: 'Hana Beauty Care',
      tagline: 'Grooming essentials at your door',
      bio: 'Expert in threading, waxing, and lash artistry with 9 years of experience. Certified lash technician. Known for precision brow shaping.',
    },
    subcategories: [
      { name: 'Threading', slug: 'threading', services: ['Eyebrow Threading', 'Full Face Threading', 'Upper Lip Thread'] },
      { name: 'Waxing', slug: 'waxing', services: ['Full Body Wax', 'Half Leg Wax', 'Bikini Wax'] },
      { name: 'Lash Extensions', slug: 'lash-extensions', services: ['Classic Lash Set', 'Volume Lash Set', 'Hybrid Lash Set'] },
      { name: 'Brow Shaping', slug: 'brow-shaping', services: ['Brow Shape & Tint', 'Brow Lamination', 'Microblading Touch-Up'] },
      { name: 'Henna', slug: 'henna', services: ['Bridal Henna', 'Party Henna', 'Simple Henna Design'] },
    ]
  }
];

const DEFAULT_PASSWORD = 'TestProvider@123';

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/home-service-platform';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
}

async function clearTestData() {
  console.log('Clearing existing test providers...');

  // Find test users by email pattern
  const testEmails = CATEGORIES.map(c => c.provider.email);
  const testUsers = await User.find({ email: { $in: testEmails } });
  const testUserIds = testUsers.map(u => u._id);

  if (testUserIds.length > 0) {
    // Delete provider profiles
    await ProviderProfile.deleteMany({ userId: { $in: testUserIds } });

    // Delete services
    await Service.deleteMany({ providerId: { $in: testUserIds } });

    // Delete availability records
    await Availability.deleteMany({ providerId: { $in: testUserIds } });

    // Delete users
    await User.deleteMany({ _id: { $in: testUserIds } });

    console.log(`Cleared ${testUserIds.length} existing test providers`);
  }
}

async function createProvider(categoryData: typeof CATEGORIES[0]) {
  const { provider, name: categoryName, slug: categorySlug, color, subcategories } = categoryData;

  console.log(`\nCreating provider: ${provider.businessName}`);

  // 1. Create User account
  const user = await User.create({
    firstName: provider.firstName,
    lastName: provider.lastName,
    email: provider.email,
    password: DEFAULT_PASSWORD,
    phone: '+971' + Math.floor(500000000 + Math.random() * 99999999),
    role: 'provider',
    accountStatus: 'active',
    isEmailVerified: true,
    isPhoneVerified: true,
    isActive: true,
    address: {
      city: 'Dubai',
      state: 'Dubai',
      country: 'UAE',
      zipCode: '00000',
      coordinates: {
        lat: 25.2048 + (Math.random() * 0.1 - 0.05),
        lng: 55.2708 + (Math.random() * 0.1 - 0.05)
      }
    }
  });

  console.log(`  Created user: ${user.email}`);

  // 2. Create ProviderProfile with embedded services
  const embeddedServices = [];
  for (const subcat of subcategories) {
    for (const serviceName of subcat.services) {
      const basePrice = 500 + Math.floor(Math.random() * 2000);
      embeddedServices.push({
        name: serviceName,
        category: categoryName,
        subcategory: subcat.name,
        description: `Professional ${serviceName.toLowerCase()} service by ${provider.businessName}. Quality guaranteed.`,
        duration: 30 + Math.floor(Math.random() * 90),
        price: {
          amount: basePrice,
          currency: 'AED',
          type: 'fixed' as const
        },
        images: [],
        isActive: true,
        isPopular: Math.random() > 0.7,
        tags: [categoryName.toLowerCase(), subcat.name.toLowerCase(), serviceName.toLowerCase()],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  const providerProfile = await ProviderProfile.create({
    userId: user._id,
    businessInfo: {
      businessName: provider.businessName,
      businessType: 'individual',
      description: provider.bio,
      tagline: provider.tagline,
      serviceRadius: 25,
      instantBooking: true,
      advanceBookingDays: 30,
      businessHours: {
        monday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
        tuesday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
        wednesday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
        thursday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
        friday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
        saturday: { isOpen: true, openTime: '10:00', closeTime: '16:00' },
        sunday: { isOpen: false }
      }
    },
    instagramStyleProfile: {
      profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(provider.firstName + '+' + provider.lastName)}&background=${color.replace('#', '')}&color=fff&size=200`,
      coverPhoto: `https://picsum.photos/seed/${categorySlug}/800/300`,
      isVerified: true, // VERIFIED!
      verificationBadges: [
        {
          type: 'identity',
          verifiedAt: new Date(),
          verifier: 'NILIN Admin'
        },
        {
          type: 'business',
          verifiedAt: new Date(),
          verifier: 'NILIN Admin'
        }
      ],
      bio: provider.bio,
      highlights: [],
      posts: [],
      followersCount: Math.floor(Math.random() * 500) + 100,
      followingCount: Math.floor(Math.random() * 100) + 20,
      totalLikes: Math.floor(Math.random() * 1000) + 200,
      engagementRate: Math.random() * 5 + 2
    },
    services: embeddedServices,
    portfolio: {
      featured: [],
      certifications: [
        {
          name: `${categoryName} Professional Certification`,
          issuingOrganization: 'NILIN Academy',
          issueDate: new Date('2023-01-01'),
          isVerified: true
        }
      ],
      awards: []
    },
    locationInfo: {
      primaryAddress: {
        street: '123 Al Wasl Road',
        city: 'Dubai',
        state: 'Dubai',
        zipCode: '00000',
        country: 'UAE',
        coordinates: {
          lat: 25.2048 + (Math.random() * 0.1 - 0.05),
          lng: 55.2708 + (Math.random() * 0.1 - 0.05)
        }
      },
      serviceAreas: [
        { name: 'Dubai', type: 'city', value: 'Dubai' }
      ],
      travelFee: {
        baseFee: 0,
        perKmFee: 10,
        maxTravelDistance: 25
      },
      mobileService: true,
      hasFixedLocation: false
    },
    reviewsData: {
      averageRating: 4.2 + Math.random() * 0.7,
      totalReviews: Math.floor(Math.random() * 50) + 10,
      ratingDistribution: {
        5: Math.floor(Math.random() * 20) + 5,
        4: Math.floor(Math.random() * 15) + 3,
        3: Math.floor(Math.random() * 5) + 1,
        2: Math.floor(Math.random() * 2),
        1: Math.floor(Math.random() * 2)
      },
      recentReviews: [],
      responseRate: 85 + Math.random() * 15,
      avgResponseTime: Math.random() * 12 + 1
    },
    analytics: {
      profileViews: [],
      bookingStats: {
        totalBookings: Math.floor(Math.random() * 100) + 20,
        completedBookings: Math.floor(Math.random() * 80) + 15,
        cancelledBookings: Math.floor(Math.random() * 5),
        noShowBookings: 0,
        averageBookingValue: 800 + Math.random() * 1000,
        repeatCustomerRate: 30 + Math.random() * 40
      },
      revenueStats: {
        totalEarnings: Math.floor(Math.random() * 100000) + 50000,
        currentMonthEarnings: Math.floor(Math.random() * 20000) + 5000,
        averageMonthlyEarnings: Math.floor(Math.random() * 15000) + 8000,
        topEarningServices: []
      },
      customerMetrics: {
        totalCustomers: Math.floor(Math.random() * 50) + 15,
        repeatCustomers: Math.floor(Math.random() * 20) + 5,
        customerRetentionRate: 40 + Math.random() * 30,
        averageCustomerLifetimeValue: 2000 + Math.random() * 3000
      },
      performanceMetrics: {
        acceptanceRate: 90 + Math.random() * 10,
        responseTime: Math.random() * 30 + 5,
        completionRate: 95 + Math.random() * 5,
        punctualityScore: 90 + Math.random() * 10,
        qualityScore: 85 + Math.random() * 15
      }
    },
    verificationStatus: {
      overall: 'approved',
      identity: {
        status: 'approved',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        documents: []
      },
      business: {
        status: 'approved',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        documents: []
      },
      background: {
        status: 'approved',
        submittedAt: new Date(),
        completedAt: new Date(),
        provider: 'NILIN Verification'
      }
    },
    settings: {
      autoAcceptBookings: true,
      instantBookingEnabled: true,
      requirePaymentUpfront: false,
      allowRescheduling: true,
      cancellationPolicy: {
        freeUntilHours: 24,
        partialRefundUntilHours: 12,
        noRefundAfterHours: 2
      },
      communicationPreferences: {
        bookingNotifications: true,
        reviewNotifications: true,
        marketingEmails: false,
        smsNotifications: true
      },
      privacySettings: {
        showExactLocation: false,
        showPhoneNumber: true,
        showEmail: false
      }
    },
    isProfileComplete: true,
    completionPercentage: 95,
    lastActiveAt: new Date(),
    isActive: true,
    isDeleted: false
  });

  console.log(`  Created provider profile with ${embeddedServices.length} services`);

  // 3. Also create Service model entries (for search functionality)
  const serviceDocuments = [];
  for (const subcat of subcategories) {
    for (const serviceName of subcat.services) {
      const basePrice = 500 + Math.floor(Math.random() * 2000);
      serviceDocuments.push({
        providerId: user._id,
        name: serviceName,
        category: categoryName,
        subcategory: subcat.name,
        description: `Professional ${serviceName.toLowerCase()} service by ${provider.businessName}. Quality guaranteed with experienced professionals.`,
        shortDescription: `Expert ${serviceName.toLowerCase()} service`,
        price: {
          amount: basePrice,
          currency: 'AED',
          type: 'fixed'
        },
        duration: 30 + Math.floor(Math.random() * 90),
        images: [],
        tags: [categoryName.toLowerCase(), subcat.name.toLowerCase(), serviceName.toLowerCase().split(' ')].flat(),
        location: {
          address: {
            street: '123 Al Wasl Road',
            city: 'Dubai',
            state: 'Dubai',
            zipCode: '00000',
            country: 'UAE'
          },
          coordinates: {
            type: 'Point',
            coordinates: [55.2708 + (Math.random() * 0.1 - 0.05), 25.2048 + (Math.random() * 0.1 - 0.05)]
          },
          serviceArea: {
            type: 'city',
            value: 'Dubai',
            maxDistance: 25
          }
        },
        availability: {
          schedule: {
            monday: { isAvailable: true, timeSlots: ['09:00-12:00', '14:00-18:00'] },
            tuesday: { isAvailable: true, timeSlots: ['09:00-12:00', '14:00-18:00'] },
            wednesday: { isAvailable: true, timeSlots: ['09:00-12:00', '14:00-18:00'] },
            thursday: { isAvailable: true, timeSlots: ['09:00-12:00', '14:00-18:00'] },
            friday: { isAvailable: true, timeSlots: ['09:00-12:00', '14:00-18:00'] },
            saturday: { isAvailable: true, timeSlots: ['10:00-16:00'] },
            sunday: { isAvailable: false, timeSlots: [] }
          },
          exceptions: [],
          bufferTime: 15,
          instantBooking: true,
          advanceBookingDays: 30
        },
        rating: {
          average: 4.2 + Math.random() * 0.7,
          count: Math.floor(Math.random() * 20) + 5,
          distribution: {
            5: Math.floor(Math.random() * 10) + 2,
            4: Math.floor(Math.random() * 8) + 1,
            3: Math.floor(Math.random() * 3),
            2: Math.floor(Math.random() * 2),
            1: 0
          }
        },
        searchMetadata: {
          searchCount: Math.floor(Math.random() * 100),
          clickCount: Math.floor(Math.random() * 50),
          bookingCount: Math.floor(Math.random() * 20),
          popularityScore: Math.floor(Math.random() * 500) + 100,
          searchKeywords: [categoryName.toLowerCase(), subcat.name.toLowerCase(), ...serviceName.toLowerCase().split(' ')]
        },
        isActive: true,
        isFeatured: Math.random() > 0.8,
        isPopular: Math.random() > 0.7,
        status: 'active'
      });
    }
  }

  await Service.insertMany(serviceDocuments);
  console.log(`  Created ${serviceDocuments.length} Service documents`);

  // 4. Create Availability record for booking
  const defaultTimeSlots = [
    { start: '09:00', end: '10:00', isActive: true },
    { start: '10:00', end: '11:00', isActive: true },
    { start: '11:00', end: '12:00', isActive: true },
    { start: '14:00', end: '15:00', isActive: true },
    { start: '15:00', end: '16:00', isActive: true },
    { start: '16:00', end: '17:00', isActive: true },
    { start: '17:00', end: '18:00', isActive: true },
  ];

  const saturdayTimeSlots = [
    { start: '10:00', end: '11:00', isActive: true },
    { start: '11:00', end: '12:00', isActive: true },
    { start: '12:00', end: '13:00', isActive: true },
    { start: '14:00', end: '15:00', isActive: true },
    { start: '15:00', end: '16:00', isActive: true },
  ];

  await Availability.create({
    providerId: user._id,
    weeklySchedule: {
      monday: { isAvailable: true, timeSlots: defaultTimeSlots },
      tuesday: { isAvailable: true, timeSlots: defaultTimeSlots },
      wednesday: { isAvailable: true, timeSlots: defaultTimeSlots },
      thursday: { isAvailable: true, timeSlots: defaultTimeSlots },
      friday: { isAvailable: true, timeSlots: defaultTimeSlots },
      saturday: { isAvailable: true, timeSlots: saturdayTimeSlots },
      sunday: { isAvailable: false, timeSlots: [] }
    },
    dateOverrides: [],
    blockedPeriods: [],
    timezone: 'Asia/Dubai',
    bufferTime: {
      beforeBooking: 15,
      afterBooking: 15,
      minimumGap: 30
    },
    maxAdvanceBookingDays: 30,
    autoAcceptBookings: true
  });

  console.log(`  Created availability schedule`);

  return {
    user,
    providerProfile,
    servicesCount: serviceDocuments.length
  };
}

async function updateCategoryMetadata() {
  console.log('\nUpdating category metadata...');

  for (const catData of CATEGORIES) {
    const serviceCount = await Service.countDocuments({
      category: catData.name,
      isActive: true
    });

    const providerCount = await ProviderProfile.countDocuments({
      'services.category': catData.name,
      isActive: true,
      'instagramStyleProfile.isVerified': true
    });

    await ServiceCategory.updateOne(
      { slug: catData.slug },
      {
        $set: {
          'metadata.totalServices': serviceCount,
          'metadata.totalProviders': providerCount
        }
      }
    );

    console.log(`  ${catData.name}: ${providerCount} providers, ${serviceCount} services`);
  }
}

async function main() {
  try {
    await connectDB();
    await clearTestData();

    console.log('\n========================================');
    console.log('Creating 6 Beauty Test Providers (Dubai)');
    console.log('========================================');

    const results = [];
    for (const categoryData of CATEGORIES) {
      const result = await createProvider(categoryData);
      results.push(result);
    }

    await updateCategoryMetadata();

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Created ${results.length} providers`);
    console.log(`Total services: ${results.reduce((sum, r) => sum + r.servicesCount, 0)}`);
    console.log('\nTest Credentials:');
    console.log(`Password for all providers: ${DEFAULT_PASSWORD}`);
    console.log('\nProvider Emails:');
    results.forEach(r => {
      console.log(`  - ${r.user.email}`);
    });

    console.log('\n✅ Seed completed successfully!');

  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();
