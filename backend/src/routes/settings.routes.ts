import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { enforceAdminIpAllowlist } from '../middleware/platformSettings.middleware';
import {
  getSettings,
  updateSettings,
  resetSettings,
  getSettingsHistory,
  uploadLogo,
  deleteLogo,
  exportSettings,
  importSettings,
  getSetting,
  testEmailConfig
} from '../controllers/settings.controller';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

const router = Router();

// All settings routes require admin authentication
router.use(authenticate);
router.use(requireRole('admin'));
router.use(enforceAdminIpAllowlist);

// Core settings operations
router.get('/', getSettings);
router.patch('/', updateSettings);
router.post('/reset', resetSettings);

// Settings history
router.get('/history', getSettingsHistory);

// Export/Import & tests (must be before /:key)
router.get('/export', exportSettings);
router.post('/import', importSettings);
router.post('/test-email', testEmailConfig);

// Logo operations
router.post('/upload-logo', upload.single('logo'), uploadLogo);
router.delete('/logo', deleteLogo);

// Single setting value
router.get('/:key', getSetting);

export default router;
