import { Request, Response } from 'express';
import CuratedTrend from '../models/curatedTrend.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { delByPattern } from '../services/cache.service';

async function invalidateFeedCache(): Promise<void> {
  await delByPattern('service:home:trending-feed:*');
}

/**
 * GET /api/admin/curated-trends
 */
export const getCuratedTrends = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '20',
    search,
    isActive,
    placement = 'homepage_trending',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const query: Record<string, unknown> = { isDeleted: false, placement };

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { subtitle: { $regex: search, $options: 'i' } },
      { categoryLabel: { $regex: search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    CuratedTrend.find(query)
      .sort({ isPinned: -1, sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    CuratedTrend.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

/**
 * POST /api/admin/curated-trends
 */
export const createCuratedTrend = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as { _id?: unknown } | undefined;
  const {
    title,
    subtitle,
    imageUrl,
    videoUrl,
    linkType,
    linkTarget,
    categoryLabel,
    metricOverride,
    sortOrder,
    isActive,
    isPinned,
    startsAt,
    endsAt,
    placement,
  } = req.body;

  if (!title || !subtitle || !imageUrl || !linkTarget || !categoryLabel) {
    throw new ApiError(400, 'title, subtitle, imageUrl, linkTarget, and categoryLabel are required');
  }

  const item = await CuratedTrend.create({
    title,
    subtitle,
    imageUrl,
    videoUrl,
    linkType: linkType || 'category',
    linkTarget,
    categoryLabel,
    metricOverride,
    sortOrder: sortOrder ?? 0,
    isActive: isActive ?? true,
    isPinned: isPinned ?? false,
    startsAt,
    endsAt,
    placement: placement || 'homepage_trending',
    createdBy: user?._id as any,
    updatedBy: user?._id as any,
  });

  await invalidateFeedCache();

  res.status(201).json({
    success: true,
    data: { item },
    message: 'Curated trend created',
  });
});

/**
 * PUT /api/admin/curated-trends/:id
 */
export const updateCuratedTrend = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as { _id?: unknown } | undefined;
  const { id } = req.params;

  const item = await CuratedTrend.findOne({ _id: id, isDeleted: false });
  if (!item) {
    throw new ApiError(404, 'Curated trend not found');
  }

  const fields = [
    'title',
    'subtitle',
    'imageUrl',
    'videoUrl',
    'linkType',
    'linkTarget',
    'categoryLabel',
    'metricOverride',
    'sortOrder',
    'isActive',
    'isPinned',
    'startsAt',
    'endsAt',
    'placement',
  ] as const;

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      (item as any)[field] = req.body[field];
    }
  });

  if (user?._id) {
    item.updatedBy = user._id as any;
  }
  await item.save();
  await invalidateFeedCache();

  res.json({
    success: true,
    data: { item },
    message: 'Curated trend updated',
  });
});

/**
 * DELETE /api/admin/curated-trends/:id
 */
export const deleteCuratedTrend = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const item = await CuratedTrend.findOne({ _id: id, isDeleted: false });
  if (!item) {
    throw new ApiError(404, 'Curated trend not found');
  }

  await item.softDelete();
  await invalidateFeedCache();

  res.json({
    success: true,
    message: 'Curated trend deleted',
  });
});

/**
 * PATCH /api/admin/curated-trends/reorder
 * Body: { items: [{ id, sortOrder }] }
 */
export const reorderCuratedTrends = asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'items array is required');
  }

  await Promise.all(
    items.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
      CuratedTrend.findByIdAndUpdate(id, { sortOrder })
    )
  );

  await invalidateFeedCache();

  res.json({
    success: true,
    message: 'Order updated',
  });
});
