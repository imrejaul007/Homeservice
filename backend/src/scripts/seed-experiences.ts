import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Experience from '../models/experience.model';
import Booking from '../models/booking.model';
import User from '../models/user.model';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/home_service_marketplace';

// Sample beauty/spa images from Unsplash (public domain)
const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800',
  'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800',
  'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=800',
  'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=800',
  'https://images.unsplash.com/photo-1526045478516-99145907023c?w=800',
  'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800',
  'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800',
  'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800',
  'https://images.unsplash.com/photo-1599687266725-0d4d52716b86?w=800',
];

const SAMPLE_EXPERIENCES = [
  {
    title: 'Absolutely Stunning Blowout for My Wedding Day',
    description: 'Sarah did an absolutely incredible job with my wedding day hair. I wanted soft waves with a natural curl pattern, and she exceeded all my expectations. The atmosphere was so relaxing, and she even gave me tips on how to maintain the style. My photos came out gorgeous, and I received so many compliments!',
    rating: 5,
  },
  {
    title: 'Best Gel Manicure I Have Ever Had',
    description: 'I have been getting gel manicures for years, but this was by far the best experience. The tech was incredibly detailed and precise. My nails lasted for over three weeks without any chipping. The salon was clean, and they used high-quality products. Will definitely be back every month!',
    rating: 5,
  },
  {
    title: 'Soothing Deep Tissue Massage',
    description: 'After a stressful week at work, I booked a deep tissue massage and it was exactly what I needed. The therapist identified all my tension points and worked them out perfectly. I left feeling like a new person. Highly recommend for anyone dealing with muscle pain or stress.',
    rating: 5,
  },
  {
    title: 'Perfect Balayage Highlights',
    description: 'I was nervous about getting balayage for the first time, but the colorist made me feel completely at ease. She took time to understand exactly what I wanted and the results are stunning. Natural, sun-kissed highlights that grow out beautifully. Love it!',
    rating: 4,
  },
  {
    title: 'Relaxing Facial with Amazing Results',
    description: 'The facial was incredibly relaxing, but what impressed me most was the visible results. My skin was glowing for days afterward. The esthetician was knowledgeable about different skin types and customized the treatment accordingly. Worth every penny.',
    rating: 5,
  },
  {
    title: 'Quick and Clean Eyebrow Shaping',
    description: 'Needed a last-minute eyebrow shape before an important meeting. The appointment was quick but thorough. Clean lines, perfect shape, and she even taught me how to maintain it at home. Exactly what I needed.',
    rating: 4,
  },
  {
    title: 'Luxurious Spa Day Experience',
    description: 'Booked the full spa package for my birthday and it was magical. From the moment I walked in, I was treated like royalty. The massage, facial, and manicure were all top-notch. A perfect way to celebrate and fully relax.',
    rating: 5,
  },
  {
    title: 'Great Kids Haircut Experience',
    description: 'As a mom, finding a stylist who can handle my active toddler is a game-changer. She was patient, gentle, and made the whole experience fun for my little one. The cut looks adorable and my daughter actually enjoyed getting her hair cut!',
    rating: 5,
  },
];

async function seedExperiences() {
  try {
    console.log('🌱 Starting experience seed...');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing experiences
    await Experience.deleteMany({});
    console.log('🗑️ Cleared existing experiences');

    // Get completed bookings with customers and services
    const completedBookings = await Booking.find({
      status: 'completed',
    })
      .populate('customerId', '_id firstName lastName avatar')
      .populate('serviceId', '_id name category')
      .populate('providerId', '_id firstName lastName avatar')
      .limit(10);

    if (completedBookings.length === 0) {
      console.log('⚠️ No completed bookings found. Creating sample experiences with mock data...');

      // Get any users and services to use as mock data
      const users = await User.find({ role: 'customer' }).limit(5);
      const providers = await User.find({ role: 'provider' }).limit(5);

      if (users.length === 0 || providers.length === 0) {
        console.log('❌ No users found. Please run user seed first.');
        process.exit(1);
      }

      // Create experiences with mock data
      const sampleData = SAMPLE_EXPERIENCES.slice(0, 6).map((exp, index) => ({
        userId: users[index % users.length]._id,
        bookingId: new mongoose.Types.ObjectId(), // Mock booking ID
        serviceId: new mongoose.Types.ObjectId(), // Mock service ID
        providerId: providers[index % providers.length]._id,
        images: SAMPLE_IMAGES.slice(index * 2, index * 2 + 2 + (Math.random() > 0.5 ? 1 : 0)),
        title: exp.title,
        description: exp.description,
        rating: exp.rating,
        status: index < 4 ? 'approved' : 'pending',
        isFeatured: index < 2,
      }));

      await Experience.insertMany(sampleData);
      console.log(`✅ Created ${sampleData.length} sample experiences`);
    } else {
      console.log(`📋 Found ${completedBookings.length} completed bookings`);

      // Check for existing experiences
      const existingExperienceBookingIds = await Experience.find({}, 'bookingId').lean();
      const existingBookingIds = new Set(
        existingExperienceBookingIds.map((e: any) => e.bookingId.toString())
      );

      // Filter out bookings that already have experiences
      const eligibleBookings = completedBookings.filter(
        (b: any) => !existingBookingIds.has(b._id.toString())
      );

      if (eligibleBookings.length === 0) {
        console.log('⚠️ All completed bookings already have experiences');
      } else {
        // Create experiences from real bookings
        const experiences: any[] = [];
        let featuredCount = 0;

        for (let i = 0; i < Math.min(eligibleBookings.length, SAMPLE_EXPERIENCES.length); i++) {
          const booking = eligibleBookings[i] as any;
          const sampleExp = SAMPLE_EXPERIENCES[i];

          // Random number of images (1-4)
          const numImages = Math.floor(Math.random() * 4) + 1;
          const startIndex = Math.floor(Math.random() * (SAMPLE_IMAGES.length - numImages));

          const status = Math.random() < 0.8 ? 'approved' : 'pending';
          const isFeatured = featuredCount < 3 && status === 'approved' && Math.random() < 0.5;

          if (isFeatured) featuredCount++;

          experiences.push({
            userId: booking.customerId?._id || booking.guestInfo?.email,
            bookingId: booking._id,
            serviceId: booking.serviceId?._id || booking.serviceId,
            providerId: booking.providerId?._id || booking.providerId,
            images: SAMPLE_IMAGES.slice(startIndex, startIndex + numImages),
            title: sampleExp.title,
            description: sampleExp.description,
            rating: sampleExp.rating,
            status,
            isFeatured,
          });
        }

        await Experience.insertMany(experiences);
        console.log(`✅ Created ${experiences.length} experiences from real bookings`);

        // Count featured
        const totalFeatured = await Experience.countDocuments({ isFeatured: true });
        console.log(`⭐ ${totalFeatured} experiences are featured`);
      }
    }

    // Print summary
    const stats = await Experience.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    console.log('\n📊 Experience Statistics:');
    const statusCounts = { total: 0, pending: 0, approved: 0, rejected: 0 };
    stats.forEach((s: any) => {
      console.log(`   ${s._id}: ${s.count}`);
      statusCounts[s._id as keyof typeof statusCounts] = s.count;
      statusCounts.total += s.count;
    });

    const featuredCount = await Experience.countDocuments({ isFeatured: true });
    console.log(`   featured: ${featuredCount}`);
    console.log(`   Total: ${statusCounts.total}`);

    console.log('\n✨ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run seed
seedExperiences()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
