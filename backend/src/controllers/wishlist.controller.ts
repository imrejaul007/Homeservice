import { Request, Response } from 'express';
import CustomerProfile from '../models/customerProfile.model';
import Service from '../models/service.model'; // Service model (legacy packages)
import Bundle from '../models/bundle.model'; // Bundle model (current packages)
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

// ============================================
// Types
// ============================================

interface PackageInfo {
  _id: any;
  name: string;
  price: { amount: number; currency: string } | number;
  providerId: any;
  category?: string;
  isActive: boolean;
  rating?: { average: number; count: number };
  source: 'bundle' | 'service';
}

// ============================================
// Helper: Find package in Bundle or Service
// ============================================

// Default provider ID for bundles without provider
const DEFAULT_PROVIDER_ID = '000000000000000000000000';

async function findPackage(packageId: string): Promise<PackageInfo | null> {
  // Check Bundle first (packages), then Service (backward compat)
  let pkg = await Bundle.findById(packageId);
  if (pkg) {
    // Ensure providerId is always defined (required by wishlist schema)
    const bundleProviderId = pkg.providerId || DEFAULT_PROVIDER_ID;
    return {
      _id: pkg._id,
      name: pkg.name,
      price: { amount: pkg.bundlePrice, currency: pkg.currency || 'AED' },
      providerId: bundleProviderId,
      category: pkg.categoryId?.toString(),
      isActive: pkg.isActive,
      rating: pkg.rating,
      source: 'bundle',
    };
  }

  const servicePkg = await Service.findById(packageId);
  if (servicePkg) {
    return {
      _id: servicePkg._id,
      name: servicePkg.name,
      price: servicePkg.price,
      providerId: servicePkg.providerId,
      category: servicePkg.category,
      isActive: servicePkg.isActive,
      rating: servicePkg.rating,
      source: 'service',
    };
  }

  return null;
}

// ============================================
// Constants
// ============================================
const MAX_WISHLIST_PAGE_SIZE = 50;
const DEFAULT_WISHLIST_PAGE_SIZE = 20;

// ============================================
// Get User's Package Wishlist (with cursor-based pagination)
// ============================================

export const getWishlist = asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const user = req.user as any;

  // Parse cursor-based pagination params
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(
    MAX_WISHLIST_PAGE_SIZE,
    Math.max(1, parseInt(req.query.limit as string) || DEFAULT_WISHLIST_PAGE_SIZE)
  );
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    return res.json({
      success: true,
      data: {
        wishlist: [],
        pagination: {
          cursor: null,
          hasMore: false,
          total: 0,
        },
      },
    });
  }

  // Get favorite packages with sorting and cursor pagination
  let favoritePackages = customerProfile.favoritePackages
    .filter(fav => fav && fav.packageId)
    .sort((a, b) => {
      const dateA = new Date(a.addedAt).getTime();
      const dateB = new Date(b.addedAt).getTime();
      return sortOrder === 1 ? dateA - dateB : dateB - dateA;
    });

  // Apply cursor pagination
  if (cursor) {
    const cursorDate = new Date(cursor);
    favoritePackages = favoritePackages.filter(fav => {
      const favDate = new Date(fav.addedAt);
      return sortOrder === 1 ? favDate > cursorDate : favDate < cursorDate;
    });
  }

  // Apply limit + 1 to check for more
  const paginatedWishlist = favoritePackages.slice(0, limit + 1);
  const hasMore = paginatedWishlist.length > limit;
  if (hasMore) {
    paginatedWishlist.pop();
  }

  // Get full package details for paginated wishlist items
  const favoritePackageIds = paginatedWishlist.map(f => f.packageId);

  // Query both Bundle and Service collections
  const [bundlePackages, servicePackages] = await Promise.all([
    Bundle.find({
      _id: { $in: favoritePackageIds },
      isActive: true
    })
      .select('name description bundlePrice originalPrice currency categoryId images isFeatured rating providerId')
      .lean(),
    Service.find({
      _id: { $in: favoritePackageIds },
      isActive: true
    })
      .select('name description price duration category images isFeatured isPopular rating providerId')
      .lean(),
  ]);

  // Create a unified map of packages
  const packageMap = new Map<string, any>();

  // Add bundles to map
  bundlePackages.forEach(pkg => {
    packageMap.set(pkg._id.toString(), {
      _id: pkg._id,
      name: pkg.name,
      description: pkg.description,
      currentPrice: pkg.bundlePrice,
      originalPrice: pkg.originalPrice,
      currency: pkg.currency || 'AED',
      duration: 0, // Bundles don't have duration field
      category: pkg.categoryId?.toString(),
      images: pkg.images || (pkg.image ? [pkg.image] : []),
      isFeatured: pkg.isFeatured,
      isPopular: false, // Bundles don't have isPopular
      averageRating: pkg.rating?.average || 0,
      totalReviews: pkg.rating?.count || 0,
      source: 'bundle' as const,
    });
  });

  // Add services to map (only if not already in map from bundle)
  servicePackages.forEach(pkg => {
    if (!packageMap.has(pkg._id.toString())) {
      const priceAmount = typeof pkg.price === 'number' ? pkg.price : pkg.price?.amount || 0;
      const priceCurrency = typeof pkg.price === 'object' ? pkg.price?.currency || 'AED' : 'AED';
      packageMap.set(pkg._id.toString(), {
        _id: pkg._id,
        name: pkg.name,
        description: pkg.description,
        currentPrice: priceAmount,
        originalPrice: undefined,
        currency: priceCurrency,
        duration: pkg.duration || 0,
        category: pkg.category,
        images: pkg.images,
        isFeatured: pkg.isFeatured,
        isPopular: pkg.isPopular,
        averageRating: pkg.rating?.average || 0,
        totalReviews: pkg.rating?.count || 0,
        source: 'service' as const,
      });
    }
  });

  // Combine wishlist items with package data
  const wishlist = paginatedWishlist
    .filter(fav => fav && fav.packageId && packageMap.has(fav.packageId.toString()))
    .map(fav => {
      const favPackageId = fav.packageId?.toString ? fav.packageId.toString() : String(fav.packageId);
      const pkg = packageMap.get(favPackageId);

      if (!pkg) return null;

      return {
        packageId: favPackageId,
        packageName: fav.packageName,
        packagePrice: fav.packagePrice,
        providerId: fav.providerId?.toString(),
        providerName: fav.providerName,
        addedAt: fav.addedAt,
        category: fav.category,
        notes: fav.notes,
        package: {
          id: pkg._id?.toString(),
          name: pkg.name,
          description: pkg.description,
          currentPrice: pkg.currentPrice,
          originalPrice: pkg.originalPrice,
          currency: pkg.currency,
          duration: {
            totalMinutes: pkg.duration || 0,
            formatted: `${pkg.duration || 0} minutes`,
          },
          category: pkg.category,
          images: pkg.images,
          isFeatured: pkg.isFeatured,
          isPopular: pkg.isPopular,
          averageRating: pkg.averageRating,
          totalReviews: pkg.totalReviews,
        },
      };
    }).filter(Boolean);

  // Generate next cursor from last item
  const nextCursor = hasMore && paginatedWishlist.length > 0
    ? paginatedWishlist[paginatedWishlist.length - 1].addedAt.toISOString()
    : null;

  return res.json({
    success: true,
    data: {
      wishlist,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
        total: customerProfile.favoritePackages.length,
      },
    },
  });
});

