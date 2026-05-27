import { Request, Response } from 'express';
import Booking from '../models/booking.model';
import Experience from '../models/experience.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Get Public Experiences (Paginated, Approved Only)
 * GET /api/experiences
 */
export const getPublicExperiences = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '10',
    serviceId,
    providerId,
    minRating,
    search,
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Build query
  const query: any = {
    status: 'approved',
    isDeleted: false,
  };

  if (serviceId) {
    query.serviceId = serviceId;
  }

  if (providerId) {
    query.providerId = providerId;
  }

  if (minRating) {
    query.rating = { $gte: parseInt(minRating as string, 10) };
  }

  // Search by title or description
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const [experiences, total] = await Promise.all([
    Experience.find(query)
      .populate('userId', 'firstName lastName avatar')
      .populate('bookingId', 'scheduledDate')
      .populate('serviceId', 'name category images')
      .populate('providerId', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Experience.countDocuments(query),
  ]);

  // Calculate rating distribution (with search filter)
  const statsMatchQuery: any = { status: 'approved', isDeleted: false };
  if (serviceId) statsMatchQuery.serviceId = require('mongoose').Types.ObjectId.createFromHexString(serviceId as string);
  if (minRating) statsMatchQuery.rating = { $gte: parseInt(minRating as string, 10) };
  if (search) {
    statsMatchQuery.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const ratingDistribution = await Experience.aggregate([
    { $match: statsMatchQuery },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingDistribution.forEach((item) => {
    if (item._id >= 1 && item._id <= 5) {
      distribution[item._id as keyof typeof distribution] = item.count;
    }
  });

  // Calculate average rating (with search filter)
  const avgResult = await Experience.aggregate([
    { $match: statsMatchQuery },
    { $group: { _id: null, avgRating: { $avg: '$rating' } } },
  ]);

  const averageRating = avgResult[0]?.avgRating || 0;

  return res.json({
    success: true,
    data: {
      experiences,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
      stats: {
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution: distribution,
      },
    },
  });
});

/**
 * Get Featured Experiences (Curated for Homepage)
 * GET /api/experiences/featured
 */
export const getFeaturedExperiences = asyncHandler(async (req: Request, res: Response) => {
  const { limit = '10' } = req.query;
  const limitNum = Math.min(parseInt(limit as string, 10), 20);

  const experiences = await Experience.findFeatured(limitNum);

  // If not enough featured, get top-rated approved experiences
  if (experiences.length < limitNum) {
    const featuredIds = experiences.map((exp: any) => exp._id);
    const additional = await Experience.find({
      status: 'approved',
      isDeleted: false,
      _id: { $nin: featuredIds },
    })
      .populate('userId', 'firstName lastName avatar')
      .populate('serviceId', 'name category images')
      .populate('providerId', 'firstName lastName avatar')
      .sort({ rating: -1, createdAt: -1 })
      .limit(limitNum - experiences.length)
      .lean();

    experiences.push(...additional);
  }

  return res.json({
    success: true,
    data: {
      experiences,
      total: experiences.length,
    },
  });
});

/**
 * Get My Experiences (User's Submissions)
 * GET /api/experiences/my
 */
export const getMyExperiences = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const [experiences, total] = await Promise.all([
    Experience.find({ userId: user._id, isDeleted: false })
      .populate('bookingId', 'scheduledDate bookingNumber')
      .populate('serviceId', 'name category')
      .populate('providerId', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Experience.countDocuments({ userId: user._id, isDeleted: false }),
  ]);

  return res.json({
    success: true,
    data: {
      experiences,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    },
  });
});

/**
 * Check if experience exists for a booking
 * GET /api/experiences/check/:bookingId
 */
export const checkExperienceExists = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const user = req.user as any;

  if (!user) {
    return res.json({ success: true, data: { exists: false } });
  }

  const existingExperience = await Experience.findOne({
    bookingId,
    userId: user._id,
    isDeleted: false,
  });

  return res.json({
    success: true,
    data: {
      exists: !!existingExperience,
      experienceId: existingExperience?._id,
    },
  });
});

/**
 * Submit Experience (For Completed Booking)
 * POST /api/experiences
 */
