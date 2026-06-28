import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/rateLimit.middleware';
import {
  chat,
  getConversations,
  getConversation,
  deleteConversation,
  getAvailableAgents,
  getConversationStats,
  startConversationCleanup,
} from '../controllers/ai.controller';
import { IAAgent, IAAgentCategory, IAAgentType, IAAgentStatus } from '../models/iaAgent.model';
import Joi from 'joi';
import logger from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import mongoose from 'mongoose';

// Start conversation cleanup on module load (runs in background)
startConversationCleanup();

const router = Router();
// Note: Individual routes below have explicit authenticate middleware for security clarity

// AI Chat rate limiter - prevent abuse of AI chat endpoint (issue #8)
const aiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: 'Too many chat requests, please slow down'
});

// Validation helper for MongoDB ObjectId
const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

// Dynamic imports to avoid circular dependencies
const getModels = async () => {
  const Booking = (await import('../models/booking.model')).default;
  const Service = (await import('../models/service.model')).default;
  const User = (await import('../models/user.model')).default;
  const ProviderProfile = (await import('../models/providerProfile.model')).default;
  return { Booking, Service, User, ProviderProfile };
};

/**
 * Get Business Insights
 * GET /api/ai/insights
 * Generates real insights from booking data
 * @access Admin
 */
router.get('/insights', authenticate, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const { Booking, Service } = await getModels();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get booking statistics
    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      recentBookings
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.find({ createdAt: { $gte: thirtyDaysAgo } })
        .populate('service', 'name category')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    // Calculate revenue (completed bookings)
    const completedWithPrice = await Booking.find({ status: 'completed' })
      .select('pricing.totalAmount');
    const totalRevenue = completedWithPrice.reduce(
      (sum: number, b: any) => sum + (b.pricing?.totalAmount || 0),
      0
    );

    // Get top performing services with single aggregation (fixes N+1 query)
    const topServices = await Booking.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: { _id: '$serviceId', count: { $sum: 1 } }
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'service'
        }
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          service: { $ifNull: ['$service.name', 'Unknown'] },
          category: { $ifNull: ['$service.category', 'Unknown'] },
          bookings: '$count'
        }
      }
    ]);

    // Calculate trends
    const completionRate = totalBookings > 0
      ? Math.round((completedBookings / totalBookings) * 100)
      : 0;
    const cancellationRate = totalBookings > 0
      ? Math.round((cancelledBookings / totalBookings) * 100)
      : 0;

    // Generate insights
    const insights: Array<{type: string; title: string; description: string; recommendation: string}> = [];

    if (completionRate >= 80) {
      insights.push({
        type: 'positive',
        title: 'High Completion Rate',
        description: `${completionRate}% of bookings are completed successfully.`,
        recommendation: 'Great job! Focus on reducing cancellation rate to improve further.'
      });
    } else if (completionRate < 50) {
      insights.push({
        type: 'warning',
        title: 'Low Completion Rate',
        description: `Only ${completionRate}% of bookings are completed.`,
        recommendation: 'Consider adding reminders or making booking easier to reduce drop-offs.'
      });
    }

    if (pendingBookings > completedBookings) {
      insights.push({
        type: 'info',
        title: 'High Pending Bookings',
        description: `${pendingBookings} bookings are awaiting action.`,
        recommendation: 'Review pending bookings to ensure timely responses.'
      });
    }

    if (totalRevenue > 10000) {
      insights.push({
        type: 'positive',
        title: 'Strong Revenue',
        description: `Total revenue: AED ${totalRevenue.toLocaleString()}`,
        recommendation: 'Consider scaling successful services.'
      });
    }

    if (topServices.length > 0) {
      insights.push({
        type: 'info',
        title: 'Top Performing Services',
        description: `"${topServices[0]?.service}" has the most bookings.`,
        recommendation: 'Ensure adequate staffing for popular services.'
      });
    }

    res.json({
      success: true,
      data: {
        stats: {
          totalBookings,
          completedBookings,
          cancelledBookings,
          pendingBookings,
          completionRate,
          cancellationRate,
          totalRevenue
        },
        topServices,
        insights,
        recentBookings: recentBookings.map((b: any) => ({
          id: b._id,
          service: b.service?.name,
          status: b.status,
          createdAt: b.createdAt
        }))
      }
    });
  } catch (error) {
    logger.error('AI Insights Error', {
      context: 'AIRoutes',
      action: 'AI_INSIGHTS_ERROR',
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to generate insights'
    });
  }
});

