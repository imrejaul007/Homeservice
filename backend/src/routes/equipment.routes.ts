import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { equipmentRentalService, EquipmentCategory, RentalStatus } from '../services/equipmentRental.service';

const router = Router();

const queryString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

/**
 * @route   GET /api/equipment/catalog
 * @desc    List equipment available for rental
 * @access  Public
 */
router.get('/catalog', asyncHandler(async (req: Request, res: Response) => {
  const category = queryString(req.query.category);
  const providerId = queryString(req.query.providerId);
  const search = queryString(req.query.search);
  const status = queryString(req.query.status) as RentalStatus | '';
  const page = parseInt(queryString(req.query.page, '1'), 10);
  const limit = parseInt(queryString(req.query.limit, '50'), 10);

  const validCategories: EquipmentCategory[] = [
    'cleaning',
    'plumbing',
    'electrical',
    'landscaping',
    'construction',
    'general',
  ];

  const result = await equipmentRentalService.getCatalog({
    category: validCategories.includes(category as EquipmentCategory)
      ? (category as EquipmentCategory)
      : undefined,
    providerId: providerId || undefined,
    searchQuery: search || undefined,
    status: status || undefined,
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? Math.min(limit, 100) : 50,
  });

  res.json({
    success: true,
    data: {
      equipment: result.equipment,
      total: result.total,
    },
  });
}));

export default router;
