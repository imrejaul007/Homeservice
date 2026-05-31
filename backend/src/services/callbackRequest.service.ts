import mongoose, { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// TYPES & INTERFACES
// ============================================

export type CallbackStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_answer';

export interface CallbackRequest {
  _id: mongoose.Types.ObjectId;
  requestId: string;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail?: string;
  phoneNumber: string;
  preferredTime: Date;
  alternateTime?: Date;
  reason: string;
  category: 'general' | 'technical' | 'billing' | 'booking' | 'complaint';
  status: CallbackStatus;
  assignedTo?: mongoose.Types.ObjectId;
  assignedAgentName?: string;
  notes?: string;
  outcome?: string;
  duration?: number; // in seconds
  scheduledAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage for callbacks (in production, use MongoDB)
const callbacks: Map<string, CallbackRequest> = new Map();

// ============================================
// CALLBACK REQUEST SERVICE CLASS
// ============================================

export class CallbackRequestService {

  // ========================================
  // CREATE REQUEST
  // ========================================

  /**
   * Create a new callback request
   */
  async createRequest(
    customerId: string,
    customerName: string,
    customerEmail: string | undefined,
    phoneNumber: string,
    preferredTime: Date,
    reason: string,
    category: 'general' | 'technical' | 'billing' | 'booking' | 'complaint',
    alternateTime?: Date
  ): Promise<CallbackRequest> {
    // Validate phone number
    if (!this.isValidPhoneNumber(phoneNumber)) {
      throw new ApiError(400, 'Invalid phone number format');
    }

    // Validate preferred time is in the future
    if (preferredTime <= new Date()) {
      throw new ApiError(400, 'Preferred time must be in the future');
    }

    // Generate request ID
    const requestId = `CB${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Determine status based on preferred time
    const status: CallbackStatus = 'pending';

    const callback: CallbackRequest = {
      _id: new Types.ObjectId(),
      requestId,
      customerId: new Types.ObjectId(customerId),
      customerName,
      customerEmail,
      phoneNumber,
      preferredTime,
      alternateTime,
      reason,
      category,
      status,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    callbacks.set(requestId, callback);

    logger.info('Callback request created', {
      context: 'CallbackRequestService',
      action: 'REQUEST_CREATED',
      requestId,
      customerId,
      category,
      preferredTime
    });

    return callback;
  }

  /**
   * Get callback by ID
   */
  async getCallbackById(requestId: string): Promise<CallbackRequest | null> {
    return callbacks.get(requestId) || null;
  }

  /**
   * Get callbacks for customer
   */
  async getCustomerCallbacks(customerId: string): Promise<CallbackRequest[]> {
    const customerCallbacks: CallbackRequest[] = [];
    callbacks.forEach(callback => {
      if (callback.customerId.toString() === customerId) {
        customerCallbacks.push(callback);
      }
    });
    return customerCallbacks.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // ========================================
  // UPDATE REQUEST
  // ========================================

  /**
   * Schedule callback
   */
  async scheduleCallback(
    requestId: string,
    scheduledTime: Date,
    assignedTo?: string,
    assignedAgentName?: string
  ): Promise<CallbackRequest> {
    const callback = callbacks.get(requestId);

    if (!callback) {
      throw new ApiError(404, 'Callback request not found');
    }

    if (callback.status !== 'pending') {
      throw new ApiError(400, 'Can only schedule pending callbacks');
    }

    callback.status = 'scheduled';
    callback.scheduledAt = scheduledTime;
    callback.updatedAt = new Date();

    if (assignedTo) {
      callback.assignedTo = new Types.ObjectId(assignedTo);
      callback.assignedAgentName = assignedAgentName;
    }

    callbacks.set(requestId, callback);

    logger.info('Callback scheduled', {
      context: 'CallbackRequestService',
      action: 'CALLBACK_SCHEDULED',
      requestId,
      scheduledTime,
      assignedTo
    });

    return callback;
  }

  /**
   * Start callback
   */
  async startCallback(requestId: string, agentId: string, agentName: string): Promise<CallbackRequest> {
    const callback = callbacks.get(requestId);

    if (!callback) {
      throw new ApiError(404, 'Callback request not found');
    }

    if (!['pending', 'scheduled'].includes(callback.status)) {
      throw new ApiError(400, 'Can only start pending or scheduled callbacks');
    }

    callback.status = 'in_progress';
    callback.assignedTo = new Types.ObjectId(agentId);
    callback.assignedAgentName = agentName;
    callback.updatedAt = new Date();

    callbacks.set(requestId, callback);

    logger.info('Callback started', {
      context: 'CallbackRequestService',
      action: 'CALLBACK_STARTED',
      requestId,
      agentId
    });

    return callback;
  }

  /**
   * Complete callback
   */
  async completeCallback(
    requestId: string,
    outcome: string,
    notes?: string
  ): Promise<CallbackRequest> {
    const callback = callbacks.get(requestId);

    if (!callback) {
      throw new ApiError(404, 'Callback request not found');
    }

    if (callback.status !== 'in_progress') {
      throw new ApiError(400, 'Can only complete callbacks that are in progress');
    }

    callback.status = 'completed';
    callback.outcome = outcome;
    callback.notes = notes;
    callback.completedAt = new Date();
    callback.duration = Math.floor(
      (Date.now() - new Date(callback.createdAt).getTime()) / 1000
    );
    callback.updatedAt = new Date();

    callbacks.set(requestId, callback);

    logger.info('Callback completed', {
      context: 'CallbackRequestService',
      action: 'CALLBACK_COMPLETED',
      requestId,
      outcome
    });

    return callback;
  }

  /**
   * Mark as no answer
   */
  async markNoAnswer(requestId: string, attemptNotes?: string): Promise<CallbackRequest> {
    const callback = callbacks.get(requestId);

    if (!callback) {
      throw new ApiError(404, 'Callback request not found');
    }

    if (!['pending', 'scheduled', 'in_progress'].includes(callback.status)) {
      throw new ApiError(400, 'Invalid callback status');
    }

    callback.status = 'no_answer';
    callback.notes = attemptNotes;
    callback.updatedAt = new Date();

    callbacks.set(requestId, callback);

    logger.info('Callback marked as no answer', {
      context: 'CallbackRequestService',
      action: 'CALLBACK_NO_ANSWER',
      requestId
    });

    return callback;
  }

  /**
   * Cancel callback request
   */
  async cancelCallback(
    requestId: string,
    cancelledBy: string,
    reason: string
  ): Promise<CallbackRequest> {
    const callback = callbacks.get(requestId);

    if (!callback) {
      throw new ApiError(404, 'Callback request not found');
    }

    if (['completed', 'cancelled'].includes(callback.status)) {
      throw new ApiError(400, 'Callback is already completed or cancelled');
    }

    callback.status = 'cancelled';
    callback.cancelledAt = new Date();
    callback.cancelledBy = new Types.ObjectId(cancelledBy);
    callback.cancellationReason = reason;
    callback.updatedAt = new Date();

    callbacks.set(requestId, callback);

    logger.info('Callback cancelled', {
      context: 'CallbackRequestService',
      action: 'CALLBACK_CANCELLED',
      requestId,
      cancelledBy,
      reason
    });

    return callback;
  }

  /**
   * Reschedule callback
   */
  async rescheduleCallback(
    requestId: string,
    newTime: Date
  ): Promise<CallbackRequest> {
    const callback = callbacks.get(requestId);

    if (!callback) {
      throw new ApiError(404, 'Callback request not found');
    }

    if (!['pending', 'scheduled'].includes(callback.status)) {
      throw new ApiError(400, 'Can only reschedule pending or scheduled callbacks');
    }

    if (newTime <= new Date()) {
      throw new ApiError(400, 'New time must be in the future');
    }

    callback.preferredTime = newTime;
    callback.status = 'pending';
    callback.scheduledAt = undefined;
    callback.updatedAt = new Date();

    callbacks.set(requestId, callback);

    logger.info('Callback rescheduled', {
      context: 'CallbackRequestService',
      action: 'CALLBACK_RESCHEDULED',
      requestId,
      newTime
    });

    return callback;
  }

  // ========================================
  // ADMIN OPERATIONS
  // ========================================

  /**
   * Get all pending callbacks
   */
  async getPendingCallbacks(): Promise<CallbackRequest[]> {
    const pending: CallbackRequest[] = [];
    callbacks.forEach(callback => {
      if (callback.status === 'pending') {
        pending.push(callback);
      }
    });
    return pending.sort((a, b) =>
      new Date(a.preferredTime).getTime() - new Date(b.preferredTime).getTime()
    );
  }

  /**
   * Get callbacks for agent
   */
  async getAgentCallbacks(agentId: string): Promise<CallbackRequest[]> {
    const agentCallbacks: CallbackRequest[] = [];
    callbacks.forEach(callback => {
      if (callback.assignedTo?.toString() === agentId) {
        agentCallbacks.push(callback);
      }
    });
    return agentCallbacks.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get callbacks by status
   */
  async getCallbacksByStatus(status: CallbackStatus): Promise<CallbackRequest[]> {
    const filtered: CallbackRequest[] = [];
    callbacks.forEach(callback => {
      if (callback.status === status) {
        filtered.push(callback);
      }
    });
    return filtered;
  }

  /**
   * Get all callbacks (admin)
   */
  async getAllCallbacks(
    filters?: {
      status?: CallbackStatus;
      category?: string;
      assignedTo?: string;
      startDate?: string;
      endDate?: string;
    },
    page: number = 1,
    limit: number = 20
  ): Promise<{ callbacks: CallbackRequest[]; total: number; pages: number }> {
    let filtered: CallbackRequest[] = [];
    callbacks.forEach(callback => {
      let matches = true;

      if (filters?.status && callback.status !== filters.status) matches = false;
      if (filters?.category && callback.category !== filters.category) matches = false;
      if (filters?.assignedTo && callback.assignedTo?.toString() !== filters.assignedTo) matches = false;

      if (filters?.startDate && new Date(callback.createdAt) < new Date(filters.startDate)) matches = false;
      if (filters?.endDate && new Date(callback.createdAt) > new Date(filters.endDate)) matches = false;

      if (matches) filtered.push(callback);
    });

    // Sort by createdAt descending
    filtered.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = filtered.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return { callbacks: paginated, total, pages };
  }

  // ========================================
  // STATISTICS
  // ========================================

  /**
   * Get callback statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    noAnswer: number;
    avgDuration: number;
    byCategory: Record<string, number>;
  }> {
    const stats = {
      total: 0,
      pending: 0,
      scheduled: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      noAnswer: 0,
      avgDuration: 0,
      byCategory: {} as Record<string, number>
    };

    const statusKeyMap: Record<CallbackStatus, keyof typeof stats | null> = {
      pending: 'pending',
      scheduled: 'scheduled',
      in_progress: 'inProgress',
      completed: 'completed',
      cancelled: 'cancelled',
      no_answer: 'noAnswer',
    };

    const durations: number[] = [];

    callbacks.forEach(callback => {
      stats.total++;
      const statKey = statusKeyMap[callback.status];
      if (statKey && statKey !== 'byCategory' && statKey !== 'avgDuration') {
        (stats[statKey] as number)++;
      }
      stats.byCategory[callback.category] = (stats.byCategory[callback.category] || 0) + 1;

      if (callback.duration) {
        durations.push(callback.duration);
      }
    });

    if (durations.length > 0) {
      stats.avgDuration = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      );
    }

    return stats;
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Basic validation - allows international format with +, numbers, spaces, dashes
    const phoneRegex = /^[+]?[\d\s\-()]{8,20}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Get available time slots for callback scheduling
   */
  async getAvailableTimeSlots(
    date: Date,
    duration: number = 30
  ): Promise<{ time: Date; available: boolean }[]> {
    const slots: { time: Date; available: boolean }[] = [];
    const startHour = 9; // 9 AM
    const endHour = 18; // 6 PM

    const slotDate = new Date(date);
    slotDate.setHours(startHour, 0, 0, 0);

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += duration) {
        const slotTime = new Date(slotDate);
        slotTime.setHours(hour, minute);

        // Check if slot is in the past
        if (slotTime <= new Date()) {
          slots.push({ time: slotTime, available: false });
          continue;
        }

        // Check if slot is already booked
        let available = true;
        callbacks.forEach(callback => {
          if (
            callback.status === 'scheduled' &&
            callback.scheduledAt &&
            new Date(callback.scheduledAt).getTime() === slotTime.getTime()
          ) {
            available = false;
          }
        });

        slots.push({ time: slotTime, available });
      }
    }

    return slots;
  }
}

// ============================================
// EXPORT SERVICE INSTANCE
// ============================================

export const callbackRequestService = new CallbackRequestService();
export default callbackRequestService;
