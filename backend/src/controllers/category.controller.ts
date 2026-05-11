import { Request, Response } from 'express';
import ServiceCategory from '../models/serviceCategory.model';
import Service from '../models/service.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Get all master categories (for homepage)
 * GET /api/categories
 */
export const getMasterCategories = asyncHandler(async (req: Request, res: Response) => {
  const { featured, includeComingSoon } = req.query;

  let query: any = { isActive: true };

  // Filter featured categories if requested
  if (featured === 'true') {
    query.isFeatured = true;
  }

  // Exclude comingSoon categories unless explicitly requested
  if (includeComingSoon !== 'true') {
    query.comingSoon = { $ne: true };
  }

  const categories = await ServiceCategory.find(query)
    .select('name slug icon color description sortOrder isFeatured comingSoon subcategories')
    .sort({ sortOrder: 1 });

  // Transform to include subcategory count
  const categoriesWithMeta = categories.map(cat => ({
    _id: cat._id,
    name: cat.name,
    slug: cat.slug,
    icon: cat.icon,
    color: cat.color,
    description: cat.description,
    sortOrder: cat.sortOrder,
    isFeatured: cat.isFeatured,
    comingSoon: cat.comingSoon || false,
    subcategoryCount: cat.subcategories?.filter(sub => sub.isActive).length || 0,
    subcategories: cat.subcategories?.filter(sub => sub.isActive).map(sub => ({
      name: sub.name,
      slug: sub.slug,
      description: sub.description,
      icon: sub.icon,
      color: sub.color
    })) || []
  }));

  res.json({
    success: true,
    data: {
      categories: categoriesWithMeta,
      total: categories.length
    }
  });
});

/**
 * Get category by slug with full details
 * GET /api/categories/:slug
 */
export const getCategoryBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;

  const category = await ServiceCategory.findOne({ slug, isActive: true });

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // If category is comingSoon, return unavailable response
  if (category.comingSoon) {
    throw new ApiError(404, 'This category is coming soon and not yet available');
  }

  // Get service count for this category
  const serviceCount = await Service.countDocuments({
    $or: [
      { category: category.name },
      { categoryId: category._id }
    ],
    isActive: true,
    status: 'active'
  });

  res.json({
    success: true,
    data: {
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        color: category.color,
        imageUrl: category.imageUrl,
        subcategories: category.subcategories?.filter(sub => sub.isActive) || [],
        metadata: category.metadata,
        seo: category.seo,
        serviceCount
      }
    }
  });
});

/**
 * Get subcategories for a category
 * GET /api/categories/:slug/subcategories
 */
export const getSubcategories = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;

  const category = await ServiceCategory.findOne({ slug, isActive: true });

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  const activeSubcategories = category.subcategories?.filter(sub => sub.isActive) || [];

  res.json({
    success: true,
    data: {
      categoryName: category.name,
      categorySlug: category.slug,
      subcategories: activeSubcategories.map(sub => ({
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        icon: sub.icon,
        color: sub.color,
        metadata: sub.metadata
      }))
    }
  });
});

/**
 * Get services under a category
 * GET /api/categories/:slug/services
 */
export const getCategoryServices = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { subcategory, page = 1, limit = 20, sortBy = 'popularity' } = req.query;

  const category = await ServiceCategory.findOne({ slug, isActive: true });

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Build query - support both old string category and new categoryId
  let query: any = {
    $or: [
      { category: category.name },
      { categoryId: category._id }
    ],
    isActive: true,
    status: 'active'
  };

  // Filter by subcategory if provided
  if (subcategory) {
    query.subcategory = subcategory;
  }

  // Build sort
  let sort: any = {};
  switch (sortBy) {
    case 'price':
      sort['price.amount'] = 1;
      break;
    case 'price_desc':
      sort['price.amount'] = -1;
      break;
    case 'rating':
      sort['rating.average'] = -1;
      break;
    case 'newest':
      sort.createdAt = -1;
      break;
    case 'popularity':
    default:
      sort['searchMetadata.popularityScore'] = -1;
      break;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [services, totalCount] = await Promise.all([
    Service.find(query)
      .populate('provider', 'firstName lastName avatar rating')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    Service.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      category: {
        name: category.name,
        slug: category.slug
      },
      services,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    }
  });
});

/**
 * Get all categories with service counts (for filtering UI)
 * GET /api/categories/stats
 */
export const getCategoryStats = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await ServiceCategory.find({ isActive: true, comingSoon: { $ne: true } })
    .select('name slug icon color')
    .sort({ sortOrder: 1 });

  // Get service counts for each category
  const categoryStats = await Promise.all(
    categories.map(async (cat) => {
      const count = await Service.countDocuments({
        $or: [
          { category: cat.name },
          { categoryId: cat._id }
        ],
        isActive: true,
        status: 'active'
      });

      return {
        _id: cat._id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        color: cat.color,
        serviceCount: count
      };
    })
  );

  res.json({
    success: true,
    data: {
      categories: categoryStats
    }
  });
});

/**
 * Search categories and subcategories
 * GET /api/categories/search
 */
export const searchCategories = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.length < 2) {
    res.json({
      success: true,
      data: { results: [] }
    });
    return;
  }

  const categories = await ServiceCategory.find({
    isActive: true,
    comingSoon: { $ne: true },
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { 'subcategories.name': { $regex: q, $options: 'i' } }
    ]
  }).select('name slug subcategories');

  const results: Array<{ type: 'category' | 'subcategory'; name: string; slug: string; parentCategory?: string }> = [];

  categories.forEach(cat => {
    // Check if category name matches
    if (cat.name.toLowerCase().includes(q.toLowerCase())) {
      results.push({
        type: 'category',
        name: cat.name,
        slug: cat.slug
      });
    }

    // Check subcategories
    cat.subcategories?.forEach(sub => {
      if (sub.name.toLowerCase().includes(q.toLowerCase()) && sub.isActive) {
        results.push({
          type: 'subcategory',
          name: sub.name,
          slug: sub.slug,
          parentCategory: cat.name
        });
      }
    });
  });

  res.json({
    success: true,
    data: { results: results.slice(0, 10) }
  });
});

export default {
  getMasterCategories,
  getCategoryBySlug,
  getSubcategories,
  getCategoryServices,
  getCategoryStats,
  searchCategories
};