/**
 * Get Provider Score
 * GET /api/ai/provider/:id/score
 * Calculates real provider score from performance metrics
 * @access Provider (own) or Admin
 *
 * Issue #3 fix: Stricter role validation - provider can only access their own score
 * Admin can access any provider's score.
 */
router.get('/provider/:id/score', authenticate, requireRole(['admin', 'provider']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Issue #3 fix: Add explicit ObjectId format validation for :id parameter
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider ID format'
      });
    }

    const user = (req as any).user;

    // Issue #3 fix: Stricter ownership check
    // Admin can view any provider's score, but providers can only view their own
    if (user.role === 'provider' && user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own score.'
      });
    }

    const { Booking, ProviderProfile } = await getModels();

    // FIX #8: Use aggregation pipeline instead of fetching all bookings and filtering in memory
    const bookingStats = await Booking.aggregate([
      { $match: { providerId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          respondedBookings: {
            $sum: {
              $cond: [
                { $in: ['$status', ['confirmed', 'completed']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const stats = bookingStats[0] || { totalBookings: 0, completedBookings: 0, respondedBookings: 0 };
    const totalBookings = stats.totalBookings;

    // Get provider profile for reviews
    const providerProfile = await ProviderProfile.findOne({ userId: id });
    const reviewsData = providerProfile?.reviewsData?.recentReviews || [];
    const averageRating = reviewsData.length > 0
      ? reviewsData.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewsData.length
      : 0;

    if (totalBookings === 0 && reviewsData.length === 0) {
      res.json({
        success: true,
        data: {
          providerId: id,
          score: 0.5,
          grade: 'C',
          totalBookings: 0,
          completionRate: 0,
          rating: 0,
          responseRate: 0,
          recentBookings: 0,
          recommendation: 'Start taking bookings to build your score.'
        }
      });
      return;
    }

    // FIX #8: Use aggregation pipeline for activity calculation instead of in-memory filtering
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activityStats = await Booking.aggregate([
      {
        $match: {
          providerId: new mongoose.Types.ObjectId(id),
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $count: 'recentBookings'
      }
    ]);

    const recentBookings = activityStats[0]?.recentBookings || 0;

    // Calculate completion rate (30% weight) using aggregated stats
    const completionRate = totalBookings > 0
      ? (stats.completedBookings / totalBookings) * 100
      : 0;

    // Calculate response rate (20% weight) - based on booking acceptance using aggregated stats
    const responseRate = totalBookings > 0
      ? (stats.respondedBookings / totalBookings) * 100
      : 0;

    // Activity level (10% weight) - bookings in last 30 days
    const activityLevel = Math.min((recentBookings / 10) * 100, 100);

    // Calculate weighted score
    const score = (
      (completionRate * 0.3) +
      (averageRating * 20) + // Scale 0-5 to 0-100
      (responseRate * 0.2) +
      (activityLevel * 0.1)
    ) / 100;

    // Determine grade
    let grade: string;
    let recommendation: string;

    if (score >= 0.9) {
      grade = 'A+';
      recommendation = 'Outstanding performance! Keep up the excellent work.';
    } else if (score >= 0.8) {
      grade = 'A';
      recommendation = 'Great performance! Focus on maintaining quality.';
    } else if (score >= 0.7) {
      grade = 'B';
      recommendation = 'Good performance. Consider improving response times.';
    } else if (score >= 0.5) {
      grade = 'C';
      recommendation = 'Average performance. Focus on completing more bookings.';
    } else {
      grade = 'D';
      recommendation = 'Needs improvement. Focus on customer satisfaction and completion rate.';
    }

    res.json({
      success: true,
      data: {
        providerId: id,
        score: Math.round(score * 100) / 100,
        grade,
        totalBookings,
        completionRate: Math.round(completionRate),
        rating: Math.round(averageRating * 10) / 10,
        responseRate: Math.round(responseRate),
        recentBookings,
        reviewCount: reviewsData.length,
        recommendation
      }
    });
    return;
  } catch (error) {
    logger.error('Provider Score Error', {
      context: 'AIRoutes',
      action: 'PROVIDER_SCORE_ERROR',
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to calculate provider score'
    });
    return;
  }
});

/**
 * Get User Churn Risk
 * GET /api/ai/user/:id/churn-risk
 * Calculates churn risk based on user behavior
 * @access Admin
 */
router.get('/user/:id/churn-risk', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { User, Booking } = await getModels();

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // FIX #9: Use aggregation pipeline instead of fetching all bookings and filtering in memory
    const bookingsAggregation = await Booking.aggregate([
      { $match: { customerId: new mongoose.Types.ObjectId(id) } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: null,
          bookings: { $push: { createdAt: '$createdAt', status: '$status' } },
          totalBookings: { $sum: 1 },
          lastBooking: { $first: '$createdAt' },
          firstBooking: { $last: '$createdAt' }
        }
      }
    ]);

    const aggregation = bookingsAggregation[0];
    const bookings = aggregation?.bookings || [];
    const totalBookings = aggregation?.totalBookings || 0;

    // No bookings = high churn risk
    if (totalBookings === 0) {
      res.json({
        success: true,
        data: {
          userId: id,
          riskScore: 0.8,
          riskLevel: 'high',
          factors: ['No booking history'],
          lastBookingDate: null,
          daysSinceLastBooking: null,
          totalBookings: 0,
          recommendation: 'Engage with welcome offers or tutorials.'
        }
      });
      return;
    }

    // FIX #9: Use aggregated data for calculations instead of in-memory filtering
    const lastBookingDate = aggregation.lastBooking;
    const firstBookingDate = aggregation.firstBooking;

    // Calculate days since last booking
    const daysSinceLastBooking = lastBookingDate
      ? Math.floor((Date.now() - new Date(lastBookingDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Calculate booking frequency
    const daysSinceFirstBooking = firstBookingDate
      ? Math.floor((Date.now() - new Date(firstBookingDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const averageDaysBetweenBookings = daysSinceFirstBooking / Math.max(totalBookings - 1, 1);

    // Check engagement decline
    let engagementDecline = 0;
    if (totalBookings >= 3) {
      const recentBookings = bookings.slice(0, Math.ceil(totalBookings / 2));
      const olderBookings = bookings.slice(Math.ceil(totalBookings / 2));
      const recentCount = recentBookings.length;
      const olderCount = olderBookings.length;

      if (olderCount > recentCount) {
        engagementDecline = ((olderCount - recentCount) / olderCount) * 100;
      }
    }

    // Calculate churn risk score
    let riskScore = 0;

    // Days since last booking (40% weight)
    if (daysSinceLastBooking > 60) riskScore += 0.4;
    else if (daysSinceLastBooking > 30) riskScore += 0.3;
    else if (daysSinceLastBooking > 14) riskScore += 0.2;
    else if (daysSinceLastBooking > 7) riskScore += 0.1;

    // Booking frequency decline (30% weight)
    if (averageDaysBetweenBookings > 30) riskScore += 0.3;
    else if (averageDaysBetweenBookings > 14) riskScore += 0.2;
    else if (averageDaysBetweenBookings > 7) riskScore += 0.1;

    // Engagement decline (30% weight)
    if (engagementDecline > 50) riskScore += 0.3;
    else if (engagementDecline > 30) riskScore += 0.2;
    else if (engagementDecline > 10) riskScore += 0.1;

    // Determine risk level and recommendation
    let riskLevel: string;
    let recommendation: string;

    if (riskScore >= 0.7) {
      riskLevel = 'high';
      recommendation = 'Send re-engagement campaign with special offers.';
    } else if (riskScore >= 0.4) {
      riskLevel = 'medium';
      recommendation = 'Consider personalized recommendations.';
    } else {
      riskLevel = 'low';
      recommendation = 'User is engaged. Continue regular communication.';
    }

    const factors: string[] = [];
    if (daysSinceLastBooking > 14) factors.push('Inactive for 2+ weeks');
    if (averageDaysBetweenBookings > 14) factors.push('Booking frequency declining');
    if (engagementDecline > 30) factors.push('Significant engagement decline');

    res.json({
      success: true,
      data: {
        userId: id,
        riskScore: Math.round(riskScore * 100) / 100,
        riskLevel,
        factors,
        lastBookingDate: lastBookingDate,
        daysSinceLastBooking,
        totalBookings,
        recommendation
      }
    });
  } catch (error) {
    logger.error('Churn Risk Error', {
      context: 'AIRoutes',
      action: 'CHURN_RISK_ERROR',
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      message: 'Failed to calculate churn risk'
    });
  }
});

// ============================================
// Customer AI Chat Routes
// All endpoints require authentication
// ============================================

// Send message to AI assistant
// @access Authenticated users
// @security Input validation, message length limits, conversation ownership check, rate limiting
router.post('/chat', aiLimiter, authenticate, asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const message = req.body.message;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Message is required and must be a string'
    });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot be empty'
    });
  }

  if (message.length > 2000) {
    return res.status(400).json({
      success: false,
      message: 'Message exceeds maximum length of 2000 characters'
    });
  }

  // Delegate to controller (already has auth/user check and IDOR protection)
  return chat(req, res);
}));

// Get all conversations for authenticated user
// @access Authenticated users - returns only their own conversations
// @security Controller filters by userId - no IDOR risk
router.get('/conversations', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;

  logger.info('Fetching conversations', {
    context: 'AIRoutes',
    action: 'GET_CONVERSATIONS',
    userId: user._id.toString()
  });

  // Controller already filters by userId
  return getConversations(req, res);
});

// Get single conversation with IDOR protection
// @access Authenticated users - controller verifies ownership
// @security Controller validates conversation ownership
router.get('/conversations/:conversationId', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { conversationId } = req.params;

  // Validate ObjectId format
  if (!isValidObjectId(conversationId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid conversation ID format'
    });
  }

  logger.info('Fetching conversation', {
    context: 'AIRoutes',
    action: 'GET_CONVERSATION',
    userId: user._id.toString(),
    conversationId
  });

  // Controller verifies ownership before returning data
  return getConversation(req, res);
});

