import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/insights', (_req: Request, res: Response) => {
  res.json({ success: true, data: [] });
});

router.get('/provider/:id/score', (req: Request, res: Response) => {
  res.json({ success: true, data: { providerId: req.params.id, score: 0.85 } });
});

router.get('/user/:id/churn-risk', (req: Request, res: Response) => {
  res.json({ success: true, data: { userId: req.params.id, riskScore: 0.3 } });
});

export default router;
