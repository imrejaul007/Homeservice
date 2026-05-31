/**
 * Corporate Accounts Routes
 *
 * Handles B2B corporate account management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { corporateAccountService } from '../services/corporateAccount.service';
import logger from '../utils/logger';

const router = Router();

// Validation for company creation
const createCompanyValidation = [
  body('companyName').isString().notEmpty().withMessage('Company name is required'),
  body('companyEmail').isEmail().withMessage('Valid billing email required'),
  body('industry').optional().isString(),
  body('size').optional().isIn(['small', 'medium', 'large', 'enterprise']),
  body('billingAddress').optional().isString(),
  body('taxId').optional().isString(),
  body('paymentTerms').optional().isIn(['prepaid', 'net15', 'net30', 'net60']),
  body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be positive'),
  body('primaryContact.name').optional().isString(),
  body('primaryContact.email').optional().isEmail().withMessage('Valid email required'),
  body('primaryContact.phone').optional().isString(),
];

// Validation for employee addition
const addEmployeeValidation = [
  body('companyId').isString().notEmpty().withMessage('Company ID is required'),
  body('firstName').isString().notEmpty().withMessage('First name is required'),
  body('lastName').isString().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('department').optional().isString(),
  body('role').optional().isIn(['employee', 'manager', 'admin']),
  body('spendingLimit').optional().isFloat({ min: 0 }).withMessage('Spending limit must be positive'),
];

/**
 * GET /api/corporate/companies
 * List corporate companies (admin only)
 */
router.get(
  '/companies',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        status,
        industry,
        size,
        search,
        page = '1',
        limit = '20',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Build query
      const query: any = {};
      if (status) query.status = status;
      if (industry) query.industry = industry;

      // Get pending accounts
      const { accounts, total } = await corporateAccountService.getPendingAccounts({
        page: pageNum,
        limit: limitNum,
      });

      res.status(200).json({
        success: true,
        data: {
          companies: accounts.map((account: any) => ({
            id: account._id.toString(),
            accountId: account.accountId,
            companyName: account.companyName,
            companyEmail: account.companyEmail,
            industry: account.industry,
            status: account.status,
            approvalStatus: account.approvalStatus,
            creditLimit: account.creditLimit,
            paymentTerms: account.paymentTerms,
            employeeCount: account.metadata?.employeeCount || 0,
            createdAt: account.createdAt,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching companies', { error });
      next(error);
    }
  })
);

/**
 * POST /api/corporate/companies
 * Create a new corporate company (public - registration)
 * or approve existing (admin)
 */
router.post(
  '/companies',
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if authenticated (admin creating) or public (self-registration)
      const user = req.user as any;
      const isAdmin = user?.role === 'admin';

      if (isAdmin) {
        // Admin is creating company directly
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array(),
          });
          return;
        }

        const companyData = req.body;
        const createdBy = user._id;

        const result = await corporateAccountService.registerAccount({
          companyName: companyData.companyName,
          companyEmail: companyData.companyEmail,
          companyPhone: companyData.companyPhone,
          companyAddress: companyData.companyAddress,
          industry: companyData.industry,
          billingEmail: companyData.billingEmail,
          taxId: companyData.taxId,
          paymentTerms: companyData.paymentTerms,
          creditLimit: companyData.creditLimit,
          metadata: companyData.metadata,
        });

        if (!result.success) {
          res.status(400).json({
            success: false,
            message: result.error || 'Failed to create company',
          });
          return;
        }

        res.status(201).json({
          success: true,
          message: 'Corporate company created successfully',
          data: {
            id: result.account?._id?.toString(),
            accountId: result.account?.accountId,
            companyName: result.account?.companyName,
            status: result.account?.status,
            createdAt: result.account?.createdAt,
          },
        });
      } else {
        // Public self-registration
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array(),
          });
          return;
        }

        const companyData = req.body;

        const result = await corporateAccountService.registerAccount({
          companyName: companyData.companyName,
          companyEmail: companyData.companyEmail,
          companyPhone: companyData.phone,
          industry: companyData.industry,
          billingEmail: companyData.billingEmail,
          taxId: companyData.taxId,
          metadata: {
            employeeCount: companyData.employeeCount,
            industryCategory: companyData.industryCategory,
          },
        });

        if (!result.success) {
          res.status(400).json({
            success: false,
            message: result.error || 'Failed to register company',
          });
          return;
        }

        res.status(201).json({
          success: true,
          message: 'Corporate account registered successfully. Pending approval.',
          data: {
            id: result.account?._id?.toString(),
            accountId: result.account?.accountId,
            companyName: result.account?.companyName,
            status: result.account?.status,
            approvalStatus: result.account?.approvalStatus,
          },
        });
      }
    } catch (error) {
      logger.error('Error creating company', { error });
      next(error);
    }
  })
);

/**
 * GET /api/corporate/companies/:id
 * Get company details (admin or company admin)
 */