// ============================================
// Add Package to Wishlist
// ============================================

export const addToWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { packageId } = req.params;
  const { notes } = req.body;

  // FIX: Validate packageId is a valid ObjectId
  if (!packageId || !/^[0-9a-fA-F]{24}$/.test(packageId)) {
    throw new ApiError(400, 'Invalid package ID format');
  }

  // Validate package exists (check Bundle first, then Service)
  const pkg = await findPackage(packageId);
  if (!pkg) {
    throw new ApiError(404, 'Package not found');
  }

  if (!pkg.isActive) {
    throw new ApiError(400, 'Cannot add inactive package to wishlist');
  }

  // Get provider info
  const provider = await User.findById(pkg.providerId);
  const providerName = provider
    ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Provider'
    : 'Provider';

  // Get customer profile
  let customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    // Create profile if it doesn't exist
    customerProfile = new CustomerProfile({
      userId: user._id,
      favoritePackages: [],
    });
  }

  // Check if already in wishlist
  const alreadyInWishlist = customerProfile.favoritePackages.some(
    f => f && f.packageId && f.packageId.toString() === packageId
  );

  if (alreadyInWishlist) {
    throw new ApiError(400, 'Package is already in your wishlist');
  }

  // Get price amount
  const priceAmount = typeof pkg.price === 'number' ? pkg.price : pkg.price?.amount || 0;

  // Add to wishlist
  customerProfile.favoritePackages.push({
    packageId: packageId as any,
    packageName: pkg.name,
    packagePrice: priceAmount,
    providerId: pkg.providerId as any,
    providerName,
    addedAt: new Date(),
    category: pkg.category || undefined,
    notes: notes || undefined,
  });

  await customerProfile.save();

  res.status(201).json({
    success: true,
    message: 'Package added to wishlist',
    data: {
      packageId,
      packageName: pkg.name,
      addedAt: new Date(),
      package: {
        id: pkg._id,
        name: pkg.name,
        currentPrice: priceAmount,
        originalPrice: undefined,
        currency: typeof pkg.price === 'object' ? pkg.price.currency : 'AED',
        averageRating: pkg.rating?.average || 0,
      },
    },
  });
});

// ============================================
// Remove Package from Wishlist
// ============================================

