import mongoose, { Types } from 'mongoose';
import ManagedContract, {
  IManagedContract,
  ContractStatus,
} from '../models/managedContract.model';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// Type Definitions
// ============================================

export interface CreateContractInput {
  clientName: string;
  clientContactName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: {
    street: string;
    city: string;
    emirate: string;
    postalCode?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  serviceScope?: {
    serviceIds?: string[];
    categories?: string[];
    maxMonthlyServices?: number;
    excludedServices?: string[];
  };
  slaTerms?: {
    responseTimeMinutes?: number;
    completionTimeHours?: number;
    availabilityPercentage?: number;
    priority?: 'standard' | 'express' | 'premium';
    penaltyClauses?: string;
    escalationPath?: string[];
  };
  pricing: {
    model?: 'fixed' | 'hourly' | 'per_service' | 'tiered';
    monthlyFee: number;
    currency?: string;
    overtimeRate?: number;
    volumeDiscounts?: Array<{
      minServices: number;
      discountPercentage: number;
    }>;
    minimumCommitmentMonths?: number;
  };
  startDate: string;
  endDate: string;
  autoRenew?: boolean;
  internalNotes?: string;
}

export interface UpdateContractInput {
  clientName?: string;
  clientContactName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: Partial<{
    street: string;
    city: string;
    emirate: string;
    postalCode?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  }>;
  status?: ContractStatus;
  serviceScope?: Partial<{
    serviceIds: string[];
    categories: string[];
    maxMonthlyServices: number;
    excludedServices: string[];
  }>;
  slaTerms?: Partial<{
    responseTimeMinutes: number;
    completionTimeHours: number;
    availabilityPercentage: number;
    priority: 'standard' | 'express' | 'premium';
    penaltyClauses: string;
    escalationPath: string[];
  }>;
  pricing?: Partial<{
    model: 'fixed' | 'hourly' | 'per_service' | 'tiered';
    monthlyFee: number;
    currency: string;
    overtimeRate: number;
    volumeDiscounts: Array<{
      minServices: number;
      discountPercentage: number;
    }>;
    minimumCommitmentMonths: number;
  }>;
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  internalNotes?: string;
  clientNotes?: string;
}

export interface AddTeamMemberInput {
  name: string;
  email: string;
  phone: string;
  role: 'manager' | 'technician' | 'coordinator' | 'backup';
}

export interface ContractFilters {
  status?: ContractStatus;
  search?: string;
  sortBy?: 'createdAt' | 'startDate' | 'endDate' | 'clientName' | 'pricing.monthlyFee';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ============================================
// Service Functions
// ============================================

export class ManagedContractService {
  /**
   * Create a new managed contract
   */
  static async createContract(
    providerId: string,
    input: CreateContractInput
  ): Promise<IManagedContract> {
    try {
      const contract = new ManagedContract({
        providerId: new Types.ObjectId(providerId),
        clientName: input.clientName,
        clientContactName: input.clientContactName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        clientAddress: input.clientAddress,
        serviceScope: input.serviceScope || {
          serviceIds: [],
          categories: [],
          maxMonthlyServices: 100,
          excludedServices: [],
        },
        slaTerms: input.slaTerms || {
          responseTimeMinutes: 60,
          completionTimeHours: 24,
          availabilityPercentage: 99,
          priority: 'standard',
          penaltyClauses: '',
          escalationPath: [],
        },
        pricing: {
          model: input.pricing.model || 'fixed',
          monthlyFee: input.pricing.monthlyFee,
          currency: input.pricing.currency || 'AED',
          overtimeRate: input.pricing.overtimeRate,
          volumeDiscounts: input.pricing.volumeDiscounts,
          minimumCommitmentMonths: input.pricing.minimumCommitmentMonths || 1,
        },
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        autoRenew: input.autoRenew ?? true,
        internalNotes: input.internalNotes || '',
        status: 'draft',
      });

      // Add creation to history
      contract.history = [
        {
          action: 'created',
          performedBy: providerId,
          performedAt: new Date(),
          details: 'Contract created',
        },
      ];

      await contract.save();
      logger.info(`Managed contract created: ${contract.contractNumber}`);
      return contract;
    } catch (error: any) {
      logger.error('Error creating managed contract:', error);
      throw new ApiError(500, 'Failed to create managed contract');
    }
  }