export const submitExperience = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { bookingId, serviceId, providerId, title, description, rating, images, videoUrl } = req.body;

  // Validate required fields
  if (!bookingId) {
    throw new ApiError(400, 'Booking ID is required');
  }

  if (!serviceId) {
    throw new ApiError(400, 'Service ID is required');
  }

  if (!providerId) {
    throw new ApiError(400, 'Provider ID is required');
  }

  if (!title) {
    throw new ApiError(400, 'Title is required');
  }

  if (!description) {
    throw new ApiError(400, 'Description is required');
  }

  if (rating === undefined || rating === null) {
    throw new ApiError(400, 'Rating is required');
  }

  // Validate title length
  if (title.length < 5 || title.length > 100) {
    throw new ApiError(400, 'Title must be between 5 and 100 characters');
  }

  // Validate description length
  if (description.length < 20 || description.length > 2000) {
    throw new ApiError(400, 'Description must be between 20 and 2000 characters');
  }

  // Validate rating
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be a whole number between 1 and 5');
  }

  // Validate images count
  if (images && images.length > 10) {
    throw new ApiError(400, 'Maximum 10 images allowed');
  }

  // Validate video URL format if provided
  if (videoUrl) {
    try {
      new URL(videoUrl);
    } catch {
      throw new ApiError(400, 'Invalid video URL format');
    }
  }

  // Check if booking exists and belongs to user
  const booking = await Booking.findOne({
    _id: bookingId,
    customerId: user._id,
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found or does not belong to you');
  }

  // Check if booking is completed
  if (booking.status !== 'completed') {
    throw new ApiError(400, 'You can only submit an experience for a completed booking');
  }

  // Check if experience already exists for this booking
  const existingExperience = await Experience.findOne({
    bookingId,
    isDeleted: false,
  });

  if (existingExperience) {
    throw new ApiError(400, 'An experience has already been submitted for this booking');
  }

  // Create the experience
  const experience = new Experience({
    userId: user._id,
    bookingId,
    serviceId,
    providerId,
    title,
    description,
    rating,
    images: images || [],
    videoUrl: videoUrl || undefined,
    status: 'pending',
    isFeatured: false,
  });

  await experience.save();

  // Update booking to reference the experience
  booking.customerReview = experience._id as any;
  await booking.save();

  // Populate and return
  await experience.populate([
    { path: 'serviceId', select: 'name category' },
    { path: 'providerId', select: 'firstName lastName avatar' },
    { path: 'bookingId', select: 'scheduledDate bookingNumber' },
  ]);

  return res.status(201).json({
    success: true,
    message: 'Experience submitted successfully. It will be reviewed before publishing.',
    data: {
      experience,
    },
  });
});

/**
 * Update Experience (Within 30 Days)
 * PUT /api/experiences/:id
 */
export const updateExperience = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { id } = req.params;
  const { title, description, rating, images, videoUrl } = req.body;

  // Find the experience
  const experience = await Experience.findOne({
    _id: id,
    userId: user._id,
    isDeleted: false,
  });

  if (!experience) {
    throw new ApiError(404, 'Experience not found');
  }

  // Check if within 30 days of creation
  const daysSinceCreation = (Date.now() - experience.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation > 30) {
    throw new ApiError(400, 'Experiences can only be edited within 30 days of submission');
  }

  // Validate title length if provided
  if (title !== undefined) {
    if (title.length < 5 || title.length > 100) {
      throw new ApiError(400, 'Title must be between 5 and 100 characters');
    }
    experience.title = title;
  }

  // Validate description length if provided
  if (description !== undefined) {
    if (description.length < 20 || description.length > 2000) {
      throw new ApiError(400, 'Description must be between 20 and 2000 characters');
    }
    experience.description = description;
  }

  // Validate rating if provided
  if (rating !== undefined) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, 'Rating must be a whole number between 1 and 5');
    }
    experience.rating = rating;
  }

  // Validate images count if provided
  if (images !== undefined) {
    if (images.length > 10) {
      throw new ApiError(400, 'Maximum 10 images allowed');
    }
    experience.images = images;
  }

  // Validate video URL format if provided
  if (videoUrl !== undefined) {
    if (videoUrl) {
      try {
        new URL(videoUrl);
      } catch {
        throw new ApiError(400, 'Invalid video URL format');
      }
    }
    experience.videoUrl = videoUrl || undefined;
  }

  // If experience was approved, reset to pending for re-review
  if (experience.status === 'approved') {
    experience.status = 'pending';
    experience.isFeatured = false;
  }

  await experience.save();

  // Populate and return
  await experience.populate([
    { path: 'serviceId', select: 'name category' },
    { path: 'providerId', select: 'firstName lastName avatar' },
    { path: 'bookingId', select: 'scheduledDate bookingNumber' },
  ]);

  return res.json({
    success: true,
    message: experience.status === 'pending'
      ? 'Experience updated and resubmitted for review'
      : 'Experience updated successfully',
    data: {
      experience,
    },
  });
});

