import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { adminLimiter } from '../middleware/rateLimiter';
import * as anomalyAdminController from '../controllers/anomaly.admin.controller';

const router = Router();

// Apply auth and role middleware to all routes
router.use(authenticate);
router.use(requireRole('admin'));
router.use(adminLimiter);

// ========================================
// Anomaly Routes
// ========================================

/**
 * GET /admin/anomalies
 * Get all anomalies with pagination and filters
 */
router.get('/', anomalyAdminController.getAllAnomalies);

/**
 * GET /admin/anomalies/stats
 * Get anomaly statistics
 */
router.get('/stats', anomalyAdminController.getAnomalyStats);

/**
 * GET /admin/anomalies/chart/severity
 * Get severity chart data for anomalies
 */
router.get('/chart/severity', anomalyAdminController.getSeverityChartData);

/**
 * GET /admin/anomalies/chart/type
 * Get type chart data for anomalies
 */
router.get('/chart/type', anomalyAdminController.getTypeChartData);

/**
 * GET /admin/anomalies/export
 * Export anomalies as CSV
 */
router.get('/export', anomalyAdminController.exportAnomalies);

/**
 * GET /admin/anomalies/recent
 * Get recent anomalies
 */
router.get('/recent', anomalyAdminController.getRecentAnomalies);

/**
 * GET /admin/anomalies/high-risk
 * Get high-risk entities based on anomaly scores
 */
router.get('/high-risk', anomalyAdminController.getHighRiskEntities);

/**
 * GET /admin/anomalies/score/:entityType/:entityId
 * Get behavioral score for an entity
 */
router.get('/score/:entityType/:entityId', anomalyAdminController.getBehavioralScore);

// ============================================
// ROUTES WITH :id - Specific routes BEFORE parameterized /:id
// ============================================

/**
 * GET /admin/anomalies/:id/tickets
 * Get related support tickets for an anomaly
 */
router.get('/:id/tickets', anomalyAdminController.getRelatedTickets);

/**
 * PATCH /admin/anomalies/:id/status
 * Update anomaly status
 */
router.patch('/:id/status', anomalyAdminController.updateAnomalyStatus);

/**
 * POST /admin/anomalies/:id/ticket
 * Create support ticket for anomaly investigation
 */
router.post('/:id/ticket', anomalyAdminController.createTicket);

/**
 * GET /admin/anomalies/:id
 * Get single anomaly by ID (must be last for /:id routes)
 */
router.get('/:id', anomalyAdminController.getAnomalyById);

/**
 * POST /admin/anomalies/bulk-update
 * Bulk update anomaly statuses
 */
router.post('/bulk-update', anomalyAdminController.bulkUpdateStatus);

/**
 * POST /admin/anomalies/detect
 * Run anomaly detection for an entity
 */
router.post('/detect', anomalyAdminController.runDetection);

/**
 * POST /admin/anomalies/report
 * Generate anomaly report
 */
router.post('/report', anomalyAdminController.generateReport);

export default router;
