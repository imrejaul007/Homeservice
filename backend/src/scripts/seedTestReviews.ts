import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

/**
 * Seed Test Reviews for existing provider
 *
 * This script:
 * 1. Finds existing provider and services
 * 2. Creates test bookings
 * 3. Creates test reviews
 * 4. Updates provider profile's recentReviews
 *
 * Usage: npx ts-node src/scripts/seedTestReviews.ts test
 */

interface TestReview {
  customerName: string;
  customerId: string;
  serviceName: string;
  serviceId: string;
  rating: number;
  title: string;
  comment: string;
}

const TEST_REVIEWS: TestReview[] = [
  {
    customerName: 'Sarah Johnson',
    customerId: '507f1f77bcf86cd799439011',
    serviceName: 'Hair Styling',
    serviceId: '',
    rating: 5,
    title: 'Amazing service!',
    comment: 'The haircut was exactly what I wanted. Very professional and friendly staff!'
  },
  {
    customerName: 'Mike Chen',
    customerId: '507f1f77bcf86cd799439012',
    serviceName: 'Facial Treatment',
    serviceId: '',
    rating: 4,
    title: 'Great experience',
    comment: 'Very relaxing facial treatment. The products used were high quality.'
  },
  {
    customerName: 'Emily Davis',
    customerId: '507f1f77bcf86cd799439013',
    serviceName: 'Nail Art',
    serviceId: '',
    rating: 5,
    title: 'Perfect nails!',
    comment: 'Love my nails! The technician was very skilled and the design was beautiful.'
  },
  {
    customerName: 'James Wilson',
    customerId: '507f1f77bcf86cd799439014',
    serviceName: 'Massage Therapy',
    serviceId: '',
    rating: 4,
    title: 'Very relaxing',
    comment: 'Great massage. Helped relieve my back pain. Will definitely come back.'
  },
  {
    customerName: 'Lisa Brown',
    customerId: '507f1f77bcf86cd799439015',
    serviceName: 'Hair Coloring',
    serviceId: '',
    rating: 5,
    title: 'Love my new color!',
    comment: 'The hair color is exactly what I envisioned. So happy with the results!'
  }
];

