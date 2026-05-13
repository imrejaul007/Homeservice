import { Request, Response } from 'express';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

// ============================================
// Get User's Favorites
// ============================================

export const getFavorites = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    throw new ApiError(404, 'Customer profile not found');
  }

  // Get full provider details for each favorite
  const favoriteProviderIds = customerProfile.favoriteProviders.map(f => f.providerId);

  const providers = await User.find({ _id: { $in: favoriteProviderIds } })
    .select('firstName lastName email phone avatar bio')
    .lean();

  const providerProfiles = await ProviderProfile.find({ userId: { $in: favoriteProviderIds } })
    .select('businessInfo reviewsData instagramStyleProfile services')
    .lean();

  // Combine user and provider profile data
  const favorites = customerProfile.favoriteProviders
    .filter(fav => fav && fav.providerId) // Filter out invalid entries
    .map(fav => {
      const favProviderId = fav.providerId?.toString ? fav.providerId.toString() : String(fav.providerId);
      const provider = providers.find(p => p && p._id && p._id.toString() === favProviderId);
      const profile = providerProfiles.find(p => p && p.userId && p.userId.toString() === favProviderId);

      if (!provider) return null;

      return {
        providerId: favProviderId,
        addedAt: fav.addedAt,
        category: fav.category,
        notes: fav.notes,
        provider: {
          id: provider._id?.toString(),
          firstName: provider.firstName || '',
          lastName: provider.lastName || '',
          email: provider.email,
          phone: provider.phone,
          avatar: provider.avatar,
          bio: provider.bio,
          businessName: profile?.businessInfo?.businessName,
          averageRating: profile?.reviewsData?.averageRating || 0,
          totalReviews: profile?.reviewsData?.totalReviews || 0,
          profilePhoto: profile?.instagramStyleProfile?.profilePhoto,
          services: profile?.services?.slice(0, 3) || [],
        },
      };
    }).filter(Boolean);

  res.json({
    success: true,
    data: {
      favorites,
      total: favorites.length,
    },
  });
});

// ============================================
// Add Favorite Provider
// ============================================

export const addFavorite = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { providerId } = req.params;
  const { category, notes } = req.body;

  // Validate provider exists
  const provider = await User.findById(providerId);
  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.role !== 'provider') {
    throw new ApiError(400, 'Can only favorite provider accounts');
  }

  // Get customer profile
  let customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    // Create profile if it doesn't exist
    customerProfile = new CustomerProfile({
      userId: user._id,
      favoriteProviders: [],
    });
  }

  // Check if already favorited
  const alreadyFavorited = customerProfile.favoriteProviders.some(
    f => f && f.providerId && f.providerId.toString() === providerId
  );

  if (alreadyFavorited) {
    throw new ApiError(400, 'Provider is already in your favorites');
  }

  // Add to favorites
  customerProfile.favoriteProviders.push({
    providerId: providerId as any,
    addedAt: new Date(),
    category: category || undefined,
    notes: notes || undefined,
  });

  await customerProfile.save();

  // Get full provider details for response
  const providerProfile = await ProviderProfile.findOne({ userId: providerId });

  res.status(201).json({
    success: true,
    message: 'Provider added to favorites',
    data: {
      providerId,
      addedAt: new Date(),
      provider: {
        id: provider._id,
        firstName: provider.firstName,
        lastName: provider.lastName,
        avatar: provider.avatar,
        businessName: providerProfile?.businessInfo?.businessName,
        averageRating: providerProfile?.reviewsData?.averageRating || 0,
      },
    },
  });
});

// ============================================
// Remove Favorite Provider
// ============================================

export const removeFavorite = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { providerId } = req.params;

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    throw new ApiError(404, 'Customer profile not found');
  }

  const favoriteIndex = customerProfile.favoriteProviders.findIndex(
    f => f && f.providerId && f.providerId.toString() === providerId
  );

  if (favoriteIndex === -1) {
    throw new ApiError(404, 'Provider not in favorites');
  }

  customerProfile.favoriteProviders.splice(favoriteIndex, 1);
  await customerProfile.save();

  res.json({
    success: true,
    message: 'Provider removed from favorites',
  });
});

// ============================================
// Check if Provider is Favorited
// ============================================

export const checkFavorite = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { providerId } = req.params;

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  const isFavorited = customerProfile?.favoriteProviders.some(
    f => f && f.providerId && f.providerId.toString() === providerId
  ) || false;

  res.json({
    success: true,
    data: { isFavorited },
  });
});

// ============================================
// Update Favorite Notes
// ============================================

export const updateFavoriteNotes = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { providerId } = req.params;
  const { notes, category } = req.body;

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    throw new ApiError(404, 'Customer profile not found');
  }

  const favorite = customerProfile.favoriteProviders.find(
    f => f && f.providerId && f.providerId.toString() === providerId
  );

  if (!favorite) {
    throw new ApiError(404, 'Provider not in favorites');
  }

  if (notes !== undefined) {
    favorite.notes = notes;
  }
  if (category !== undefined) {
    favorite.category = category;
  }

  await customerProfile.save();

  res.json({
    success: true,
    message: 'Favorite updated',
    data: { favorite },
  });
});

// ============================================
// Export
// ============================================

export default {
  getFavorites,
  addFavorite,
  removeFavorite,
  checkFavorite,
  updateFavoriteNotes,
};
