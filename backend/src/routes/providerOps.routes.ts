import express from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  getProviders,
  getProviderDetails,
  getVerification,
  uploadKycDocument,
  verifyDocument,
  submitForReview,
  getOnboardingStatus,
  getProviderMetrics,
  approveProvider,
  rejectProvider,
  suspendProvider,
  reactivateProvider,
  getSlaMetrics,
  getSlaViolations,
  runFraudCheck,
  getFraudStatus,
  resolveFraudFlag,
  getFraudStats,
  getDocumentVerificationStatus,
  getDashboardStats,
  placePayoutHold,
  releasePayoutHold,
} from '../controllers/providerOps.controller';

const router = express.Router();

// Configure multer for document uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'));
    }
  },
});

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// Provider list and details
router.get('/providers', getProviders);
router.get('/providers/:id', getProviderDetails);

// Provider actions
router.post('/providers/:providerId/approve', approveProvider);
router.post('/providers/:providerId/reject', rejectProvider);
router.post('/providers/:providerId/suspend', suspendProvider);
router.post('/providers/:providerId/reactivate', reactivateProvider);

// Payout management
router.post('/providers/:providerId/payout-hold', placePayoutHold);
router.post('/providers/:providerId/payout-release', releasePayoutHold);

// Verification management
router.get('/verification/:providerId', getVerification);
router.get('/verification/:providerId/documents', getDocumentVerificationStatus);
router.post('/verification/:providerId/documents', upload.single('document'), uploadKycDocument);
router.post('/verification/:providerId/documents/:documentId/verify', verifyDocument);
router.post('/verification/:providerId/submit', submitForReview);

// Onboarding
router.get('/onboarding/:providerId', getOnboardingStatus);

// Metrics
router.get('/metrics/:providerId', getProviderMetrics);
router.get('/sla/:providerId', getSlaMetrics);
router.get('/sla/violations', getSlaViolations);

// Fraud detection
router.post('/fraud/check/:providerId', runFraudCheck);
router.get('/fraud/status/:providerId', getFraudStatus);
router.post('/fraud/resolve/:providerId/:flagId', resolveFraudFlag);
router.get('/fraud/stats', getFraudStats);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

export default router;
