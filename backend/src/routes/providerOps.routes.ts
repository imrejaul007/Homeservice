import express from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validateProviderIdParam } from '../middleware/validateObjectId.middleware';
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

const providerIdRoutes = express.Router({ mergeParams: true });
providerIdRoutes.use(validateProviderIdParam);

// Provider list and details
router.get('/providers', getProviders);
router.get('/providers/:providerId', validateProviderIdParam, getProviderDetails);

// Provider actions
providerIdRoutes.post('/approve', approveProvider);
providerIdRoutes.post('/reject', rejectProvider);
providerIdRoutes.post('/suspend', suspendProvider);
providerIdRoutes.post('/reactivate', reactivateProvider);
providerIdRoutes.post('/payout-hold', placePayoutHold);
providerIdRoutes.post('/payout-release', releasePayoutHold);
router.use('/providers/:providerId', providerIdRoutes);

// Verification management
router.get('/verification/:providerId', validateProviderIdParam, getVerification);
router.get('/verification/:providerId/documents', validateProviderIdParam, getDocumentVerificationStatus);
router.post('/verification/:providerId/documents', validateProviderIdParam, upload.single('document'), uploadKycDocument);
router.post('/verification/:providerId/documents/:documentId/verify', validateProviderIdParam, verifyDocument);
router.post('/verification/:providerId/submit', validateProviderIdParam, submitForReview);

// Onboarding
router.get('/onboarding/:providerId', validateProviderIdParam, getOnboardingStatus);

// Metrics — violations route before :providerId param route
router.get('/metrics/:providerId', validateProviderIdParam, getProviderMetrics);
router.get('/sla/violations', getSlaViolations);
router.get('/sla/:providerId', validateProviderIdParam, getSlaMetrics);

// Fraud detection
router.post('/fraud/check/:providerId', validateProviderIdParam, runFraudCheck);
router.get('/fraud/status/:providerId', validateProviderIdParam, getFraudStatus);
router.post('/fraud/resolve/:providerId/:flagId', validateProviderIdParam, resolveFraudFlag);
router.get('/fraud/stats', getFraudStats);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);

export default router;