export const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { packageId } = req.params;

  // FIX: Validate packageId is a valid ObjectId
  if (!packageId || !/^[0-9a-fA-F]{24}$/.test(packageId)) {
    throw new ApiError(400, 'Invalid package ID format');
  }

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    throw new ApiError(404, 'Customer profile not found');
  }

  const wishlistIndex = customerProfile.favoritePackages.findIndex(
    f => f && f.packageId && f.packageId.toString() === packageId
  );

  if (wishlistIndex === -1) {
    throw new ApiError(404, 'Package not in wishlist');
  }

  customerProfile.favoritePackages.splice(wishlistIndex, 1);
  await customerProfile.save();

  res.json({
    success: true,
    message: 'Package removed from wishlist',
  });
});

// ============================================
// Check if Package is in Wishlist
// ============================================

export const checkWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { packageId } = req.params;

  // Validate packageId is a valid ObjectId
  if (!packageId || !/^[0-9a-fA-F]{24}$/.test(packageId)) {
    throw new ApiError(400, 'Invalid package ID format');
  }

  // Check Bundle first (packages), then Service (backward compat)
  const pkg = await findPackage(packageId);
  if (!pkg) {
    throw new ApiError(404, 'Package not found');
  }

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  const isInWishlist = customerProfile?.favoritePackages.some(
    f => f && f.packageId && f.packageId.toString() === packageId
  ) || false;

  res.json({
    success: true,
    data: { isInWishlist },
  });
});

// ============================================
// Toggle Package Wishlist Status
// ============================================

export const toggleWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { packageId } = req.params;
  const { notes } = req.body;

  // Validate packageId is a valid ObjectId
  if (!packageId || !/^[0-9a-fA-F]{24}$/.test(packageId)) {
    throw new ApiError(400, 'Invalid package ID format');
  }

  // Validate package exists (check Bundle first, then Service)
  const pkg = await findPackage(packageId);
  if (!pkg) {
    throw new ApiError(404, 'Package not found');
  }

  if (!pkg.isActive) {
    throw new ApiError(400, 'Cannot toggle inactive package in wishlist');
  }

  // Get provider info
  const provider = await User.findById(pkg.providerId);
  const providerName = provider
    ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Provider'
    : 'Provider';

  // Get price amount
  const priceAmount = typeof pkg.price === 'number' ? pkg.price : pkg.price?.amount || 0;

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    // Create profile if it doesn't exist
    const newProfile = new CustomerProfile({
      userId: user._id,
      favoritePackages: [],
    });

    newProfile.favoritePackages.push({
      packageId: packageId as any,
      packageName: pkg.name,
      packagePrice: priceAmount,
      providerId: pkg.providerId as any,
      providerName,
      addedAt: new Date(),
      category: pkg.category || undefined,
      notes: notes || undefined,
    });

    await newProfile.save();

    return res.status(201).json({
      success: true,
      message: 'Package added to wishlist',
      data: {
        isInWishlist: true,
        packageId,
        packageName: pkg.name,
      },
    });
  }

  const existingIndex = customerProfile.favoritePackages.findIndex(
    f => f && f.packageId && f.packageId.toString() === packageId
  );

  if (existingIndex !== -1) {
    // Remove from wishlist
    customerProfile.favoritePackages.splice(existingIndex, 1);
    await customerProfile.save();

    return res.json({
      success: true,
      message: 'Package removed from wishlist',
      data: {
        isInWishlist: false,
        packageId,
      },
    });
  } else {
    // Add to wishlist
    customerProfile.favoritePackages.push({
      packageId: packageId as any,
      packageName: pkg.name,
      packagePrice: priceAmount,
      providerId: pkg.providerId as any,
      providerName,
      addedAt: new Date(),
      category: pkg.category || undefined,
      notes: notes || undefined,
    });
    await customerProfile.save();

    return res.status(201).json({
      success: true,
      message: 'Package added to wishlist',
      data: {
        isInWishlist: true,
        packageId,
        packageName: pkg.name,
      },
    });
  }
});

// ============================================
// Update Wishlist Item Notes
// ============================================

export const updateWishlistNotes = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { packageId } = req.params;
  const { notes, category } = req.body;

  // FIX: Validate packageId is a valid ObjectId
  if (!packageId || !/^[0-9a-fA-F]{24}$/.test(packageId)) {
    throw new ApiError(400, 'Invalid package ID format');
  }

  const customerProfile = await CustomerProfile.findOne({ userId: user._id });

  if (!customerProfile) {
    throw new ApiError(404, 'Customer profile not found');
  }

  const wishlistItem = customerProfile.favoritePackages.find(
    f => f && f.packageId && f.packageId.toString() === packageId
  );

  if (!wishlistItem) {
    throw new ApiError(404, 'Package not in wishlist');
  }

  if (notes !== undefined) {
    wishlistItem.notes = notes;
  }
  if (category !== undefined) {
    wishlistItem.category = category;
  }

  await customerProfile.save();

  res.json({
    success: true,
    message: 'Wishlist item updated',
    data: { wishlistItem },
  });
});

// ============================================
// Export
// ============================================

export default {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist,
  toggleWishlist,
  updateWishlistNotes,
};
