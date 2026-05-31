import mongoose, { Types, Document } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Type Definitions
// ============================================

export type PhotoPrivacy = 'public' | 'private' | 'shared';
export type PhotoStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'deleted';
export type PairingStatus = 'pending' | 'approved' | 'rejected';

export interface PhotoMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  camera?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  takenAt?: Date;
}

export interface Photo {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  bookingId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  metadata: PhotoMetadata;
  privacy: PhotoPrivacy;
  status: PhotoStatus;
  tags?: string[];
  sharedWith?: Types.ObjectId[];
  views: number;
  likes: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BeforeAfterPairing {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  beforePhotoId: Types.ObjectId;
  afterPhotoId: Types.ObjectId;
  bookingId?: Types.ObjectId;
  status: PairingStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  transformation?: {
    description: string;
    improvement?: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PhotoGallery {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  description?: string;
  coverPhotoId?: Types.ObjectId;
  photoIds: Types.ObjectId[];
  isPublic: boolean;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UploadPhotoInput {
  userId: string;
  bookingId?: string;
  serviceId?: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  metadata: PhotoMetadata;
  privacy?: PhotoPrivacy;
  tags?: string[];
}

export interface CreatePairingInput {
  userId: string;
  beforePhotoId: string;
  afterPhotoId: string;
  bookingId?: string;
  transformation?: {
    description: string;
    improvement?: number;
  };
}

// ============================================
// Mongoose Interfaces
// ============================================

interface IPhoto extends Document, Omit<Photo, '_id'> {}
interface IBeforeAfterPairing extends Document, Omit<BeforeAfterPairing, '_id'> {}
interface IPhotoGallery extends Document, Omit<PhotoGallery, '_id'> {}

// ============================================
// Mongoose Schemas
// ============================================

const PhotoMetadataSchema = new mongoose.Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  format: { type: String, required: true },
  size: { type: Number, required: true },
  camera: { type: String },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  takenAt: { type: Date },
}, { _id: false });

const PhotoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  url: { type: String, required: true },
  thumbnailUrl: { type: String },
  caption: { type: String, maxlength: 500 },
  metadata: { type: PhotoMetadataSchema, required: true },
  privacy: { type: String, enum: ['public', 'private', 'shared'], default: 'private' },
  status: { type: String, enum: ['uploading', 'processing', 'ready', 'failed', 'deleted'], default: 'ready' },
  tags: [{ type: String }],
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'photos',
});

PhotoSchema.index({ userId: 1, createdAt: -1 });
PhotoSchema.index({ bookingId: 1 });
PhotoSchema.index({ serviceId: 1 });
PhotoSchema.index({ privacy: 1 });
PhotoSchema.index({ tags: 1 });

const TransformationSchema = new mongoose.Schema({
  description: { type: String, required: true },
  improvement: { type: Number, min: 0, max: 100 },
}, { _id: false });

const BeforeAfterPairingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  beforePhotoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Photo', required: true },
  afterPhotoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Photo', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectionReason: { type: String },
  transformation: { type: TransformationSchema },
}, {
  timestamps: true,
  collection: 'before_after_pairings',
});

BeforeAfterPairingSchema.index({ userId: 1, createdAt: -1 });
BeforeAfterPairingSchema.index({ bookingId: 1 });
BeforeAfterPairingSchema.index({ status: 1 });

const PhotoGallerySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  coverPhotoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Photo' },
  photoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Photo' }],
  isPublic: { type: Boolean, default: false },
  tags: [{ type: String }],
}, {
  timestamps: true,
  collection: 'photo_galleries',
});

PhotoGallerySchema.index({ userId: 1, createdAt: -1 });
PhotoGallerySchema.index({ isPublic: 1 });

// ============================================
// Model Registration
// ============================================

export const PhotoModel = mongoose.models.Photo || mongoose.model<IPhoto>('Photo', PhotoSchema);
export const BeforeAfterPairingModel = mongoose.models.BeforeAfterPairing ||
  mongoose.model<IBeforeAfterPairing>('BeforeAfterPairing', BeforeAfterPairingSchema);
