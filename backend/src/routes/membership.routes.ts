import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { membershipService } from '../services/membership.service';
import {
  MEMBERSHIP_TIERS,
  MEMBERSHIP_PRICES,
  TIER_REQUIREMENTS,
  MembershipTier,
} from '../models/premiumMembership.model';

const router = Router();

const formatMembership = (membership: any) => ({
  id: membership._id?.toString(),
  userId: membership.userId?._id?.toString() || membership.userId?.toString(),
  tier: membership.tier,
  status: membership.status,
  startDate: membership.startDate,
  endDate: membership.endDate,
  benefits: membership.benefits,
  metrics: membership.metrics,
  featuredListings: membership.featuredListings || [],
  totalCashbackEarned: membership.totalCashbackEarned,
  totalDiscountsReceived: membership.totalDiscountsReceived,
});

/**
 * GET /api/membership/me
 */
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const membership = await membershipService.getOrCreateMembership(userId);

  res.json({
    success: true,
    data: formatMembership(membership),
  });
}));

/**
 * GET /api/membership/tiers
 */
router.get('/tiers', asyncHandler(async (_req: Request, res: Response) => {
  const tiers = (Object.keys(MEMBERSHIP_TIERS) as MembershipTier[]).map((tier) => ({
    tier,
    name: tier.charAt(0).toUpperCase() + tier.slice(1),
    price: MEMBERSHIP_PRICES[tier],
    benefits: MEMBERSHIP_TIERS[tier],
    requirements: TIER_REQUIREMENTS[tier],
  }));

  res.json({ success: true, data: tiers });
}));

/**
 * POST /api/membership/upgrade
 */
router.post('/upgrade', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const { tier, durationDays, reason } = req.body;

  const membership = await membershipService.upgradeTier(userId, tier, { durationDays, reason });

  res.json({
    success: true,
    data: formatMembership(membership),
  });
}));

/**
 * GET /api/membership/eligibility
 */
router.get('/eligibility', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const eligibility = await membershipService.checkTierEligibility(userId);

  res.json({ success: true, data: eligibility });
}));

/**
 * GET /api/membership/featured-listings
 */
router.get('/featured-listings', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const listings = await membershipService.getFeaturedListings(userId);

  res.json({ success: true, data: listings });
}));

/**
 * POST /api/membership/featured-listings
 */
router.post('/featured-listings', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const listing = await membershipService.addFeaturedListing(userId, {
    ...req.body,
    startDate: new Date(req.body.startDate),
    endDate: new Date(req.body.endDate),
  });

  res.status(201).json({ success: true, data: listing });
}));

/**
 * DELETE /api/membership/featured-listings/:listingId
 */
router.delete('/featured-listings/:listingId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  await membershipService.cancelFeaturedListing(userId, req.params.listingId);

  res.json({ success: true, message: 'Featured listing cancelled' });
}));

/**
 * POST /api/membership/booking-priority/:providerId
 */
router.post('/booking-priority/:providerId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  await membershipService.addBookingPriority(userId, req.params.providerId, req.body || {});

  res.json({ success: true, message: 'Booking priority added' });
}));

/**
 * GET /api/membership/booking-priority/:providerId
 */
router.get('/booking-priority/:providerId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const hasPriority = await membershipService.hasBookingPriority(userId, req.params.providerId);

  res.json({ success: true, data: { hasPriority } });
}));

/**
 * GET /api/membership/transactions
 */
router.get('/transactions', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const { type, page, limit } = req.query;

  const result = await membershipService.getTransactions(userId, {
    type: type as 'credit' | 'debit' | undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({ success: true, data: result });
}));

/**
 * POST /api/membership/concierge
 */
router.post('/concierge', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id.toString();
  const result = await membershipService.submitConciergeRequest(userId, {
    ...req.body,
    preferredDate: req.body.preferredDate ? new Date(req.body.preferredDate) : undefined,
  });

  res.json({ success: true, data: result });
}));

export default router;
