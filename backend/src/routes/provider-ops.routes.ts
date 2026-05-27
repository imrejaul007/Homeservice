import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import Booking from '../models/booking.model';
import Review from '../models/review.model';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';

const router = Router();

// Apply authentication and admin role validation
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  // Get provider ID from authenticated user
  const providerId = (req as any).user?.id;

  // Fetch real stats from database based on providerId
  const [
    completedBookings,
    pendingBookings,
    reviews,
    services
  ] = await Promise.all([
    Booking.find({ providerId, status: 'completed' }).countDocuments(),
    Booking.find({ providerId, status: { $in: ['pending', 'confirmed'] } }).countDocuments(),
    Review.find({ providerId }),
    Service.find({ providerId, status: 'active' }).countDocuments()
  ]);

  // Calculate average rating
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  // Get earnings from completed bookings
  const bookings = await Booking.find({ providerId, status: 'completed' })
    .select('pricing')
    .lean();
  const totalEarnings = bookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);

  // Calculate quality metrics
  const responseRate = pendingBookings > 0 ? 95 : 100; // Placeholder - would need actual response tracking
  const acceptanceRate = completedBookings + pendingBookings > 0
    ? Math.round((completedBookings / (completedBookings + pendingBookings)) * 100)
    : 0;
  const qualityScore = services > 0 ? Math.min(100, Math.round((avgRating / 5) * 100 + services * 2)) : 0;

  res.json({
    totalEarnings,
    pendingPayout: 0, // Would need wallet integration
    completedBookings,
    pendingBookings,
    avgRating: Math.round(avgRating * 10) / 10,
    responseRate,
    acceptanceRate,
    qualityScore,
    activeServices: services,
  });
}));

export default router;
