import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware';
import { validateProviderRole } from '../middleware/validation.middleware';
import managedContractController from '../controllers/managedContract.controller';

const router = Router();

// All routes require authentication and provider role
router.use(authMiddleware.authenticate);
router.use(validateProviderRole);

// ============================================
// Contract CRUD Routes
// ============================================

/**
 * @route   POST /api/provider/managed-contracts
 * @desc    Create a new managed contract
 * @access  Private (Provider)
 */
router.post('/', managedContractController.createContract);

/**
 * @route   GET /api/provider/managed-contracts
 * @desc    Get all contracts for the authenticated provider
 * @access  Private (Provider)
 */
router.get('/', managedContractController.getContracts);

/**
 * @route   GET /api/provider/managed-contracts/stats
 * @desc    Get contract statistics
 * @access  Private (Provider)
 */
router.get('/stats', managedContractController.getStats);

/**
 * @route   GET /api/provider/managed-contracts/active
 * @desc    Get active contracts
 * @access  Private (Provider)
 */
router.get('/active', managedContractController.getActiveContracts);

/**
 * @route   GET /api/provider/managed-contracts/expiring
 * @desc    Get expiring contracts
 * @access  Private (Provider)
 */
router.get('/expiring', managedContractController.getExpiringContracts);

/**
 * @route   GET /api/provider/managed-contracts/number/:contractNumber
 * @desc    Get contract by contract number
 * @access  Private (Provider)
 */
router.get('/number/:contractNumber', managedContractController.getContractByNumber);

// ============================================
// ROUTES WITH :id - Specific routes BEFORE parameterized /:id
// ============================================

/**
 * @route   PUT /api/provider/managed-contracts/:id
 * @desc    Update a contract
 * @access  Private (Provider)
 */
router.put('/:id', managedContractController.updateContract);

/**
 * @route   DELETE /api/provider/managed-contracts/:id
 * @desc    Delete a contract
 * @access  Private (Provider)
 */
router.delete('/:id', managedContractController.deleteContract);

/**
 * @route   GET /api/provider/managed-contracts/:id/summary
 * @desc    Get contract summary
 * @access  Private (Provider)
 */
router.get('/:id/summary', managedContractController.getSummary);

/**
 * @route   GET /api/provider/managed-contracts/:id
 * @desc    Get a single contract by ID (must be last for /:id routes)
 * @access  Private (Provider)
 */
router.get('/:id', managedContractController.getContractById);

// ============================================
// Status Management Routes
// ============================================

/**
 * @route   POST /api/provider/managed-contracts/:id/activate
 * @desc    Activate a contract
 * @access  Private (Provider)
 */
router.post('/:id/activate', managedContractController.activateContract);

/**
 * @route   POST /api/provider/managed-contracts/:id/suspend
 * @desc    Suspend a contract
 * @access  Private (Provider)
 */
router.post('/:id/suspend', managedContractController.suspendContract);

/**
 * @route   POST /api/provider/managed-contracts/:id/terminate
 * @desc    Terminate a contract
 * @access  Private (Provider)
 */
router.post('/:id/terminate', managedContractController.terminateContract);

// ============================================
// Team Management Routes
// ============================================

/**
 * @route   POST /api/provider/managed-contracts/:id/team
 * @desc    Add team member to contract
 * @access  Private (Provider)
 */
router.post('/:id/team', managedContractController.addTeamMember);

/**
 * @route   PUT /api/provider/managed-contracts/:id/team/:email
 * @desc    Update team member
 * @access  Private (Provider)
 */
router.put('/:id/team/:email', managedContractController.updateTeamMember);

/**
 * @route   DELETE /api/provider/managed-contracts/:id/team/:email
 * @desc    Remove team member from contract
 * @access  Private (Provider)
 */
router.delete('/:id/team/:email', managedContractController.removeTeamMember);

/**
 * @route   POST /api/provider/managed-contracts/:id/team/:email/primary
 * @desc    Set team member as primary contact
 * @access  Private (Provider)
 */
router.post('/:id/team/:email/primary', managedContractController.setPrimaryContact);

// ============================================
// SLA Routes
// ============================================

/**
 * @route   POST /api/provider/managed-contracts/:id/sla/calculate
 * @desc    Calculate SLA compliance
 * @access  Private (Provider)
 */
router.post('/:id/sla/calculate', managedContractController.calculateSLACompliance);

// ============================================
// Report Routes
// ============================================

/**
 * @route   GET /api/provider/managed-contracts/:id/report
 * @desc    Generate contract report
 * @access  Private (Provider)
 */
router.get('/:id/report', managedContractController.generateReport);

// ============================================
// Document Routes
// ============================================

/**
 * @route   POST /api/provider/managed-contracts/:id/documents
 * @desc    Add document to contract
 * @access  Private (Provider)
 */
router.post('/:id/documents', managedContractController.addDocument);

/**
 * @route   DELETE /api/provider/managed-contracts/:id/documents/:name
 * @desc    Remove document from contract
 * @access  Private (Provider)
 */
router.delete('/:id/documents/:name', managedContractController.removeDocument);

export default router;
