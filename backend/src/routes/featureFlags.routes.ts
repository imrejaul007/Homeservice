import { Router } from 'express';
import { featureFlagsService } from '../services/featureFlags.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Get all flags (admin only)
router.get('/', authenticate, async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const flags = await featureFlagsService.getAllFlags();
  return res.json({ flags });
});

// Get enabled flags
router.get('/enabled', async (req, res) => {
  const flags = await featureFlagsService.getEnabledFlags();
  res.json({ flags });
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
