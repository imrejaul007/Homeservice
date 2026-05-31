import { Request, Response } from 'express';
import { ManagedContractService } from '../services/managedContract.service';
import { asyncHandler } from '../utils/asyncHandler';
import { IUser } from '../models/user.model';

// ============================================
// Contract CRUD
// ============================================

/**
 * Create a new managed contract
 * POST /api/provider/managed-contracts
 */
export const createContract = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const contract = await ManagedContractService.createContract(providerId, req.body);

    res.status(201).json({
      success: true,
      message: 'Contract created successfully',
      data: contract,
    });
  }
);

/**
 * Get all contracts for the authenticated provider
 * GET /api/provider/managed-contracts
 */
export const getContracts = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id.toString();

  const filters = {
    status: req.query.status as any,
    search: req.query.search as string,
    sortBy: req.query.sortBy as any,
    sortOrder: req.query.sortOrder as 'asc' | 'desc',
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
  };

  const result = await ManagedContractService.getContracts(providerId, filters);

  res.json({
    success: true,
    data: result.contracts,
    meta: {
      total: result.total,
      page: result.page,
      pages: result.pages,
      limit: filters.limit,
    },
  });
});

/**
 * Get a single contract by ID
 * GET /api/provider/managed-contracts/:id
 */
export const getContractById = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;

    const contract = await ManagedContractService.getContractById(id, providerId);

    res.json({
      success: true,
      data: contract,
    });
  }
);

/**
 * Get contract by contract number
 * GET /api/provider/managed-contracts/number/:contractNumber
 */
export const getContractByNumber = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { contractNumber } = req.params;

    const contract = await ManagedContractService.getContractByNumber(
      contractNumber,
      providerId
    );

    res.json({
      success: true,
      data: contract,
    });
  }
);

/**
 * Update a contract
 * PUT /api/provider/managed-contracts/:id
 */
export const updateContract = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;

    const contract = await ManagedContractService.updateContract(
      id,
      providerId,
      req.body
    );

    res.json({
      success: true,
      message: 'Contract updated successfully',
      data: contract,
    });
  }
);

/**
 * Delete a contract
 * DELETE /api/provider/managed-contracts/:id
 */
export const deleteContract = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;

    await ManagedContractService.deleteContract(id, providerId);

    res.json({
      success: true,
      message: 'Contract deleted successfully',
    });
  }
);

// ============================================
// Status Management
// ============================================

/**
 * Activate a contract
 * POST /api/provider/managed-contracts/:id/activate
 */
export const activateContract = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;

    const contract = await ManagedContractService.activateContract(id, providerId);

    res.json({
      success: true,
      message: 'Contract activated successfully',
      data: contract,
    });
  }
);

/**
 * Suspend a contract
 * POST /api/provider/managed-contracts/:id/suspend
 */
export const suspendContract = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;
    const { reason } = req.body;

    const contract = await ManagedContractService.suspendContract(
      id,
      providerId,
      reason
    );

    res.json({
      success: true,
      message: 'Contract suspended successfully',
      data: contract,
    });
  }
);

/**
 * Terminate a contract
 * POST /api/provider/managed-contracts/:id/terminate
 */
export const terminateContract = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({
        success: false,
        message: 'Termination reason is required',
      });
      return;
    }

    const contract = await ManagedContractService.terminateContract(
      id,
      providerId,
      reason
    );

    res.json({
      success: true,
      message: 'Contract terminated successfully',
      data: contract,
    });
  }
);

// ============================================
// Team Management
// ============================================

/**
 * Add team member to contract
 * POST /api/provider/managed-contracts/:id/team
 */
export const addTeamMember = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;

    const contract = await ManagedContractService.addTeamMember(
      id,
      providerId,
      req.body
    );

    res.json({
      success: true,
      message: 'Team member added successfully',
      data: contract,
    });
  }
);

/**
 * Update team member
 * PUT /api/provider/managed-contracts/:id/team/:email
 */
export const updateTeamMember = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id, email } = req.params;

    const contract = await ManagedContractService.updateTeamMember(
      id,
      providerId,
      decodeURIComponent(email),
      req.body
    );

    res.json({
      success: true,
      message: 'Team member updated successfully',
      data: contract,
    });
  }
);