export const PhotoGalleryModel = mongoose.models.PhotoGallery ||
  mongoose.model<IPhotoGallery>('PhotoGallery', PhotoGallerySchema);

// ============================================
// Service Class
// ============================================

export class PhotoSharingService {

  // ========================================
  // Photo Upload
  // ========================================

  /**
   * Upload a photo
   */
  async uploadPhoto(input: UploadPhotoInput): Promise<IPhoto> {
    const { userId, bookingId, serviceId, url, thumbnailUrl, caption, metadata, privacy, tags } = input;

    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const photo = new PhotoModel({
      userId: new Types.ObjectId(userId),
      bookingId: bookingId ? new Types.ObjectId(bookingId) : undefined,
      serviceId: serviceId ? new Types.ObjectId(serviceId) : undefined,
      url,
      thumbnailUrl,
      caption,
      metadata,
      privacy: privacy || 'private',
      status: 'ready',
      tags: tags || [],
    });

    await photo.save();

    logger.info('Photo uploaded', {
      context: 'PhotoSharingService',
      action: 'PHOTO_UPLOADED',
      photoId: photo._id.toString(),
      userId,
      privacy,
    });

    eventBus.publish(EVENT_TYPES.PHOTO_UPLOADED, {
      photoId: photo._id,
      userId,
      bookingId,
    });

    return photo;
  }

  /**
   * Upload multiple photos (batch)
   */
  async uploadPhotos(inputs: UploadPhotoInput[]): Promise<IPhoto[]> {
    const photos = inputs.map(input => {
      if (!Types.ObjectId.isValid(input.userId)) {
        throw ApiError.badRequest('Invalid user ID');
      }

      return new PhotoModel({
        userId: new Types.ObjectId(input.userId),
        bookingId: input.bookingId ? new Types.ObjectId(input.bookingId) : undefined,
        serviceId: input.serviceId ? new Types.ObjectId(input.serviceId) : undefined,
        url: input.url,
        thumbnailUrl: input.thumbnailUrl,
        caption: input.caption,
        metadata: input.metadata,
        privacy: input.privacy || 'private',
        status: 'ready',
        tags: input.tags || [],
      });
    });

    await PhotoModel.insertMany(photos);

    logger.info('Photos batch uploaded', {
      context: 'PhotoSharingService',
      action: 'PHOTOS_BATCH_UPLOADED',
      count: photos.length,
    });

    return photos;
  }

  /**
   * Update photo
   */
  async updatePhoto(
    photoId: string,
    updates: {
      caption?: string;
      privacy?: PhotoPrivacy;
      tags?: string[];
    }
  ): Promise<IPhoto> {
    if (!Types.ObjectId.isValid(photoId)) {
      throw ApiError.badRequest('Invalid photo ID');
    }

    const photo = await PhotoModel.findByIdAndUpdate(
      photoId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!photo) {
      throw ApiError.notFound('Photo not found');
    }

    logger.info('Photo updated', {
      context: 'PhotoSharingService',
      action: 'PHOTO_UPDATED',
      photoId,
    });

    return photo;
  }

  /**
   * Delete photo
   */
  async deletePhoto(photoId: string): Promise<void> {
    if (!Types.ObjectId.isValid(photoId)) {
      throw ApiError.badRequest('Invalid photo ID');
    }

    const photo = await PhotoModel.findByIdAndUpdate(
      photoId,
      { $set: { status: 'deleted' } },
      { new: true }
    );

    if (!photo) {
      throw ApiError.notFound('Photo not found');
    }

    logger.info('Photo deleted', {
      context: 'PhotoSharingService',
      action: 'PHOTO_DELETED',
      photoId,
    });
  }

  /**
   * Get photo by ID
   */
  async getPhotoById(photoId: string): Promise<IPhoto | null> {
    if (!Types.ObjectId.isValid(photoId)) {
      throw ApiError.badRequest('Invalid photo ID');
    }

    return PhotoModel.findById(photoId)
      .populate('userId', 'firstName lastName avatar');
  }