async function seedReviews() {
  const dbName = process.argv[2] || 'test';

  console.log('='.repeat(60));
  console.log('Seed Test Reviews');
  console.log('='.repeat(60));
  console.log();
  console.log(`📍 Target Database: ${dbName}`);
  console.log();

  const baseUri = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/';
  const uri = `${baseUri}${dbName}?appName=Cluster0`;

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ Connected to MongoDB');
    console.log(`🏠 Host: ${mongoose.connection.host}`);
    console.log();

    const db = mongoose.connection.db!;

    // Find the existing provider profile
    const providerProfile = await db.collection('providerprofiles').findOne({});

    if (!providerProfile) {
      console.error('❌ No provider profile found!');
      process.exit(1);
    }

    console.log(`📋 Found Provider Profile:`);
    console.log(`   User ID: ${providerProfile.userId}`);
    console.log(`   Current reviews: ${providerProfile.reviewsData?.recentReviews?.length || 0}`);
    console.log();

    // Find services from this provider
    const services = await db.collection('services')
      .find({ providerId: new mongoose.Types.ObjectId(providerProfile.userId) })
      .limit(5)
      .toArray();

    console.log(`📋 Found ${services.length} services for this provider`);

    // Map test reviews to actual service IDs
    const servicesMap = new Map<string, { _id: mongoose.Types.ObjectId; name: string }>();
    services.forEach((svc: any) => {
      servicesMap.set(svc.name, { _id: svc._id, name: svc.name });
    });

    // If no services, use first available service or create placeholder
    let serviceForReviews: { _id: mongoose.Types.ObjectId; name: string };
    if (services.length > 0) {
      serviceForReviews = { _id: services[0]._id as mongoose.Types.ObjectId, name: services[0].name };
    } else {
      // Create a test service if none exists
      const testService = {
        _id: new mongoose.Types.ObjectId(),
        name: 'General Service',
        providerId: new mongoose.Types.ObjectId(providerProfile.userId),
        isActive: true,
        createdAt: new Date()
      };
      await db.collection('services').insertOne(testService);
      serviceForReviews = { _id: testService._id, name: testService.name };
      console.log('   Created test service: General Service');
    }

    // Create test customers if they don't exist
    const usersCollection = db.collection('users');
    const customerIds: string[] = [];

    for (const review of TEST_REVIEWS) {
      let user = await usersCollection.findOne({
        $or: [
          { email: `${review.customerId}@test.com` },
          { firstName: review.customerName.split(' ')[0], lastName: review.customerName.split(' ')[1] }
        ]
      });

      if (!user) {
        // Create test customer
        const newUser = {
          _id: new mongoose.Types.ObjectId(review.customerId),
          email: `${review.customerId}@test.com`,
          firstName: review.customerName.split(' ')[0],
          lastName: review.customerName.split(' ')[1],
          role: 'customer',
          accountStatus: 'active',
          createdAt: new Date()
        };
        await usersCollection.insertOne(newUser);
        user = newUser;
      }
      customerIds.push(user._id.toString());
    }

    console.log(`\n📋 Created/Found ${customerIds.length} test customers`);
    console.log();

    // Create bookings and reviews
    const recentReviews: any[] = [];
    const reviewsCollection = db.collection('reviews');
    const bookingsCollection = db.collection('bookings');

    for (let i = 0; i < TEST_REVIEWS.length; i++) {
      const testReview = TEST_REVIEWS[i];
      const customerId = customerIds[i];

      // Create a booking
      const booking = {
        _id: new mongoose.Types.ObjectId(),
        bookingNumber: `BK-${Date.now()}-${i + 1}`,
        customerId: new mongoose.Types.ObjectId(customerId),
        providerId: new mongoose.Types.ObjectId(providerProfile.userId),
        serviceId: serviceForReviews._id,
        status: 'completed',
        scheduledDate: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000), // Days ago
        scheduledTime: '10:00',
        completedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000),
        customerReview: null as mongoose.Types.ObjectId | null
      };

      await bookingsCollection.insertOne(booking);

      // Create a review
      const review = {
        _id: new mongoose.Types.ObjectId(),
        bookingId: booking._id,
        reviewerId: new mongoose.Types.ObjectId(customerId),
        reviewerType: 'customer',
        revieweeId: new mongoose.Types.ObjectId(providerProfile.userId),
        revieweeType: 'provider',
        rating: testReview.rating,
        title: testReview.title,
        comment: testReview.comment,
        photos: [],
        isVerified: true,
        helpfulVotes: 0,
        reportCount: 0,
        isHidden: false,
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      };

      await reviewsCollection.insertOne(review);

      // Update booking with review reference
      await bookingsCollection.updateOne(
        { _id: booking._id },
        { $set: { customerReview: review._id } }
      );

      // Add to recentReviews array for provider profile
      recentReviews.push({
        customerId: new mongoose.Types.ObjectId(customerId),
        bookingId: booking._id,
        serviceId: serviceForReviews._id,
        rating: testReview.rating,
        title: testReview.title,
        comment: testReview.comment,
        photos: [],
        isVerified: true,
        helpfulVotes: 0,
        createdAt: review.createdAt
      });

      console.log(`   ✅ Created review: ${testReview.customerName} - ${testReview.rating} stars`);
    }

    // Update provider profile with recent reviews
    const currentReviews = providerProfile.reviewsData?.recentReviews || [];
    const allReviews = [...recentReviews, ...currentReviews].slice(0, 20); // Keep max 20

    // Calculate new stats
    const allRatings = allReviews.map((r: any) => r.rating);
    const averageRating = allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length;
    const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    allRatings.forEach((r: number) => {
      ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
    });

    await db.collection('providerprofiles').updateOne(
      { _id: providerProfile._id },
      {
        $set: {
          'reviewsData.recentReviews': allReviews,
          'reviewsData.averageRating': Math.round(averageRating * 10) / 10,
          'reviewsData.totalReviews': allReviews.length,
          'reviewsData.ratingDistribution': ratingDistribution,
          'reviewsData.responseRate': 0,
          'reviewsData.avgResponseTime': 0
        }
      }
    );

    console.log('\n' + '='.repeat(60));
    console.log('✅ Seed Complete!');
    console.log('='.repeat(60));
    console.log(`   Reviews added: ${TEST_REVIEWS.length}`);
    console.log(`   Total reviews: ${allReviews.length}`);
    console.log(`   Average rating: ${averageRating.toFixed(1)}`);
    console.log();

    // Verify the update
    const updatedProfile = await db.collection('providerprofiles').findOne({ _id: providerProfile._id });
    console.log('📋 Updated Provider Profile:');
    console.log(`   recentReviews: ${updatedProfile?.reviewsData?.recentReviews?.length}`);
    console.log(`   averageRating: ${updatedProfile?.reviewsData?.averageRating}`);
    console.log(`   totalReviews: ${updatedProfile?.reviewsData?.totalReviews}`);

    await mongoose.disconnect();
    console.log('\n✅ Database connection closed.');

  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedReviews();
