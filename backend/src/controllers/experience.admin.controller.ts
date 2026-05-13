import { Request, Response } from 'express';
import Experience from '../models/experience.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Get All Experiences (All Statuses, Paginated)
 * GET /api/admin/experiences
 */
export const getAllExperiences = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '20',
    search,
    status,
    isFeatured,
    sortBy = 'createdAt',
    order = 'desc',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Build query
  const query: any = { isDeleted: false };

  if (status) {
    query.status = status;
  }

  if (isFeatured !== undefined) {
    query.isFeatured = isFeatured === 'true';
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Sort options
  const sortOptions: any = {};
  sortOptions[sortBy as string] = order === 'desc' ? -1 : 1;

  const [experiences, total] = await Promise.all([
    Experience.find(query)
      .populate('userId', 'firstName lastName email avatar')
      .populate('bookingId', 'scheduledDate bookingNumber')
      .populate('serviceId', 'name category')
      .populate('providerId', 'firstName lastName avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Experience.countDocuments(query),
  ]);

  // Get stats
  const stats = await Experience.getStats();

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
      stats,
    },
  });
});

/**
 * Get Experience By ID
 * GET /api/admin/experiences/:id
 */
export const getExperienceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const experience = await Experience.findById(id)
    .populate('userId', 'firstName lastName email avatar phone')
    .populate('bookingId', 'scheduledDate bookingNumber pricing totalAmount')
    .populate('serviceId', 'name category images')
    .populate('providerId', 'firstName lastName email avatar phone');

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
 * Update Experience (Admin Edit)
 * PUT /api/admin/experiences/:id
 */
export const updateExperience = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, rating, images, videoUrl, status, isFeatured, adminNotes } = req.body;

  const experience = await Experience.findById(id);

  if (!experience) {
    throw new ApiError(404, 'Experience not found');
  }

  // Update fields if provided
  if (title !== undefined) {
    if (title.length < 5 || title.length > 100) {
      throw new ApiError(400, 'Title must be between 5 and 100 characters');
    }
    experience.title = title;
  }

  if (description !== undefined) {
    if (description.length < 20 || description.length > 2000) {
      throw new ApiError(400, 'Description must be between 20 and 2000 characters');
    }
    experience.description = description;
  }

  if (rating !== undefined) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, 'Rating must be a whole number between 1 and 5');
    }
    experience.rating = rating;
  }

  if (images !== undefined) {
    if (images.length > 10) {
      throw new ApiError(400, 'Maximum 10 images allowed');
    }
    experience.images = images;
  }

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

  if (status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new ApiError(400, 'Invalid status');
    }
    experience.status = status;
  }

  if (isFeatured !== undefined) {
    experience.isFeatured = isFeatured;
  }

  if (adminNotes !== undefined) {
    experience.adminNotes = adminNotes;
  }

  await experience.save();

  // Populate and return
  await experience.populate([
    { path: 'userId', select: 'firstName lastName email avatar' },
    { path: 'serviceId', select: 'name category' },
    { path: 'providerId', select: 'firstName lastName avatar' },
    { path: 'bookingId', select: 'scheduledDate bookingNumber' },
  ]);

  return res.json({
    success: true,
    message: 'Experience updated successfully',
    data: {
      experience,
    },
  });
});

/**
 * Delete Experience (Hard Delete)
 * DELETE /api/admin/experiences/:id
 */
export const deleteExperience = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const experience = await Experience.findById(id);

  if (!experience) {
    throw new ApiError(404, 'Experience not found');
  }

  // Remove reference from booking
  await Booking.findByIdAndUpdate(experience.bookingId, {
    customerReview: null,
  });

  // Hard delete
  await Experience.findByIdAndDelete(id);

  return res.json({
    success: true,
    message: 'Experience permanently deleted',
  });
});

/**
 * Approve Experience
 * POST /api/admin/experiences/:id/approve
 */
export const approveExperience = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { notes } = req.body;

  const experience = await Experience.findById(id);

  if (!experience) {
    throw new ApiError(404, 'Experience not found');
  }

  if (experience.status === 'approved') {
    throw new ApiError(400, 'Experience is already approved');
  }

  experience.status = 'approved';
  if (notes) {
    experience.adminNotes = notes;
  }

  await experience.save();

  // Populate and return
  await experience.populate([
    { path: 'userId', select: 'firstName lastName email avatar' },
    { path: 'serviceId', select: 'name category' },
    { path: 'providerId', select: 'firstName lastName avatar' },
    { path: 'bookingId', select: 'scheduledDate bookingNumber' },
  ]);

  return res.json({
    success: true,
    message: 'Experience approved successfully',
    data: {
      experience,
    },
  });
});

/**
 * Reject Experience
 * POST /api/admin/experiences/:id/reject
 */
export const rejectExperience = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, notes } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const experience = await Experience.findById(id);

  if (!experience) {
    throw new ApiError(404, 'Experience not found');
  }

  if (experience.status === 'rejected') {
    throw new ApiError(400, 'Experience is already rejected');
  }

  experience.status = 'rejected';
  experience.adminNotes = `${reason}${notes ? ` - ${notes}` : ''}`;

  await experience.save();

  // Populate and return
  await experience.populate([
    { path: 'userId', select: 'firstName lastName email avatar' },
    { path: 'serviceId', select: 'name category' },
    { path: 'providerId', select: 'firstName lastName avatar' },
    { path: 'bookingId', select: 'scheduledDate bookingNumber' },
  ]);

  return res.json({
    success: true,
    message: 'Experience rejected',
    data: {
      experience,
    },
  });
});

