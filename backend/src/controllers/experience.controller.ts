import { Request, Response } from 'express';
import Booking from '../models/booking.model';
import Experience from '../models/experience.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { escapeRegex } from '../utils/formatBookingListItem';

/** Extract Cloudinary URLs from multer-uploaded files */
function extractUploadedImageUrls(req: Request): string[] {
  if (!req.files || !Array.isArray(req.files)) return [];
  return (req.files as Express.Multer.File[]).map(
    (file) => (file as any).path || (file as any).secure_url || file.filename
  ).filter(Boolean);
}

/** Parse existing image URLs from multipart body */
function parseExistingImages(body: Record<string, unknown>): string[] {
  const raw = body.existingImages;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string') return [raw];
  return [];
}

function parseRating(value: unknown): number {
  const rating = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be a whole number between 1 and 5');
  }
  return rating;
}

function validateExperienceContent(title: string, description: string, rating: number, videoUrl?: string) {
  if (!title || title.length < 5 || title.length > 100) {
    throw new ApiError(400, 'Title must be between 5 and 100 characters');
  }
  if (!description || description.length < 20 || description.length > 2000) {
    throw new ApiError(400, 'Description must be between 20 and 2000 characters');
  }
  if (videoUrl) {
    try {
      new URL(videoUrl);
    } catch {
      throw new ApiError(400, 'Invalid video URL format');
    }
  }
}

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

  // Search by title or description (with regex escape for security)
  if (search) {
    const escapedSearch = escapeRegex(search as string);
    query.$or = [
      { title: { $regex: escapedSearch, $options: 'i' } },
      { description: { $regex: escapedSearch, $options: 'i' } },
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
 * Submit Experience (any authenticated customer; booking optional)
 * POST /api/experiences
 */
export const submitExperience = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const {
    bookingId: rawBookingId,
    title,
    description,
    rating: rawRating,
    videoUrl,
  } = req.body;

  if (!title || !description || rawRating === undefined || rawRating === null || rawRating === '') {
    throw new ApiError(400, 'Title, description, and rating are required');
  }

  const rating = parseRating(rawRating);
  const trimmedTitle = String(title).trim();
  const trimmedDescription = String(description).trim();
  const trimmedVideoUrl = videoUrl ? String(videoUrl).trim() : undefined;

  validateExperienceContent(trimmedTitle, trimmedDescription, rating, trimmedVideoUrl);

  const bookingId = rawBookingId && String(rawBookingId).trim() ? String(rawBookingId).trim() : undefined;
  let resolvedServiceId: string | undefined;
  let resolvedProviderId: string | undefined;

  if (bookingId) {
    const booking = await Booking.findOne({
      _id: bookingId,
      customerId: user._id,
    });

    if (!booking) {
      throw new ApiError(404, 'Booking not found or does not belong to you');
    }

    if (booking.status !== 'completed') {
      throw new ApiError(400, 'You can only link an experience to a completed booking');
    }

    const existingExperience = await Experience.findOne({
      bookingId,
      isDeleted: false,
    });

    if (existingExperience) {
      throw new ApiError(400, 'An experience has already been submitted for this booking');
    }

    resolvedServiceId = booking.serviceId?.toString();
    resolvedProviderId = booking.providerId?.toString();
  }

  const uploadedImages = extractUploadedImageUrls(req);
  const existingImages = parseExistingImages(req.body);
  const images = [...existingImages, ...uploadedImages];

  if (images.length > 10) {
    throw new ApiError(400, 'Maximum 10 images allowed');
  }

  const experience = new Experience({
    userId: user._id,
    ...(bookingId && { bookingId }),
    ...(resolvedServiceId && { serviceId: resolvedServiceId }),
    ...(resolvedProviderId && { providerId: resolvedProviderId }),
    title: trimmedTitle,
    description: trimmedDescription,
    rating,
    images,
    videoUrl: trimmedVideoUrl || undefined,
    status: 'pending',
    isFeatured: false,
  });

  await experience.save();

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
  const { title, description, rating: rawRating, videoUrl } = req.body;

  const experience = await Experience.findOne({
    _id: id,
    userId: user._id,
    isDeleted: false,
  });

  if (!experience) {
    throw new ApiError(404, 'Experience not found');
  }

  const daysSinceCreation = (Date.now() - experience.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation > 30) {
    throw new ApiError(400, 'Experiences can only be edited within 30 days of submission');
  }

  if (title !== undefined) {
    const trimmedTitle = String(title).trim();
    if (trimmedTitle.length < 5 || trimmedTitle.length > 100) {
      throw new ApiError(400, 'Title must be between 5 and 100 characters');
    }
    experience.title = trimmedTitle;
  }

  if (description !== undefined) {
    const trimmedDescription = String(description).trim();
    if (trimmedDescription.length < 20 || trimmedDescription.length > 2000) {
      throw new ApiError(400, 'Description must be between 20 and 2000 characters');
    }
    experience.description = trimmedDescription;
  }

  if (rawRating !== undefined && rawRating !== '') {
    experience.rating = parseRating(rawRating);
  }

  const uploadedImages = extractUploadedImageUrls(req);
  const existingImages = parseExistingImages(req.body);
  if (uploadedImages.length > 0 || existingImages.length > 0 || req.body.replaceImages === 'true') {
    const merged = existingImages.length > 0 || uploadedImages.length > 0
      ? [...existingImages, ...uploadedImages]
      : experience.images;
    if (merged.length > 10) {
      throw new ApiError(400, 'Maximum 10 images allowed');
    }
    experience.images = merged;
  }

  if (videoUrl !== undefined) {
    const trimmedVideoUrl = videoUrl ? String(videoUrl).trim() : '';
    if (trimmedVideoUrl) {
      try {
        new URL(trimmedVideoUrl);
      } catch {
        throw new ApiError(400, 'Invalid video URL format');
      }
    }
    experience.videoUrl = trimmedVideoUrl || undefined;
  }

  if (experience.status === 'approved' || experience.status === 'rejected') {
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
    status: 'approved',
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
  const bookings = paginatedBookings.map((booking) => {
    const service = booking.serviceId as any;
    const provider = booking.providerId as any;
    return {
      _id: booking._id,
      bookingNumber: booking.bookingNumber,
      service: service
        ? { _id: service._id, name: service.name }
        : { _id: '', name: 'Unknown service' },
      provider: provider
        ? {
            _id: provider._id,
            firstName: provider.firstName || '',
            lastName: provider.lastName || '',
          }
        : { _id: '', firstName: 'Unknown', lastName: 'Provider' },
      completedAt: booking.updatedAt,
      hasExperience: false,
    };
  });

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
