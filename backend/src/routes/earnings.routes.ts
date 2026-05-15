import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import earningsController from '../controllers/earnings.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// ============================================
// COMMISSION ROUTES
// ============================================

/**
 * @route   GET /api/earnings/commissions
 * @desc    Get commissions for authenticated provider
 * @access  Private (Provider)
 */
router.get('/commissions', earningsController.getCommissions);

/**
 * @route   GET /api/earnings/commissions/summary
 * @desc    Get commission summary for date range
 * @access  Private (Provider)
 */
router.get('/commissions/summary', earningsController.getCommissionSummary);

/**
 * @route   GET /api/earnings/commissions/:id
 * @desc    Get single commission by ID
 * @access  Private (Provider/Admin)
 */
router.get('/commissions/:id', earningsController.getCommissionById);

/**
 * @route   POST /api/earnings/commissions/:id/adjust
 * @desc    Adjust commission (admin only)
 * @access  Private (Admin)
 */
router.post('/commissions/:id/adjust', earningsController.adjustCommission);

/**
 * @route   PATCH /api/earnings/commissions/:id/status
 * @desc    Update commission status
 * @access  Private (Admin)
 */
router.patch('/commissions/:id/status', earningsController.updateCommissionStatus);

// ============================================
// TAX DOCUMENT ROUTES
// ============================================

/**
 * @route   GET /api/earnings/tax-documents
 * @desc    Get tax documents for authenticated provider
 * @access  Private (Provider)
 */
router.get('/tax-documents', earningsController.getTaxDocuments);

/**
 * @route   GET /api/earnings/tax-documents/generate
 * @desc    Generate invoice for period
 * @access  Private (Provider)
 */
router.post('/tax-documents/generate', earningsController.generateInvoice);

/**
 * @route   GET /api/earnings/tax-documents/:id
 * @desc    Get single tax document by ID
 * @access  Private (Provider/Admin)
 */
router.get('/tax-documents/:id', earningsController.getTaxDocumentById);

/**
 * @route   GET /api/earnings/tax-documents/:id/download
 * @desc    Download tax document
 * @access  Private (Provider/Admin)
 */
router.get('/tax-documents/:id/download', earningsController.downloadTaxDocument);

// ============================================
// EARNINGS REPORT ROUTES
// ============================================

/**
 * @route   GET /api/earnings/reports
 * @desc    Get earnings reports for authenticated provider
 * @access  Private (Provider)
 */
router.get('/reports', earningsController.getEarningsReports);

/**
 * @route   POST /api/earnings/reports/generate
 * @desc    Generate new earnings report
 * @access  Private (Provider)
 */
router.post('/reports/generate', earningsController.generateEarningsReport);

/**
 * @route   GET /api/earnings/reports/:id
 * @desc    Get single earnings report by ID
 * @access  Private (Provider/Admin)
 */
router.get('/reports/:id', earningsController.getEarningsReportById);

/**
 * @route   GET /api/earnings/dashboard
 * @desc    Get dashboard summary with period comparison
 * @access  Private (Provider)
 */
router.get('/dashboard', earningsController.getDashboardSummary);

/**
 * @route   GET /api/earnings/annual-statement/:year
 * @desc    Get annual statement for tax purposes
 * @access  Private (Provider)
 */
router.get('/annual-statement/:year', earningsController.getAnnualStatement);

/**
 * @route   GET /api/earnings/export
 * @desc    Export earnings data (CSV/JSON)
 * @access  Private (Provider)
 */
router.get('/export', earningsController.exportEarnings);

export default router;