  /**
   * Get all contracts for a provider with filters
   */
  static async getContracts(
    providerId: string,
    filters: ContractFilters
  ): Promise<{
    contracts: IManagedContract[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const query: any = { providerId: new Types.ObjectId(providerId) };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.search) {
        query.$or = [
          { clientName: { $regex: filters.search, $options: 'i' } },
          { clientContactName: { $regex: filters.search, $options: 'i' } },
          { clientEmail: { $regex: filters.search, $options: 'i' } },
          { contractNumber: { $regex: filters.search, $options: 'i' } },
          { 'clientAddress.emirate': { $regex: filters.search, $options: 'i' } },
        ];
      }

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const sortField = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
      const sortObj: any = {};
      sortObj[sortField] = sortOrder;

      const [contracts, total] = await Promise.all([
        ManagedContract.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        ManagedContract.countDocuments(query),
      ]);

      return {
        contracts: contracts as unknown as IManagedContract[],
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error('Error getting managed contracts:', error);
      throw new ApiError(500, 'Failed to get managed contracts');
    }
  }

  /**
   * Get a single contract by ID
   */
  static async getContractById(
    contractId: string,
    providerId: string
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      }).lean();

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      return contract as unknown as IManagedContract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting managed contract by ID:', error);
      throw new ApiError(500, 'Failed to get managed contract');
    }
  }

  /**
   * Get contract by contract number
   */
  static async getContractByNumber(
    contractNumber: string,
    providerId: string
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        contractNumber,
        providerId: new Types.ObjectId(providerId),
      }).lean();

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      return contract as unknown as IManagedContract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting managed contract by number:', error);
      throw new ApiError(500, 'Failed to get managed contract');
    }
  }

  /**
   * Update a contract
   */
  static async updateContract(
    contractId: string,
    providerId: string,
    input: UpdateContractInput
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      // Update fields if provided
      if (input.clientName) contract.clientName = input.clientName;
      if (input.clientContactName)
        contract.clientContactName = input.clientContactName;
      if (input.clientEmail) contract.clientEmail = input.clientEmail;
      if (input.clientPhone) contract.clientPhone = input.clientPhone;
      if (input.clientAddress) {
        contract.clientAddress = {
          ...contract.clientAddress,
          ...input.clientAddress,
        };
      }
      if (input.serviceScope) {
        contract.serviceScope = {
          ...contract.serviceScope,
          ...input.serviceScope,
        };
      }
      if (input.slaTerms) {
        contract.slaTerms = {
          ...contract.slaTerms,
          ...input.slaTerms,
        };
      }
      if (input.pricing) {
        contract.pricing = {
          ...contract.pricing,
          ...input.pricing,
        };
      }
      if (input.startDate) contract.startDate = new Date(input.startDate);
      if (input.endDate) contract.endDate = new Date(input.endDate);
      if (typeof input.autoRenew === 'boolean')
        contract.autoRenew = input.autoRenew;
      if (input.internalNotes) contract.internalNotes = input.internalNotes;
      if (input.clientNotes) contract.clientNotes = input.clientNotes;

      // Add update to history
      contract.history.push({
        action: 'updated',
        performedBy: providerId,
        performedAt: new Date(),
        details: 'Contract updated',
      });

      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error updating managed contract:', error);
      throw new ApiError(500, 'Failed to update managed contract');
    }
  }

  /**
   * Delete a contract (only drafts, terminated, or expired)
   */
  static async deleteContract(
    contractId: string,
    providerId: string
  ): Promise<void> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      if (!['draft', 'terminated', 'expired'].includes(contract.status)) {
        throw new ApiError(
          400,
          'Only draft, terminated, or expired contracts can be deleted'
        );
      }

      await ManagedContract.deleteOne({ _id: contract._id });
      logger.info(`Managed contract deleted: ${contract.contractNumber}`);
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error deleting managed contract:', error);
      throw new ApiError(500, 'Failed to delete managed contract');
    }
  }

  /**
   * Activate a contract
   */
  static async activateContract(
    contractId: string,
    providerId: string
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      if (contract.status !== 'pending' && contract.status !== 'draft') {
        throw new ApiError(400, 'Only pending or draft contracts can be activated');
      }

      contract.status = 'active';

      // Add to history
      contract.history.push({
        action: 'activated',
        performedBy: providerId,
        performedAt: new Date(),
        details: 'Contract activated',
      });

      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error activating contract:', error);
      throw new ApiError(500, 'Failed to activate contract');
    }
  }

  /**
   * Suspend a contract
   */
  static async suspendContract(
    contractId: string,
    providerId: string,
    reason?: string
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      if (contract.status !== 'active') {
        throw new ApiError(400, 'Only active contracts can be suspended');
      }

      contract.status = 'suspended';

      // Add to history
      contract.history.push({
        action: 'suspended',
        performedBy: providerId,
        performedAt: new Date(),
        details: reason ? `Suspended: ${reason}` : 'Contract suspended',
      });

      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error suspending contract:', error);
      throw new ApiError(500, 'Failed to suspend contract');
    }
  }

  /**
   * Terminate a contract
   */
  static async terminateContract(
    contractId: string,
    providerId: string,
    reason: string
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      if (!['active', 'suspended', 'pending'].includes(contract.status)) {
        throw new ApiError(
          400,
          'Only active, suspended, or pending contracts can be terminated'
        );
      }

      contract.status = 'terminated';
      contract.terminatedAt = new Date();
      contract.terminationReason = reason;

      // Add to history
      contract.history.push({
        action: 'terminated',
        performedBy: providerId,
        performedAt: new Date(),
        details: `Terminated: ${reason}`,
      });

      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error terminating contract:', error);
      throw new ApiError(500, 'Failed to terminate contract');
    }
  }

  /**
   * Add team member to contract
   */
  static async addTeamMember(
    contractId: string,
    providerId: string,
    input: AddTeamMemberInput
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      // Check if member already exists
      const existingMember = contract.teamMembers.find(
        (m) => (m.email || '').toLowerCase() === input.email.toLowerCase()
      );
      if (existingMember) {
        throw new ApiError(400, 'Team member with this email already exists');
      }

      const normalizedEmail = input.email.toLowerCase();
      const user = await User.findOne({ email: normalizedEmail }).lean();
      const userId = user?._id?.toString();

      contract.teamMembers.push({
        name: input.name,
        email: normalizedEmail,
        phone: input.phone,
        role: input.role,
        assignedAt: new Date(),
        isActive: true,
        userId,
      });

      // Add to history
      contract.history.push({
        action: 'team_member_added',
        performedBy: providerId,
        performedAt: new Date(),
        details: `Added team member: ${input.name}`,
      });

      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error adding team member:', error);
      throw new ApiError(500, 'Failed to add team member');
    }
  }

  /**
   * Update team member
   */
  static async updateTeamMember(
    contractId: string,
    providerId: string,
    email: string,
    updates: Partial<AddTeamMemberInput>
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      const memberIndex = contract.teamMembers.findIndex(
        (m) =>
          (m.email || '').toLowerCase() === email.toLowerCase()
      );
      if (memberIndex === -1) {
        throw new ApiError(404, 'Team member not found');
      }

      if (updates.name) contract.teamMembers[memberIndex].name = updates.name;
      if (updates.phone) contract.teamMembers[memberIndex].phone = updates.phone;
      if (updates.role) contract.teamMembers[memberIndex].role = updates.role;

      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error updating team member:', error);
      throw new ApiError(500, 'Failed to update team member');
    }
  }

  /**
   * Remove team member from contract
   */
  static async removeTeamMember(
    contractId: string,
    providerId: string,
    email: string
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      const memberIndex = contract.teamMembers.findIndex(
        (m) =>
          (m.email || '').toLowerCase() === email.toLowerCase()
      );
      if (memberIndex === -1) {
        throw new ApiError(404, 'Team member not found');
      }

      const removedMember = contract.teamMembers[memberIndex];
      contract.teamMembers.splice(memberIndex, 1);

      // If removed member was primary contact, clear it
      if (
        contract.primaryContactId &&
        (contract.primaryContactId === removedMember.userId ||
          contract.primaryContactId === removedMember.email)
      ) {
        contract.primaryContactId = undefined;
      }

      // Add to history
      contract.history.push({
        action: 'team_member_removed',
        performedBy: providerId,
        performedAt: new Date(),
        details: `Removed team member: ${removedMember.name}`,
      });

      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error removing team member:', error);
      throw new ApiError(500, 'Failed to remove team member');
    }
  }

  /**
   * Set primary contact
   */
  static async setPrimaryContact(
    contractId: string,
    providerId: string,
    email: string
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      const member = contract.teamMembers.find(
        (m) => (m.email || '').toLowerCase() === email.toLowerCase()
      );
      if (!member) {
        throw new ApiError(404, 'Team member not found');
      }

      // Backwards compatible: older contracts may have team members without userId.
      contract.primaryContactId = member.userId ?? member.email;

      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error setting primary contact:', error);
      throw new ApiError(500, 'Failed to set primary contact');
    }
  }

  /**
   * Calculate SLA compliance
   */
  static async calculateSLACompliance(
    contractId: string,
    providerId: string
  ): Promise<{
    complianceRate: number;
    totalBookings: number;
    compliantBookings: number;
    breaches: {
      responseTime: number;
      completionTime: number;
      availability: number;
    };
    lastCalculatedAt: Date;
  }> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      const now = new Date();

      const serviceIds = (contract.serviceScope?.serviceIds || [])
        .map((id: string) => {
          try {
            return new Types.ObjectId(id);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Types.ObjectId[];

      const bookingsQuery: any = {
        providerId: contract.providerId,
        scheduledDate: { $gte: contract.startDate, $lte: contract.endDate },
        status: {
          $in: ['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
        },
      };

      if (serviceIds.length > 0) {
        bookingsQuery.serviceId = { $in: serviceIds };
      }

      const bookings = await Booking.find(bookingsQuery).lean();

      let totalBookings = bookings.length;
      let compliantBookings = 0;
      let responseTimeBreaches = 0;
      let completionTimeBreaches = 0;
      let availabilityBreaches = 0;

      for (const booking of bookings as any[]) {
        const status: string = booking.status;

        // Availability breach: anything that isn't completed.
        const availabilityBreached = status !== 'completed';
        if (availabilityBreached) availabilityBreaches++;

        // Response time breach
        let responseTimeBreached = false;
        const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
        const acceptedAt = booking.providerResponse?.acceptedAt
          ? new Date(booking.providerResponse.acceptedAt)
          : null;

        if (acceptedAt && createdAt) {
          const responseTimeMinutes =
            (acceptedAt.getTime() - createdAt.getTime()) / (1000 * 60);
          responseTimeBreached =
            responseTimeMinutes > contract.slaTerms.responseTimeMinutes;
        } else if (status === 'completed') {
          // For completed bookings we expect acceptance timestamps to exist.
          responseTimeBreached = true;
        }
        if (responseTimeBreached) responseTimeBreaches++;

        // Completion time breach
        let completionTimeBreached = false;
        const completedAt =
          booking.providerResponse?.completedAt
            ? new Date(booking.providerResponse.completedAt)
            : booking.completedAt
              ? new Date(booking.completedAt)
              : null;
        const expectedEnd = booking.estimatedEndTime
          ? new Date(booking.estimatedEndTime)
          : null;

        if (completedAt && expectedEnd) {
          const completionTimeHours =
            (completedAt.getTime() - expectedEnd.getTime()) / (1000 * 60 * 60);
          completionTimeBreached =
            completionTimeHours > contract.slaTerms.completionTimeHours;
        } else if (status === 'completed') {
          completionTimeBreached = true;
        }
        if (completionTimeBreached) completionTimeBreaches++;

        const isCompliant =
          status === 'completed' &&
          !availabilityBreached &&
          !responseTimeBreached &&
          !completionTimeBreached;

        if (isCompliant) compliantBookings++;
      }

      const complianceRate =
        totalBookings > 0
          ? Math.round((compliantBookings / totalBookings) * 100)
          : 100;

      contract.slaCompliance = {
        ...contract.slaCompliance,
        complianceRate,
        totalBookings,
        compliantBookings,
        responseTimeBreaches,
        completionTimeBreaches,
        availabilityBreaches,
        lastCalculatedAt: now,
      };

      const totalRevenue = (bookings as any[]).reduce((sum, b) => {
        const amount = b?.pricing?.totalAmount ?? 0;
        const paymentStatus = b?.payment?.status;
        return paymentStatus === 'pending' || paymentStatus === 'completed'
          ? sum + amount
          : sum;
      }, 0);

      contract.metrics = {
        ...contract.metrics,
        totalBookings,
        totalRevenue,
        lastCalculatedAt: now,
      };

      await contract.save();

      return {
        complianceRate,
        totalBookings,
        compliantBookings,
        breaches: {
          responseTime: contract.slaCompliance.responseTimeBreaches,
          completionTime: contract.slaCompliance.completionTimeBreaches,
          availability: contract.slaCompliance.availabilityBreaches,
        },
        lastCalculatedAt: now,
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error calculating SLA compliance:', error);
      throw new ApiError(500, 'Failed to calculate SLA compliance');
    }
  }

  /**
   * Generate a contract report for a given period.
   *
   * Important: this must be data-backed. Do not return placeholder/fabricated numbers.
   */
  static async generateReport(
    contractId: string,
    providerId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    contractId: string;
    contractNumber: string;
    clientName: string;
    period: { start: Date; end: Date };
    metrics: {
      totalBookings: number;
      completedBookings: number;
      cancelledBookings: number;
      totalRevenue: number;
      averageServiceValue: number;
    };
    slaCompliance: {
      totalBookings: number;
      compliantBookings: number;
      complianceRate: number;
      breaches: {
        responseTime: number;
        completionTime: number;
        availability: number;
      };
    };
    teamPerformance: Array<{
      memberName: string;
      bookingsHandled: number;
      averageRating: number;
    }>;
    financials: {
      totalInvoiced: number;
      totalPaid: number;
      pendingPayment: number;
    };
  }> {
    const contract = await ManagedContract.findOne({
      _id: new Types.ObjectId(contractId),
      providerId: new Types.ObjectId(providerId),
    }).lean<IManagedContract>();

    if (!contract) {
      throw new ApiError(404, 'Contract not found');
    }

    const periodStart = startDate ? new Date(startDate) : contract.startDate;
    const periodEnd = endDate ? new Date(endDate) : contract.endDate;

    const serviceIds = (contract.serviceScope?.serviceIds || [])
      .map((id: string) => {
        try {
          return new Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Types.ObjectId[];

    const bookingsQuery: any = {
      providerId: contract.providerId,
      scheduledDate: { $gte: periodStart, $lte: periodEnd },
      status: {
        $in: ['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
      },
    };

    if (serviceIds.length > 0) {
      bookingsQuery.serviceId = { $in: serviceIds };
    }

    const bookings = await Booking.find(bookingsQuery).lean();

    const totalBookings = bookings.length;
    const completedBookings = (bookings as any[]).filter(
      (b) => b.status === 'completed'
    ).length;
    const cancelledBookings = (bookings as any[]).filter(
      (b) => b.status === 'cancelled' || b.status === 'no_show'
    ).length;

    const totalInvoiced = (bookings as any[]).reduce((sum, b) => {
      const amount = b?.pricing?.totalAmount ?? 0;
      const paymentStatus = b?.payment?.status;
      return paymentStatus === 'pending' || paymentStatus === 'completed'
        ? sum + amount
        : sum;
    }, 0);

    const totalPaid = (bookings as any[]).reduce((sum, b) => {
      const amount = b?.pricing?.totalAmount ?? 0;
      return b?.payment?.status === 'completed' ? sum + amount : sum;
    }, 0);

    const pendingPayment = (bookings as any[]).reduce((sum, b) => {
      const amount = b?.pricing?.totalAmount ?? 0;
      return b?.payment?.status === 'pending' ? sum + amount : sum;
    }, 0);

    const averageServiceValue =
      totalBookings > 0 ? totalInvoiced / totalBookings : 0;

    // SLA compliance computation for this window (no placeholders).
    let compliantBookings = 0;
    let responseTimeBreaches = 0;
    let completionTimeBreaches = 0;
    let availabilityBreaches = 0;

    for (const booking of bookings as any[]) {
      const status: string = booking.status;

      const availabilityBreached = status !== 'completed';
      if (availabilityBreached) availabilityBreaches++;

      let responseTimeBreached = false;
      const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
      const acceptedAt = booking.providerResponse?.acceptedAt
        ? new Date(booking.providerResponse.acceptedAt)
        : null;

      if (acceptedAt && createdAt) {
        const responseTimeMinutes =
          (acceptedAt.getTime() - createdAt.getTime()) / (1000 * 60);
        responseTimeBreached =
          responseTimeMinutes > contract.slaTerms.responseTimeMinutes;
      } else if (status === 'completed') {
        responseTimeBreached = true;
      }
      if (responseTimeBreached) responseTimeBreaches++;

      let completionTimeBreached = false;
      const completedAt =
        booking.providerResponse?.completedAt
          ? new Date(booking.providerResponse.completedAt)
          : booking.completedAt
            ? new Date(booking.completedAt)
            : null;
      const expectedEnd = booking.estimatedEndTime
        ? new Date(booking.estimatedEndTime)
        : null;

      if (completedAt && expectedEnd) {
        const completionTimeHours =
          (completedAt.getTime() - expectedEnd.getTime()) /
          (1000 * 60 * 60);
        completionTimeBreached =
          completionTimeHours > contract.slaTerms.completionTimeHours;
      } else if (status === 'completed') {
        completionTimeBreached = true;
      }
      if (completionTimeBreached) completionTimeBreaches++;

      const isCompliant =
        status === 'completed' &&
        !availabilityBreached &&
        !responseTimeBreached &&
        !completionTimeBreached;

      if (isCompliant) compliantBookings++;
    }

    const complianceRate =
      totalBookings > 0
        ? Math.round((compliantBookings / totalBookings) * 100)
        : 100;

    return {
      contractId: contract._id.toString(),
      contractNumber: contract.contractNumber,
      clientName: contract.clientName,
      period: { start: periodStart, end: periodEnd },
      metrics: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        totalRevenue: totalInvoiced,
        averageServiceValue,
      },
      slaCompliance: {
        totalBookings,
        compliantBookings,
        complianceRate,
        breaches: {
          responseTime: responseTimeBreaches,
          completionTime: completionTimeBreaches,
          availability: availabilityBreaches,
        },
      },
      teamPerformance: [],
      financials: {
        totalInvoiced,
        totalPaid,
        pendingPayment,
      },
    };
  }

  /**
   * Get contract statistics
   */
  static async getStats(providerId: string): Promise<{
    byStatus: Record<string, { count: number; totalRevenue: number; totalBookings: number }>;
    totalContracts: number;
    totalRevenue: number;
    totalBookings: number;
    activeContracts: number;
  }> {
    try {
      const matchStage = { providerId: new Types.ObjectId(providerId) };

      const stats = await ManagedContract.aggregate([
        { $match: matchStage },
        {
          $facet: {
            byStatus: [
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 },
                  totalRevenue: { $sum: '$pricing.monthlyFee' },
                  totalBookings: { $sum: { $ifNull: ['$metrics.totalBookings', 0] } },
                },
              },
            ],
            totals: [
              {
                $group: {
                  _id: null,
                  totalContracts: { $sum: 1 },
                  totalRevenue: { $sum: '$pricing.monthlyFee' },
                  totalBookings: { $sum: { $ifNull: ['$metrics.totalBookings', 0] } },
                  activeContracts: {
                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
                  },
                },
              },
            ],
          },
        },
      ]);

      const byStatus: Record<string, { count: number; totalRevenue: number; totalBookings: number }> = {};
      const statusResults = stats[0]?.byStatus || [];
      for (const s of statusResults) {
        byStatus[s._id] = {
          count: s.count,
          totalRevenue: s.totalRevenue,
          totalBookings: s.totalBookings,
        };
      }

      const totals = stats[0]?.totals?.[0] || {
        totalContracts: 0,
        totalRevenue: 0,
        totalBookings: 0,
        activeContracts: 0,
      };

      return {
        byStatus,
        totalContracts: totals.totalContracts,
        totalRevenue: totals.totalRevenue,
        totalBookings: totals.totalBookings,
        activeContracts: totals.activeContracts,
      };
    } catch (error: any) {
      logger.error('Error getting contract stats:', error);
      throw new ApiError(500, 'Failed to get contract statistics');
    }
  }

  /**
   * Get active contracts
   */
  static async getActiveContracts(providerId: string): Promise<IManagedContract[]> {
    try {
      const contracts = await ManagedContract.find({
        providerId: new Types.ObjectId(providerId),
        status: 'active',
      }).lean();

      return contracts as unknown as IManagedContract[];
    } catch (error: any) {
      logger.error('Error getting active contracts:', error);
      throw new ApiError(500, 'Failed to get active contracts');
    }
  }

  /**
   * Get expiring contracts
   */
  static async getExpiringContracts(
    providerId: string,
    days: number = 30
  ): Promise<IManagedContract[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const contracts = await ManagedContract.find({
        providerId: new Types.ObjectId(providerId),
        status: 'active',
        endDate: { $lte: futureDate, $gte: new Date() },
      }).lean();

      return contracts as unknown as IManagedContract[];
    } catch (error: any) {
      logger.error('Error getting expiring contracts:', error);
      throw new ApiError(500, 'Failed to get expiring contracts');
    }
  }

  /**
   * Add document to contract
   */
  static async addDocument(
    contractId: string,
    providerId: string,
    document: { name: string; url: string; type: string }
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      contract.documents.push({
        name: document.name,
        url: document.url,
        type: document.type,
        uploadedAt: new Date(),
      });

      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error adding document:', error);
      throw new ApiError(500, 'Failed to add document');
    }
  }

  /**
   * Remove document from contract
   */
  static async removeDocument(
    contractId: string,
    providerId: string,
    documentName: string
  ): Promise<IManagedContract> {
    try {
      const contract = await ManagedContract.findOne({
        _id: new Types.ObjectId(contractId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!contract) {
        throw new ApiError(404, 'Contract not found');
      }

      const docIndex = contract.documents.findIndex((d) => d.name === documentName);
      if (docIndex === -1) {
        throw new ApiError(404, 'Document not found');
      }

      contract.documents.splice(docIndex, 1);
      await contract.save();
      return contract;
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      logger.error('Error removing document:', error);
      throw new ApiError(500, 'Failed to remove document');
    }
  }
}

export default ManagedContractService;