/**
 * Delete Experience (Soft Delete)
 * DELETE /api/experiences/:id
 */
export const deleteExperience = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { id } = req.params;

  // Find the experience
  const experience = await Experience.findOne({
    _id: id,
    userId: user._id,
    isDeleted: false,
  });

  if (!experience) {
    throw new ApiError(404, 'Experience not found');
  }

  // Soft delete
  await experience.softDelete();

  // Remove reference from booking
  await Booking.findByIdAndUpdate(experience.bookingId, {
    customerReview: null,
  });

  return res.json({
    success: true,
    message: 'Experience deleted successfully',
  });
});

/**
 * Get Single Experience (Public)
 * GET /api/experiences/:id
 */
export const getExperienceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const experience = await Experience.findOne({
    _id: id,
    isDeleted: false,
  })
    .populate('userId', 'firstName lastName avatar')
    .populate('bookingId', 'scheduledDate bookingNumber')
    .populate('serviceId', 'name category images')
    .populate('providerId', 'firstName lastName avatar')
    .lean();

  if (!experience) {
    throw new ApiError(404, 'Experience not found');
  }

  return res.json({
    success: true,
    data: {
      experience,
    },
  });
});

/**
 * Get Available Bookings for Experience Submission
 * GET /api/experiences/available-bookings
 *
 * Returns completed bookings that don't have an experience submitted yet
 */
export const getAvailableBookings = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Get all completed bookings for this user
  const completedBookings = await Booking.find({
    customerId: user._id,
    status: 'completed',
  })
    .populate('serviceId', 'name category images')
    .populate('providerId', 'firstName lastName avatar')
    .sort({ updatedAt: -1 })
    .lean();

  // Get existing experience submissions
  const existingExperiences = await Experience.find({
    userId: user._id,
    isDeleted: false,
  }).select('bookingId');

  const submittedBookingIds = new Set(
    existingExperiences.map(e => e.bookingId?.toString())
  );

  // Filter out bookings that already have an experience
  const availableBookings = completedBookings.filter(
    booking => !submittedBookingIds.has(booking._id.toString())
  );

  // Paginate
  const paginatedBookings = availableBookings.slice(skip, skip + limitNum);

  // Transform to response format
  const bookings = paginatedBookings.map(booking => ({
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    service: booking.serviceId
      ? {
          id: (booking.serviceId as any)._id,
          name: (booking.serviceId as any).name,
          category: (booking.serviceId as any).category,
          images: (booking.serviceId as any).images,
        }
      : null,
    provider: booking.providerId
      ? {
          id: (booking.providerId as any)._id,
          name: `${(booking.providerId as any).firstName || ''} ${(booking.providerId as any).lastName || ''}`.trim(),
          avatar: (booking.providerId as any).avatar,
        }
      : null,
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    completedAt: booking.updatedAt,
    hasReview: !!(booking as any).customerReview,
  }));

  return res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: availableBookings.length,
        pages: Math.ceil(availableBookings.length / limitNum),
        hasNext: pageNum * limitNum < availableBookings.length,
        hasPrev: pageNum > 1,
      },
    },
  });
});

export default {
  getPublicExperiences,
  getFeaturedExperiences,
  getMyExperiences,
  checkExperienceExists,
  submitExperience,
  updateExperience,
  deleteExperience,
  getExperienceById,
  getAvailableBookings,
};