  // ========================================
  // Photo Queries
  // ========================================

  /**
   * Get user's photos
   */
  async getUserPhotos(
    userId: string,
    options: {
      privacy?: PhotoPrivacy;
      bookingId?: string;
      serviceId?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ photos: IPhoto[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const { privacy, bookingId, serviceId, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      status: { $ne: 'deleted' },
    };

    if (privacy) query.privacy = privacy;
    if (bookingId) query.bookingId = new Types.ObjectId(bookingId);
    if (serviceId) query.serviceId = new Types.ObjectId(serviceId);

    const [photos, total] = await Promise.all([
      PhotoModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PhotoModel.countDocuments(query),
    ]);

    return {
      photos,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get public photos for a service
   */
  async getServicePhotos(
    serviceId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ photos: IPhoto[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(serviceId)) {
      throw ApiError.badRequest('Invalid service ID');
    }

    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query = {
      serviceId: new Types.ObjectId(serviceId),
      privacy: 'public',
      status: 'ready',
    };

    const [photos, total] = await Promise.all([
      PhotoModel.find(query)
        .populate('userId', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PhotoModel.countDocuments(query),
    ]);

    return {
      photos,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Increment photo views
   */
  async incrementViews(photoId: string): Promise<void> {
    if (!Types.ObjectId.isValid(photoId)) {
      throw ApiError.badRequest('Invalid photo ID');
    }

    await PhotoModel.findByIdAndUpdate(photoId, { $inc: { views: 1 } });
  }

  /**
   * Like/unlike a photo
   */
  async toggleLike(photoId: string, userId: string): Promise<{ liked: boolean; totalLikes: number }> {
    if (!Types.ObjectId.isValid(photoId) || !Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const photo = await PhotoModel.findById(photoId);
    if (!photo) {
      throw ApiError.notFound('Photo not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const alreadyLiked = photo.sharedWith?.some((id: Types.ObjectId) => id.equals(userObjectId));

    if (alreadyLiked) {
      await PhotoModel.findByIdAndUpdate(photoId, {
        $pull: { sharedWith: userObjectId },
        $inc: { likes: -1 },
      });
      return { liked: false, totalLikes: photo.likes - 1 };
    } else {
      await PhotoModel.findByIdAndUpdate(photoId, {
        $addToSet: { sharedWith: userObjectId },
        $inc: { likes: 1 },
      });
      return { liked: true, totalLikes: photo.likes + 1 };
    }
  }

  // ========================================
  // Before/After Pairing
  // ========================================

  /**
   * Create a before/after pairing
   */
  async createPairing(input: CreatePairingInput): Promise<IBeforeAfterPairing> {
    const { userId, beforePhotoId, afterPhotoId, bookingId, transformation } = input;

    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    // Verify both photos exist and belong to user
    const [beforePhoto, afterPhoto] = await Promise.all([
      PhotoModel.findById(beforePhotoId),
      PhotoModel.findById(afterPhotoId),
    ]);

    if (!beforePhoto || !afterPhoto) {
      throw ApiError.notFound('One or both photos not found');
    }

    if (!beforePhoto.userId.equals(new Types.ObjectId(userId)) ||
        !afterPhoto.userId.equals(new Types.ObjectId(userId))) {
      throw ApiError.forbidden('Photos do not belong to user');
    }

    // Check for existing pairing
    const existingPairing = await BeforeAfterPairingModel.findOne({
      $or: [
        { beforePhotoId: new Types.ObjectId(beforePhotoId), afterPhotoId: new Types.ObjectId(afterPhotoId) },
        { beforePhotoId: new Types.ObjectId(afterPhotoId), afterPhotoId: new Types.ObjectId(beforePhotoId) },
      ],
    });

    if (existingPairing) {
      throw ApiError.conflict('Pairing already exists for these photos');
    }

    const pairing = new BeforeAfterPairingModel({
      userId: new Types.ObjectId(userId),
      beforePhotoId: new Types.ObjectId(beforePhotoId),
      afterPhotoId: new Types.ObjectId(afterPhotoId),
      bookingId: bookingId ? new Types.ObjectId(bookingId) : undefined,
      transformation,
      status: 'pending',
    });

    await pairing.save();

    logger.info('Before/after pairing created', {
      context: 'PhotoSharingService',
      action: 'PAIRING_CREATED',
      pairingId: pairing._id.toString(),
      userId,
    });

    return pairing;
  }

  /**
   * Approve a pairing
   */
  async approvePairing(pairingId: string, approvedBy: string): Promise<IBeforeAfterPairing> {
    if (!Types.ObjectId.isValid(pairingId) || !Types.ObjectId.isValid(approvedBy)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const pairing = await BeforeAfterPairingModel.findByIdAndUpdate(
      pairingId,
      {
        status: 'approved',
        approvedBy: new Types.ObjectId(approvedBy),
        approvedAt: new Date(),
      },
      { new: true }
    );

    if (!pairing) {
      throw ApiError.notFound('Pairing not found');
    }

    logger.info('Pairing approved', {
      context: 'PhotoSharingService',
      action: 'PAIRING_APPROVED',
      pairingId,
      approvedBy,
    });

    return pairing;
  }

  /**
   * Reject a pairing
   */
  async rejectPairing(pairingId: string, rejectedBy: string, reason: string): Promise<IBeforeAfterPairing> {
    if (!Types.ObjectId.isValid(pairingId) || !Types.ObjectId.isValid(rejectedBy)) {
      throw ApiError.badRequest('Invalid IDs');
    }

    const pairing = await BeforeAfterPairingModel.findByIdAndUpdate(
      pairingId,
      {
        status: 'rejected',
        approvedBy: new Types.ObjectId(rejectedBy),
        approvedAt: new Date(),
        rejectionReason: reason,
      },
      { new: true }
    );

    if (!pairing) {
      throw ApiError.notFound('Pairing not found');
    }

    logger.info('Pairing rejected', {
      context: 'PhotoSharingService',
      action: 'PAIRING_REJECTED',
      pairingId,
      rejectedBy,
      reason,
    });

    return pairing;
  }

  /**
   * Get pairing by ID
   */
  async getPairingById(pairingId: string): Promise<IBeforeAfterPairing | null> {
    if (!Types.ObjectId.isValid(pairingId)) {
      throw ApiError.badRequest('Invalid pairing ID');
    }

    return BeforeAfterPairingModel.findById(pairingId)
      .populate('beforePhotoId')
      .populate('afterPhotoId')
      .populate('userId', 'firstName lastName avatar');
  }

  /**
   * Get user's pairings
   */
  async getUserPairings(
    userId: string,
    options: { status?: PairingStatus; page?: number; limit?: number } = {}
  ): Promise<{ pairings: IBeforeAfterPairing[]; total: number; page: number; pages: number }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (status) query.status = status;

    const [pairings, total] = await Promise.all([
      BeforeAfterPairingModel.find(query)
        .populate('beforePhotoId')
        .populate('afterPhotoId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BeforeAfterPairingModel.countDocuments(query),
    ]);

    return {
      pairings,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get pending pairings (for admin)
   */
  async getPendingPairings(
    options: { page?: number; limit?: number } = {}
  ): Promise<{ pairings: IBeforeAfterPairing[]; total: number; page: number; pages: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const query = { status: 'pending' };

    const [pairings, total] = await Promise.all([
      BeforeAfterPairingModel.find(query)
        .populate('beforePhotoId')
        .populate('afterPhotoId')
        .populate('userId', 'firstName lastName avatar')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
      BeforeAfterPairingModel.countDocuments(query),
    ]);

    return {
      pairings,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ========================================
  // Gallery Management
  // ========================================

  /**
   * Create a gallery
   */
  async createGallery(
    userId: string,
    name: string,
    description?: string,
    isPublic: boolean = false
  ): Promise<IPhotoGallery> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const gallery = new PhotoGalleryModel({
      userId: new Types.ObjectId(userId),
      name,
      description,
      isPublic,
      photoIds: [],
    });

    await gallery.save();

    logger.info('Gallery created', {
      context: 'PhotoSharingService',
      action: 'GALLERY_CREATED',
      galleryId: gallery._id.toString(),
      userId,
    });

    return gallery;
  }

  /**
   * Add photos to gallery
   */
  async addPhotosToGallery(galleryId: string, photoIds: string[]): Promise<IPhotoGallery> {
    if (!Types.ObjectId.isValid(galleryId)) {
      throw ApiError.badRequest('Invalid gallery ID');
    }

    const objectIds = photoIds.map(id => {
      if (!Types.ObjectId.isValid(id)) {
        throw ApiError.badRequest(`Invalid photo ID: ${id}`);
      }
      return new Types.ObjectId(id);
    });

    const gallery = await PhotoGalleryModel.findByIdAndUpdate(
      galleryId,
      { $addToSet: { photoIds: { $each: objectIds } } },
      { new: true }
    );

    if (!gallery) {
      throw ApiError.notFound('Gallery not found');
    }

    // Set cover photo if not set
    if (!gallery.coverPhotoId && objectIds.length > 0) {
      gallery.coverPhotoId = objectIds[0];
      await gallery.save();
    }

    logger.info('Photos added to gallery', {
      context: 'PhotoSharingService',
      action: 'PHOTOS_ADDED_TO_GALLERY',
      galleryId,
      count: objectIds.length,
    });

    return gallery;
  }

  /**
   * Remove photos from gallery
   */
  async removePhotosFromGallery(galleryId: string, photoIds: string[]): Promise<IPhotoGallery> {
    if (!Types.ObjectId.isValid(galleryId)) {
      throw ApiError.badRequest('Invalid gallery ID');
    }

    const objectIds = photoIds.map(id => new Types.ObjectId(id));

    const gallery = await PhotoGalleryModel.findByIdAndUpdate(
      galleryId,
      { $pull: { photoIds: { $in: objectIds } } },
      { new: true }
    );

    if (!gallery) {
      throw ApiError.notFound('Gallery not found');
    }

    logger.info('Photos removed from gallery', {
      context: 'PhotoSharingService',
      action: 'PHOTOS_REMOVED_FROM_GALLERY',
      galleryId,
      count: objectIds.length,
    });

    return gallery;
  }

  /**
   * Get user's galleries
   */
  async getUserGalleries(
    userId: string,
    includePublic: boolean = false
  ): Promise<IPhotoGallery[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const query: Record<string, unknown> = {
      $or: [
        { userId: new Types.ObjectId(userId) },
        ...(includePublic ? [{ isPublic: true }] : []),
      ],
    };

    return PhotoGalleryModel.find(query)
      .populate('coverPhotoId')
      .sort({ createdAt: -1 });
  }

  /**
   * Get public galleries
   */
  async getPublicGalleries(
    options: { page?: number; limit?: number } = {}
  ): Promise<{ galleries: IPhotoGallery[]; total: number; page: number; pages: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [galleries, total] = await Promise.all([
      PhotoGalleryModel.find({ isPublic: true })
        .populate('userId', 'firstName lastName avatar')
        .populate('coverPhotoId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PhotoGalleryModel.countDocuments({ isPublic: true }),
    ]);

    return {
      galleries,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ========================================
  // Privacy Controls
  // ========================================

  /**
   * Share photo with specific users
   */
  async sharePhoto(photoId: string, userIds: string[]): Promise<IPhoto> {
    if (!Types.ObjectId.isValid(photoId)) {
      throw ApiError.badRequest('Invalid photo ID');
    }

    const objectIds = userIds.map(id => {
      if (!Types.ObjectId.isValid(id)) {
        throw ApiError.badRequest(`Invalid user ID: ${id}`);
      }
      return new Types.ObjectId(id);
    });

    const photo = await PhotoModel.findByIdAndUpdate(
      photoId,
      {
        privacy: 'shared',
        $addToSet: { sharedWith: { $each: objectIds } },
      },
      { new: true }
    );

    if (!photo) {
      throw ApiError.notFound('Photo not found');
    }

    logger.info('Photo shared', {
      context: 'PhotoSharingService',
      action: 'PHOTO_SHARED',
      photoId,
      sharedWith: userIds,
    });

    return photo;
  }

  /**
   * Unshare photo from specific users
   */
  async unsharePhoto(photoId: string, userIds: string[]): Promise<IPhoto> {
    if (!Types.ObjectId.isValid(photoId)) {
      throw ApiError.badRequest('Invalid photo ID');
    }

    const objectIds = userIds.map(id => new Types.ObjectId(id));

    const photo = await PhotoModel.findByIdAndUpdate(
      photoId,
      { $pull: { sharedWith: { $in: objectIds } } },
      { new: true }
    );

    if (!photo) {
      throw ApiError.notFound('Photo not found');
    }

    logger.info('Photo unshared', {
      context: 'PhotoSharingService',
      action: 'PHOTO_UNSHARED',
      photoId,
      unsharedFrom: userIds,
    });

    return photo;
  }

  /**
   * Make photo public/private
   */
  async setPhotoPrivacy(photoId: string, privacy: PhotoPrivacy): Promise<IPhoto> {
    if (!Types.ObjectId.isValid(photoId)) {
      throw ApiError.badRequest('Invalid photo ID');
    }

    const update: Record<string, unknown> = { privacy };

    // Clear sharedWith if making public or private
    if (privacy !== 'shared') {
      update.sharedWith = [];
    }

    const photo = await PhotoModel.findByIdAndUpdate(
      photoId,
      { $set: update },
      { new: true }
    );

    if (!photo) {
      throw ApiError.notFound('Photo not found');
    }

    logger.info('Photo privacy updated', {
      context: 'PhotoSharingService',
      action: 'PHOTO_PRIVACY_UPDATED',
      photoId,
      privacy,
    });

    return photo;
  }

  // ========================================
  // Analytics
  // ========================================

  /**
   * Get user's photo statistics
   */
  async getUserPhotoStats(userId: string): Promise<{
    totalPhotos: number;
    publicPhotos: number;
    privatePhotos: number;
    sharedPhotos: number;
    totalViews: number;
    totalLikes: number;
    totalGalleries: number;
    totalPairings: number;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    const [photoStats, galleryStats, pairingStats] = await Promise.all([
      PhotoModel.aggregate([
        { $match: { userId: userObjectId, status: { $ne: 'deleted' } } },
        {
          $group: {
            _id: '$privacy',
            count: { $sum: 1 },
            views: { $sum: '$views' },
            likes: { $sum: '$likes' },
          },
        },
      ]),
      PhotoGalleryModel.countDocuments({ userId: userObjectId }),
      BeforeAfterPairingModel.countDocuments({ userId: userObjectId }),
    ]);

    const stats = {
      totalPhotos: 0,
      publicPhotos: 0,
      privatePhotos: 0,
      sharedPhotos: 0,
      totalViews: 0,
      totalLikes: 0,
      totalGalleries: galleryStats,
      totalPairings: pairingStats,
    };

    for (const s of photoStats) {
      stats.totalPhotos += s.count;
      stats.totalViews += s.views;
      stats.totalLikes += s.likes;

      switch (s._id) {
        case 'public':
          stats.publicPhotos = s.count;
          break;
        case 'private':
          stats.privatePhotos = s.count;
          break;
        case 'shared':
          stats.sharedPhotos = s.count;
          break;
      }
    }

    return stats;
  }
}

// ============================================
// Export Singleton
// ============================================

export const photoSharingService = new PhotoSharingService();
export default photoSharingService;
