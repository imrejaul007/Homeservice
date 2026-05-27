import { eventBus, EventTypes, DomainEvent } from './eventBus';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

export interface SagaStep {
  execute(event: DomainEvent): Promise<void>;
  compensate?(event: DomainEvent): Promise<void>;
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

  async execute(sagaName: string, initialEvent: DomainEvent): Promise<void> {
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
export const bookingSaga: Saga = {
  name: 'booking-saga',
  steps: [
    {
      execute: async (event) => {
        // Step 1: Validate booking
        console.log('Saga: Validating booking');
      },
      compensate: async () => {
        console.log('Saga: Undo validation');
      },
    },
    {
      execute: async (event) => {
        // Step 2: Reserve provider
        console.log('Saga: Reserving provider');
        eventBus.publish({
          id: `saga-${Date.now()}`,
          type: EventTypes.BOOKING_CONFIRMED,
          payload: event.payload,
          metadata: event.metadata,
          version: 1,
        });
      },
      compensate: async (event) => {
        console.log('Saga: Releasing provider');
      },
    },
    {
      execute: async (event) => {
        // Step 3: Process payment
        console.log('Saga: Processing payment');
      },
      compensate: async (event) => {
        console.log('Saga: Refunding payment');
      },
    },
  ],
};

sagaOrchestrator.register(bookingSaga);