/**
 * Remove team member from contract
 * DELETE /api/provider/managed-contracts/:id/team/:email
 */
export const removeTeamMember = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id, email } = req.params;

    const contract = await ManagedContractService.removeTeamMember(
      id,
      providerId,
      decodeURIComponent(email)
    );

    res.json({
      success: true,
      message: 'Team member removed successfully',
      data: contract,
    });
  }
);

/**
 * Set team member as primary contact
 * POST /api/provider/managed-contracts/:id/team/:email/primary
 */
export const setPrimaryContact = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id, email } = req.params;

    const contract = await ManagedContractService.setPrimaryContact(
      id,
      providerId,
      decodeURIComponent(email)
    );

    res.json({
      success: true,
      message: 'Primary contact set successfully',
      data: contract,
    });
  }
);

// ============================================
// SLA Compliance
// ============================================

/**
 * Calculate SLA compliance
 * POST /api/provider/managed-contracts/:id/sla/calculate
 */
export const calculateSLACompliance = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;

    const result = await ManagedContractService.calculateSLACompliance(id, providerId);

    res.json({
      success: true,
      data: result,
    });
  }
);

// ============================================
// Reports
// ============================================

/**
 * Generate contract report
 * GET /api/provider/managed-contracts/:id/report
 */
export const generateReport = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const report = await ManagedContractService.generateReport(
      id,
      providerId,
      startDate as string | undefined,
      endDate as string | undefined
    );

    res.json({
      success: true,
      data: report,
    });
  }
);

// ============================================
// Statistics
// ============================================

/**
 * Get contract statistics
 * GET /api/provider/managed-contracts/stats
 */
export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id.toString();

  const stats = await ManagedContractService.getStats(providerId);

  res.json({
    success: true,
    data: stats,
  });
});

/**
 * Get contract summary
 * GET /api/provider/managed-contracts/:id/summary
 */
export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id.toString();
  const { id } = req.params;

  const contract = await ManagedContractService.getContractById(id, providerId);

  const summary = {
    contract,
    stats: {
      totalBookings: contract.metrics.totalBookings,
      totalRevenue: contract.metrics.totalRevenue,
      averageMonthlySpend: contract.pricing.monthlyFee,
      complianceRate: contract.slaCompliance.complianceRate,
    },
  };

  res.json({
    success: true,
    data: summary,
  });
});

// ============================================
// Filtered Lists
// ============================================

/**
 * Get active contracts
 * GET /api/provider/managed-contracts/active
 */
export const getActiveContracts = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();

    const contracts = await ManagedContractService.getActiveContracts(providerId);

    res.json({
      success: true,
      data: contracts,
    });
  }
);

/**
 * Get expiring contracts
 * GET /api/provider/managed-contracts/expiring
 */
export const getExpiringContracts = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const days = req.query.days ? parseInt(req.query.days as string) : 30;

    const contracts = await ManagedContractService.getExpiringContracts(
      providerId,
      days
    );

    res.json({
      success: true,
      data: contracts,
    });
  }
);

// ============================================
// Document Management
// ============================================

/**
 * Add document to contract
 * POST /api/provider/managed-contracts/:id/documents
 */
export const addDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id } = req.params;

    const contract = await ManagedContractService.addDocument(
      id,
      providerId,
      req.body
    );

    res.json({
      success: true,
      message: 'Document added successfully',
      data: contract,
    });
  }
);

/**
 * Remove document from contract
 * DELETE /api/provider/managed-contracts/:id/documents/:name
 */
export const removeDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const { id, name } = req.params;

    const contract = await ManagedContractService.removeDocument(
      id,
      providerId,
      decodeURIComponent(name)
    );

    res.json({
      success: true,
      message: 'Document removed successfully',
      data: contract,
    });
  }
);

export default {
  createContract,
  getContracts,
  getContractById,
  getContractByNumber,
  updateContract,
  deleteContract,
  activateContract,
  suspendContract,
  terminateContract,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  setPrimaryContact,
  calculateSLACompliance,
  generateReport,
  getStats,
  getSummary,
  getActiveContracts,
  getExpiringContracts,
  addDocument,
  removeDocument,
};