/**
 * Toggle Featured Status
 * PATCH /api/admin/experiences/:id/featured
 */
export const toggleFeatured = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const experience = await Experience.findById(id);

  if (!experience) {
    throw new ApiError(404, 'Experience not found');
  }

  // Only approved experiences can be featured
  if (experience.status !== 'approved') {
    throw new ApiError(400, 'Only approved experiences can be featured');
  }

  experience.isFeatured = !experience.isFeatured;
  await experience.save();

  // Populate and return
  await experience.populate([
    { path: 'userId', select: 'firstName lastName avatar' },
    { path: 'serviceId', select: 'name category' },
    { path: 'providerId', select: 'firstName lastName avatar' },
    { path: 'bookingId', select: 'scheduledDate bookingNumber' },
  ]);

  return res.json({
    success: true,
    message: experience.isFeatured
      ? 'Experience is now featured on homepage'
      : 'Experience removed from featured',
    data: {
      experience,
    },
  });
});

/**
 * Bulk Action (Approve/Reject Multiple)
 * POST /api/admin/experiences/batch-action
 */
export const bulkAction = asyncHandler(async (req: Request, res: Response) => {
  const { experienceIds, action } = req.body;

  if (!experienceIds || !Array.isArray(experienceIds) || experienceIds.length === 0) {
    throw new ApiError(400, 'Experience IDs array is required');
  }

  if (!['approve', 'reject', 'delete', 'feature', 'unfeature'].includes(action)) {
    throw new ApiError(400, 'Invalid action. Must be one of: approve, reject, delete, feature, unfeature');
  }

  let result;
  let message;

  switch (action) {
    case 'approve':
      result = await Experience.updateMany(
        { _id: { $in: experienceIds }, isDeleted: false },
        { status: 'approved' }
      );
      message = `Successfully approved ${result.modifiedCount} experiences`;
      break;

    case 'reject':
      const { reason } = req.body;
      if (!reason) {
        throw new ApiError(400, 'Rejection reason is required for bulk rejection');
      }
      result = await Experience.updateMany(
        { _id: { $in: experienceIds }, isDeleted: false },
        { status: 'rejected', adminNotes: `Bulk rejection: ${reason}` }
      );
      message = `Successfully rejected ${result.modifiedCount} experiences`;
      break;

    case 'delete':
      // Hard delete
      await Experience.deleteMany({ _id: { $in: experienceIds } });
      result = { modifiedCount: experienceIds.length };
      message = `Successfully deleted ${experienceIds.length} experiences`;
      break;

    case 'feature':
      result = await Experience.updateMany(
        { _id: { $in: experienceIds }, status: 'approved', isDeleted: false },
        { isFeatured: true }
      );
      message = `Successfully featured ${result.modifiedCount} experiences`;
      break;

    case 'unfeature':
      result = await Experience.updateMany(
        { _id: { $in: experienceIds }, isDeleted: false },
        { isFeatured: false }
      );
      message = `Successfully unfeatured ${result.modifiedCount} experiences`;
      break;
  }

  return res.json({
    success: true,
    message,
    data: {
      modified: result?.modifiedCount || 0,
      total: experienceIds.length,
    },
  });
});

/**
 * Get Experience Statistics
 * GET /api/admin/experiences/stats
 */
export const getExperienceStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await Experience.getStats();

  // Recent submissions
  const recentSubmissions = await Experience.find({ isDeleted: false })
    .populate('userId', 'firstName lastName avatar')
    .populate('serviceId', 'name')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  // Top rated experiences
  const topRated = await Experience.find({
    status: 'approved',
    isDeleted: false,
  })
    .populate('userId', 'firstName lastName avatar')
    .populate('serviceId', 'name category')
    .sort({ rating: -1, createdAt: -1 })
    .limit(10)
    .lean();

  // Featured experiences
  const featuredExperiences = await Experience.find({
    status: 'approved',
    isFeatured: true,
    isDeleted: false,
  })
    .populate('userId', 'firstName lastName avatar')
    .populate('serviceId', 'name category')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return res.json({
    success: true,
    data: {
      stats,
      recentSubmissions,
      topRated,
      featuredExperiences,
    },
  });
});

/**
 * Get Experiences by User
 * GET /api/admin/experiences/user/:userId
 */
export const getExperiencesByUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const [experiences, total] = await Promise.all([
    Experience.find({ userId, isDeleted: false })
      .populate('bookingId', 'scheduledDate bookingNumber')
      .populate('serviceId', 'name category')
      .populate('providerId', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Experience.countDocuments({ userId, isDeleted: false }),
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
 * Get Experiences by Provider
 * GET /api/admin/experiences/provider/:providerId
 */
export const getExperiencesByProvider = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const [experiences, total] = await Promise.all([
    Experience.find({ providerId, isDeleted: false })
      .populate('userId', 'firstName lastName avatar')
      .populate('bookingId', 'scheduledDate bookingNumber')
      .populate('serviceId', 'name category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Experience.countDocuments({ providerId, isDeleted: false }),
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

export default {
  getAllExperiences,
  getExperienceById,
  updateExperience,
  deleteExperience,
  approveExperience,
  rejectExperience,
  toggleFeatured,
  bulkAction,
  getExperienceStats,
  getExperiencesByUser,
  getExperiencesByProvider,
};