router.get(
  '/companies/:id',
  authenticate,
  param('id').isString().notEmpty().withMessage('Valid company ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const user = req.user as any;
      const isAdmin = user.role === 'admin';

      // Try to find by accountId or _id
      const account = await corporateAccountService.getAccount(id);

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Company not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: (account as any)._id.toString(),
          accountId: account.accountId,
          companyName: account.companyName,
          companyEmail: account.companyEmail,
          companyPhone: account.companyPhone,
          companyAddress: account.companyAddress,
          industry: account.industry,
          website: account.website,
          status: account.status,
          approvalStatus: account.approvalStatus,
          creditLimit: account.creditLimit,
          paymentTerms: account.paymentTerms,
          billingEmail: account.billingEmail,
          taxId: account.taxId,
          currentBalance: account.currentBalance,
          metadata: account.metadata,
          createdAt: (account as any).createdAt,
          updatedAt: (account as any).updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error fetching company', { error });
      next(error);
    }
  })
);

/**
 * PUT /api/corporate/companies/:id
 * Update company details (admin only)
 */
router.put(
  '/companies/:id',
  authenticate,
  requireRole(['admin']),
  param('id').isString().notEmpty().withMessage('Valid company ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const companyData = req.body;
      const user = req.user as any;

      // Get existing account
      const account = await corporateAccountService.getAccount(id);

      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Company not found',
        });
        return;
      }

      // Update fields
      if (companyData.creditLimit !== undefined) {
        await corporateAccountService.updateSpendingLimit(id, {
          monthly: companyData.creditLimit,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Company updated successfully',
        data: {
          companyId: id,
          ...companyData,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error updating company', { error });
      next(error);
    }
  })
);

/**
 * POST /api/corporate/companies/:id/approve
 * Approve a corporate account (admin only)
 */
router.post(
  '/companies/:id/approve',
  authenticate,
  requireRole(['admin']),
  param('id').isString().notEmpty().withMessage('Valid company ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { creditLimit, paymentTerms, spendingLimit } = req.body;
      const user = req.user as any;

      const result = await corporateAccountService.approveAccount(id, user._id, {
        creditLimit,
        paymentTerms,
        spendingLimit,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to approve company',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Company approved successfully',
        data: {
          companyId: id,
          status: 'active',
          approvalStatus: 'approved',
        },
      });
    } catch (error) {
      logger.error('Error approving company', { error });
      next(error);
    }
  })
);

/**
 * GET /api/corporate/employees
 * List employees for corporate accounts
 */
router.get(
  '/employees',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        companyId,
        department,
        status,
        page = '1',
        limit = '20',
      } = req.query;

      const user = req.user as any;
      const isAdmin = user.role === 'admin';

      if (!isAdmin && !companyId) {
        res.status(403).json({
          success: false,
          message: 'Company ID is required for non-admin users',
        });
        return;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      const { employees, total } = await corporateAccountService.getEmployees(
        companyId as string,
        {
          page: pageNum,
          limit: limitNum,
          includeInactive: status === 'all',
        }
      );

      res.status(200).json({
        success: true,
        data: {
          employees: employees.map((emp: any) => ({
            id: emp._id.toString(),
            employeeId: emp.employeeId,
            companyId: emp.corporateAccountId.toString(),
            email: emp.email,
            firstName: emp.firstName,
            lastName: emp.lastName,
            role: emp.role,
            department: emp.department,
            spendingLimit: emp.spendingLimit,
            isActive: emp.isActive,
            createdAt: (emp as any).createdAt,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching employees', { error });
      next(error);
    }
  })
);

/**
 * POST /api/corporate/employees
 * Add employee to corporate account
 */
router.post(
  '/employees',
  authenticate,
  addEmployeeValidation,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { companyId, firstName, lastName, email, department, role, spendingLimit } = req.body;
      const user = req.user as any;

      const result = await corporateAccountService.addEmployee(companyId, {
        firstName,
        lastName,
        email,
        department,
        role: role || 'employee',
        spendingLimit,
        addedBy: user._id,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to add employee',
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Employee added successfully',
        data: {
          id: result.employee?._id?.toString(),
          employeeId: result.employee?.employeeId,
          companyId,
          email,
          firstName,
          lastName,
          department,
          role: result.employee?.role,
          spendingLimit,
          status: 'active',
          createdAt: (result.employee as any)?.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error adding employee', { error });
      next(error);
    }
  })
);

/**
 * PUT /api/corporate/employees/:id
 * Update employee details
 */
router.put(
  '/employees/:id',
  authenticate,
  param('id').isString().notEmpty().withMessage('Valid employee ID required'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const employeeData = req.body;

      const result = await corporateAccountService.updateEmployee(id, {
        role: employeeData.role,
        department: employeeData.department,
        spendingLimit: employeeData.spendingLimit,
        metadata: employeeData.metadata,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to update employee',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Employee updated successfully',
        data: {
          employeeId: result.employee?.employeeId,
          ...employeeData,
          updatedAt: (result.employee as any)?.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error updating employee', { error });
      next(error);
    }
  })
);

export default router;
