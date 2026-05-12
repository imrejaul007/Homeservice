// Import Sentry instrumentation FIRST - before anything else
require('../instrument.js');

import http from 'http';
import app from './app';
import database from './config/database';
import logger from './utils/logger';
import { initializeSocketServer } from './socket';
import { initializeEventSubscriptions } from './event-bus';
import { initializeIndexes } from './services/search.service';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initializeSocketServer(server);

// Server configuration
const PORT = process.env.PORT || 5000;

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error('Reason:', reason);
  logger.error('Promise:', promise);
  server.close(async () => {
    process.exit(1);
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Close Socket.io connections
  const socketServer = await import('./socket');
  const io = socketServer.getSocketServer();
  if (io) {
    io.getIO().close();
    logger.info('Socket.io server closed');
  }

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await database.disconnect();
      logger.info('Database connection closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await database.connect();

    // Seed database in production
    if (process.env.NODE_ENV === 'production') {
      try {
        const { seedDatabase } = await import('./seeders/index');
        await seedDatabase();
        logger.info('Database seeded successfully');
      } catch (seedError) {
        logger.warn('Database seeding skipped or failed:', seedError);
      }
    }

    // Initialize event subscriptions
    try {
      await initializeEventSubscriptions();
      logger.info('Event subscriptions initialized');
    } catch (error) {
      logger.warn('Event subscriptions initialization failed:', error);
    }

    // Initialize search indexes (Meilisearch)
    try {
      await initializeIndexes();
      logger.info('Search indexes initialized');
    } catch (error) {
      logger.warn('Search indexes initialization failed:', error);
    }

    // Start listening
    server.listen(PORT, () => {
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info(`Home Service API Server Started`);
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Server URL: http://localhost:${PORT}`);
      logger.info(`Health Check: http://localhost:${PORT}/health`);
      logger.info(`API Test: http://localhost:${PORT}/api/test`);
      logger.info(`API Version: ${process.env.API_VERSION || 'v1'}`);
      logger.info(`Socket.io: Enabled`);
      logger.info('═══════════════════════════════════════════════════════════');

      if (process.env.NODE_ENV === 'development') {
        logger.info('Development mode - All logs enabled');
        logger.info('Nodemon watching for changes...');
      }
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error:', error);
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Initialize server
startServer();
