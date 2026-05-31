import { Router, Request, Response, NextFunction } from 'express';
import { offerService } from '../services/offer.service';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Validation helper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// PUBLIC ROUTES
// ============================================

// GET /api/offers - List active offers for homepage (includes claimed status if authenticated)
router.get('/', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  const offers = await offerService.getActiveOffers(userId);
  res.json({ success: true, data: offers });
}));

// ============================================
// USER ROUTES (Authenticated) - Must come before /:id
// ============================================

// GET /api/offers/my/claims - Get user's claimed offers
router.get('/my/claims', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const claims = await offerService.getUserClaims(userId);
  res.json({ success: true, data: claims });
}));

// POST /api/offers/claim - Claim an offer
router.post('/claim', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { offerId } = req.body;
  const userId = (req as any).user.id;

  if (!offerId) {
    res.status(400).json({ success: false, message: 'Offer ID is required' });
    return;
  }

  const result = await offerService.claimOffer(userId, offerId);
  res.json(result);
}));

// POST /api/offers/validate - Validate promo code at checkout
router.post('/validate', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { code, orderAmount } = req.body;
  const userId = (req as any).user.id;

  if (!code || orderAmount === undefined) {
    res.status(400).json({ success: false, message: 'Promo code and order amount are required' });
    return;
  }

  if (orderAmount < 0) {
    res.status(400).json({ success: false, message: 'Invalid order amount' });
    return;
  }

  const result = await offerService.validatePromoCode(code, userId, orderAmount);
  res.json(result);
}));

// ============================================
// ADMIN ROUTES
// ============================================

// GET /api/offers/admin/all - List all offers
router.get('/admin/all', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const offers = await offerService.getAllOffers();
  res.json({ success: true, data: offers });
}));

// POST /api/offers/admin - Create new offer
router.post('/admin', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.createOffer(req.body);
  res.status(201).json({ success: true, data: offer });
}));

// PUT /api/offers/admin/:id - Update offer
router.put('/admin/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.updateOffer(req.params.id, req.body);
  if (!offer) {
    res.status(404).json({ success: false, message: 'Offer not found' });
    return;
  }
  res.json({ success: true, data: offer });
}));

// DELETE /api/offers/admin/:id - Deactivate offer
router.delete('/admin/:id', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const result = await offerService.deactivateOffer(req.params.id);
  if (!result) {
    res.status(404).json({ success: false, message: 'Offer not found' });
    return;
  }
  res.json({ success: true, message: 'Offer deactivated successfully' });
}));

// ============================================
// PUBLIC ROUTES - After specific routes
// ============================================

// GET /api/offers/:id - Get offer by ID (must be last)
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.getOfferById(req.params.id);
  if (!offer) {
    res.status(404).json({ success: false, message: 'Offer not found' });
    return;
  }
  res.json({ success: true, data: offer });
}));

export default router;
