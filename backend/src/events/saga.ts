import { eventBus, EVENT_TYPES, PlatformEvent } from '../event-bus/index';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

export interface SagaStep {
  execute(event: PlatformEvent): Promise<void>;
  compensate?(event: PlatformEvent): Promise<void>;
}

export interface Saga {
  name: string;
  steps: SagaStep[];
}

class SagaOrchestrator {
  private sagas = new Map<string, Saga>();

  register(saga: Saga): void {
    this.sagas.set(saga.name, saga);
    logger.debug('Saga registered', { context: 'SagaOrchestrator', sagaName: saga.name });
  }

  async execute(sagaName: string, initialEvent: PlatformEvent): Promise<void> {
    const saga = this.sagas.get(sagaName);
    if (!saga) {
      throw ApiError.notFound(`Saga not found: ${sagaName}`, ERROR_CODES.NOT_FOUND);
    }

    const executedSteps: SagaStep[] = [];

    try {
      for (const step of saga.steps) {
        await step.execute(initialEvent);
        executedSteps.push(step);
      }
      logger.info('Saga completed successfully', { context: 'SagaOrchestrator', sagaName });
    } catch (error) {
      logger.error('Saga failed, compensating...', { context: 'SagaOrchestrator', sagaName, error: error instanceof Error ? error.message : String(error) });

      // Compensate in reverse order
      for (const step of executedSteps.reverse()) {
        if (step.compensate) {
          try {
            await step.compensate(initialEvent);
          } catch (compensateError) {
            logger.error('Compensation failed', { context: 'SagaOrchestrator', sagaName, error: compensateError instanceof Error ? compensateError.message : String(compensateError) });
          }
        }
      }

      throw error;
    }
  }
}

export const sagaOrchestrator = new SagaOrchestrator();

// Booking Saga
interface SagaEventPayload {
  bookingId?: string;
  [key: string]: unknown;
}

export const bookingSaga: Saga = {
  name: 'booking-saga',
  steps: [
    {
      execute: async (event) => {
        // Step 1: Validate booking
        const payload = event.data as SagaEventPayload;
        logger.debug('Saga: Validating booking', { context: 'BookingSaga', bookingId: payload.bookingId });
      },
      compensate: async () => {
        logger.debug('Saga: Undo validation', { context: 'BookingSaga' });
      },
    },
    {
      execute: async (event) => {
        // Step 2: Reserve provider
        logger.debug('Saga: Reserving provider', { context: 'BookingSaga' });
        eventBus.publish(EVENT_TYPES.BOOKING_CONFIRMED, event.data, event.metadata);
      },
      compensate: async (event) => {
        logger.debug('Saga: Releasing provider', { context: 'BookingSaga' });
      },
    },
    {
      execute: async (event) => {
        // Step 3: Process payment
        logger.debug('Saga: Processing payment', { context: 'BookingSaga' });
      },
      compensate: async (event) => {
        logger.debug('Saga: Refunding payment', { context: 'BookingSaga' });
      },
    },
  ],
};

sagaOrchestrator.register(bookingSaga);
