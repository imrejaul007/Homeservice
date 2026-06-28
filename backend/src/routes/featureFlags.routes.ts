import { Router } from 'express';
import { featureFlagsService } from '../services/featureFlags.service';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

const CLIENT_FLAG_KEYS = [
  'ai_recommendations',
  'new_onboarding_flow',
  'smart_pricing',
  'loyalty_tiers',
  'referral_program',
  'instant_booking',
  'wallet_enabled',
  'provider_analytics',
] as const;

const CLIENT_FLAG_ALIASES: Record<string, string> = {
  enable_ai_recommendations: 'ai_recommendations',
};

// Get all flags (admin only)
router.get('/', authenticate, async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const flags = await featureFlagsService.getAllFlags();
  return res.json({ flags });
});

// Get enabled flags (requires authentication)
router.get('/enabled', optionalAuth, async (req, res) => {
  const flags = await featureFlagsService.getEnabledFlags();
  res.json({ flags });
});

// Client bootstrap — resolved flags for the current user (optional auth)
router.get('/client', optionalAuth, async (req, res) => {
  const context = req.user
    ? {
        userId: req.user._id?.toString(),
        role: req.user.role,
        tier: (req.user as { loyaltySystem?: { tier?: string } }).loyaltySystem?.tier,
      }
    : undefined;

  const flags: Record<string, boolean> = {};

  for (const key of CLIENT_FLAG_KEYS) {
    flags[key] = await featureFlagsService.isEnabled(key, context);
  }

  for (const [alias, sourceKey] of Object.entries(CLIENT_FLAG_ALIASES)) {
    flags[alias] = flags[sourceKey] ?? false;
  }

  return res.json({
    success: true,
    data: { flags },
  });
});

// ============================================
// ROUTES WITH :key - Specific routes BEFORE parameterized /:key
// ============================================

// Update flag (admin only)
router.put('/:key', authenticate, async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  await featureFlagsService.setFlag(req.params.key, req.body);
  return res.json({ success: true });
});

// Check flag status (must be before /:key to avoid being matched as a key)
router.get('/:key/status', async (req, res) => {
  const context = req.query.userId
    ? { userId: req.query.userId as string }
    : undefined;
  const enabled = await featureFlagsService.isEnabled(req.params.key, context);
  const variant = await featureFlagsService.getVariant(req.params.key, context);
  res.json({ key: req.params.key, enabled, variant });
});

export default router;
