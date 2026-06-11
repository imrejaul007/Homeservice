import { Router } from 'express';
import {
  getCuratedTrends,
  createCuratedTrend,
  updateCuratedTrend,
  deleteCuratedTrend,
  reorderCuratedTrends,
} from '../controllers/curatedTrend.admin.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', getCuratedTrends);
router.post('/', createCuratedTrend);
router.patch('/reorder', reorderCuratedTrends);
router.put('/:id', updateCuratedTrend);
router.delete('/:id', deleteCuratedTrend);

export default router;
