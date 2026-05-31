import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';

const router = Router();

// All routes require admin authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

/**
 * @route   GET /api/admin/stats/overview
 * @desc    Get platform overview stats
 * @access  Admin
 */
router.get('/stats/overview', asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalUsers,
    totalProviders,
    totalCustomers,
    totalBookings,
    totalServices,
    todayBookings,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'provider' }),
    User.countDocuments({ role: 'customer' }),
    Booking.countDocuments(),
    Service.countDocuments(),
    Booking.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  res.json({
    success: true,
    data: {
      users: { total: totalUsers, providers: totalProviders, customers: totalCustomers },
      bookings: { total: totalBookings, today: todayBookings },
      services: { total: totalServices },
      timestamp: new Date().toISOString(),
    },
  });
}));

/**
 * @route   GET /api/admin/system/health
 * @desc    Get system health status
 * @access  Admin
 */
router.get('/system/health', asyncHandler(async (_req: Request, res: Response) => {
  const memory = process.memoryUsage();
  const uptime = process.uptime();

  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: Math.floor(uptime),
      memory: {
        used: Math.round(memory.heapUsed / 1024 / 1024),
        total: Math.round(memory.heapTotal / 1024 / 1024),
        rss: Math.round(memory.rss / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
    },
  });
}));

/**
 * @route   GET /api/admin/bookings/recent
 * @desc    Get recent bookings for admin view
 * @access  Admin
 */
router.get('/bookings/recent', asyncHandler(async (req: Request, res: Response) => {
  const { limit = '20' } = req.query;

  const bookings = await Booking.find()
    .sort({ createdAt: -1 })
    .limit(parseInt(limit as string))
    .populate('customerId', 'firstName lastName email')
    .populate('providerId', 'firstName lastName email')
    .lean();

  res.json({
    success: true,
    data: { bookings },
  });
}));

/**
 * @route   GET /api/admin/users/recent
 * @desc    Get recent users for admin view
 * @access  Admin
 */
router.get('/users/recent', asyncHandler(async (req: Request, res: Response) => {
  const { limit = '20' } = req.query;

  const users = await User.find()
    .sort({ createdAt: -1 })
    .limit(parseInt(limit as string))
    .select('-password')
    .lean();

  res.json({
    success: true,
    data: { users },
  });
}));

/**
 * @route   GET /api/admin/activity/log
 * @desc    Get recent platform activity
 * @access  Admin
 */
router.get('/activity/log', asyncHandler(async (req: Request, res: Response) => {
  const { hours = '24' } = req.query;
  const hoursAgo = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000);

  const [bookings, newUsers] = await Promise.all([
    Booking.find({ createdAt: { $gte: hoursAgo } })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('bookingNumber status createdAt')
      .lean(),
    User.countDocuments({ createdAt: { $gte: hoursAgo } }),
  ]);

  res.json({
    success: true,
    data: {
      recentBookings: bookings,
      newUsersLast24h: newUsers,
      period: `${hours} hours`,
    },
  });
}));

export default router;