// Delete conversation with IDOR protection
// @access Authenticated users - controller verifies ownership
// @security Controller validates conversation ownership
router.delete('/conversations/:conversationId', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { conversationId } = req.params;

  // Validate ObjectId format
  if (!isValidObjectId(conversationId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid conversation ID format'
    });
  }

  logger.info('Deleting conversation', {
    context: 'AIRoutes',
    action: 'DELETE_CONVERSATION',
    userId: user._id.toString(),
    conversationId
  });

  // Controller verifies ownership before deletion
  return deleteConversation(req, res);
});

// Get conversation statistics for authenticated user
// @access Authenticated users - returns stats for their conversations
router.get('/conversations/stats', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;

  logger.info('Fetching conversation stats', {
    context: 'AIRoutes',
    action: 'GET_CONVERSATION_STATS',
    userId: user._id.toString(),
  });

  return getConversationStats(req, res);
});

// ============================================
// Available Agents for Chat
// GET /api/ai/agents/available
// Returns deployed agents that can be used for chat
// ============================================
router.get('/agents/available', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query;

  const filter: Record<string, unknown> = {
    status: IAAgentStatus.Deployed,
    isActive: true,
  };

  if (category && Object.values(IAAgentCategory).includes(category as IAAgentCategory)) {
    filter.category = category;
  }

  const agents = await IAAgent.find(filter)
    .select('_id name description category type version')
    .lean();

  res.json({
    success: true,
    data: { agents },
  });
}));

export default router;
