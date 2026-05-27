import { eventBus } from '../events/eventBus';
import { v4 as uuid } from 'uuid';

export interface Command {
  id: string;
  type: string;
  payload: any;
  metadata: {
    timestamp: Date;
    userId?: string;
    correlationId?: string;
  };
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Command handlers registry
type CommandHandler<T = any, R = any> = (
  command: T,
  metadata?: Partial<Command['metadata']>
) => Promise<R>;

const handlers = new Map<string, CommandHandler>();

export const registerCommand = <T = any, R = any>(
  type: string,
  handler: CommandHandler<T, R>
): void => {
  handlers.set(type, handler);
};

export const executeCommand = async <T = any, R = any>(
  type: string,
  payload: T,
  metadata: Partial<Command['metadata']> = {}
): Promise<CommandResult<R>> => {
  const handler = handlers.get(type);
  if (!handler) {
    return { success: false, error: `Handler not found: ${type}` };
  }

  try {
    const result = await handler(payload, metadata);
    return { success: true, data: result as R };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

// Commands
export const CreateBookingCommand = {
  type: 'CreateBooking',
  execute: async (payload: {
    serviceId: string;
    providerId: string;
    scheduledDate: string;
    customerId: string;
  }): Promise<{ bookingId: string }> => {
    // Create booking command handler
    const bookingId = uuid();

    eventBus.publish({
      id: uuid(),
      type: 'booking.created',
      payload: { bookingId, ...payload },
      metadata: { timestamp: new Date() },
      version: 1,
    });

    return { bookingId };
  },
};

export const ConfirmBookingCommand = {
  type: 'ConfirmBooking',
  execute: async (payload: { bookingId: string }): Promise<{ success: boolean }> => {
    eventBus.publish({
      id: uuid(),
      type: 'booking.confirmed',
      payload,
      metadata: { timestamp: new Date() },
      version: 1,
    });
    return { success: true };
  },
};

export const CancelBookingCommand = {
  type: 'CancelBooking',
  execute: async (payload: { bookingId: string; reason?: string }): Promise<{ success: boolean }> => {
    eventBus.publish({
      id: uuid(),
      type: 'booking.cancelled',
      payload,
      metadata: { timestamp: new Date() },
      version: 1,
    });
    return { success: true };
  },
};

export const ProcessPaymentCommand = {
  type: 'ProcessPayment',
  execute: async (payload: { bookingId: string; amount: number }): Promise<{ success: boolean }> => {
    eventBus.publish({
      id: uuid(),
      type: 'payment.pending',
      payload,
      metadata: { timestamp: new Date() },
      version: 1,
    });
    return { success: true };
  },
};

// Register commands
registerCommand(CreateBookingCommand.type, CreateBookingCommand.execute);
registerCommand(ConfirmBookingCommand.type, ConfirmBookingCommand.execute);
registerCommand(CancelBookingCommand.type, CancelBookingCommand.execute);
registerCommand(ProcessPaymentCommand.type, ProcessPaymentCommand.execute);
