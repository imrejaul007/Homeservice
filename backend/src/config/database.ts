import mongoose from 'mongoose';
import winston from 'winston';

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

// Connection pool configuration
const POOL_CONFIG = {
  maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10'),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2'),
  maxPoolSizeInFlight: parseInt(process.env.MONGODB_MAX_POOL_SIZE_IN_FLIGHT || '50'),
  socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000'),
  serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000'),
  connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS || '10000'),
  family: 4, // IPv4
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: parseInt(process.env.MONGODB_MAX_RETRIES || '3'),
  retryIntervalMs: parseInt(process.env.MONGODB_RETRY_INTERVAL_MS || '1000'),
  backoffMultiplier: parseInt(process.env.MONGODB_BACKOFF_MULTIPLIER || '2'),
};

interface DatabaseConfig {
  uri: string;
  options?: mongoose.ConnectOptions;
}

class Database {
  private static instance: Database;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('MongoDB is already connected');
      return;
    }

    const dbConfig: DatabaseConfig = {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/home_service_marketplace',
      options: {
        // Connection pool settings
        maxPoolSize: POOL_CONFIG.maxPoolSize,
        minPoolSize: POOL_CONFIG.minPoolSize,

        // Timeouts
        socketTimeoutMS: POOL_CONFIG.socketTimeoutMS,
        serverSelectionTimeoutMS: POOL_CONFIG.serverSelectionTimeoutMS,
        connectTimeoutMS: POOL_CONFIG.connectTimeoutMS,

        // Network
        family: POOL_CONFIG.family,

        // Buffering
        bufferCommands: true,

        // Direct connection for replica set
        directConnection: process.env.MONGODB_DIRECT_CONNECTION === 'true',

        // App name for monitoring
        appName: 'NILIN-HomeService-API',

        // Write concern
        w: (process.env.MONGODB_WRITE_CONCERN || 'majority') as 'majority',
        wtimeoutMS: parseInt(process.env.MONGODB_WTIMEOUT_MS || '2500'),

        // Read preference
        readPreference: (process.env.MONGODB_READ_PREFERENCE as 'primaryPreferred') || 'primaryPreferred',

        // TLS/SSL
        ...(process.env.MONGODB_TLS === 'true' && {
          tls: true,
          tlsAllowInvalidCertificates: process.env.MONGODB_TLS_ALLOW_INVALID === 'true',
          tlsCAFile: process.env.MONGODB_TLS_CA_FILE,
          tlsCertificateKeyFile: process.env.MONGODB_TLS_CERT_FILE,
        }),
      }
    };

    try {
      mongoose.set('strictQuery', true);

      // Set default connection options
      mongoose.set('returnOriginal', false);

      await mongoose.connect(dbConfig.uri, dbConfig.options);

      this.isConnected = true;
      this.connectionRetries = 0;

      logger.info('✅ MongoDB Connected Successfully');
      logger.info(`📍 Database: ${mongoose.connection.name}`);
      logger.info(`🏠 Host: ${mongoose.connection.host}`);
      logger.info(`🔗 Pool Size: min=${POOL_CONFIG.minPoolSize}, max=${POOL_CONFIG.maxPoolSize}`);

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.handleConnectionError();
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('MongoDB disconnected');
        this.handleDisconnection();
      });

      mongoose.connection.on('reconnected', () => {
        this.isConnected = true;
        this.connectionRetries = 0;
        logger.info('MongoDB reconnected');
      });

      mongoose.connection.on('close', () => {
        this.isConnected = false;
        logger.info('MongoDB connection closed');
      });

      // Start health check interval
      this.startHealthCheck();

      // Graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('❌ MongoDB connection failed:', error);
      this.isConnected = false;
      this.handleConnectionError();
      throw error;
    }
  }

  /**
   * Handle connection errors with retry logic
   */
  private handleConnectionError(): void {
    if (this.connectionRetries < RETRY_CONFIG.maxRetries) {
      this.connectionRetries++;
      const delay = RETRY_CONFIG.retryIntervalMs * Math.pow(RETRY_CONFIG.backoffMultiplier, this.connectionRetries - 1);

      logger.info(`MongoDB reconnection attempt ${this.connectionRetries}/${RETRY_CONFIG.maxRetries} in ${delay}ms`);

      setTimeout(() => {
        this.connect().catch((err) => {
          logger.error('MongoDB reconnection failed:', err);
        });
      }, delay);
    } else {
      logger.error('MongoDB max reconnection attempts reached');
    }
  }

  /**
   * Handle disconnection events
   */
  private handleDisconnection(): void {
    if (!this.healthCheckInterval) {
      this.startHealthCheck();
    }
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const intervalMs = parseInt(process.env.MONGODB_HEALTH_CHECK_INTERVAL_MS || '30000');

    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.ping();
        if (isHealthy && !this.isConnected) {
          this.isConnected = true;
          logger.info('MongoDB health check passed, connection restored');
        } else if (!isHealthy && this.isConnected) {
          this.isConnected = false;
          logger.warn('MongoDB health check failed');
        }
      } catch (error) {
        this.isConnected = false;
        logger.warn('MongoDB health check error:', error);
      }
    }, intervalMs);
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      // Stop health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Wait for existing operations to complete
      logger.info('Waiting for in-flight operations to complete...');
      await this.drainConnection();

      // Close connection
      await this.disconnect();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Drain existing connections before shutdown
   */
  private async drainConnection(): Promise<void> {
    const drainTimeout = parseInt(process.env.MONGODB_DRAIN_TIMEOUT_MS || '10000');
    const startTime = Date.now();

    while (mongoose.connection.readyState === 1) {
      if (Date.now() - startTime > drainTimeout) {
        logger.warn('Drain timeout exceeded, forcing close');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (!this.isConnected && mongoose.connection.readyState === 0) {
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('MongoDB disconnected gracefully');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnectionStatus(): {
    isConnected: boolean;
    readyState: number;
    readyStateText: string;
    host: string | undefined;
    name: string | undefined;
    poolSize: number;
    buffers: number;
  } {
    const readyStateTexts = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      readyStateText: readyStateTexts[mongoose.connection.readyState] || 'unknown',
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      poolSize: (mongoose.connection as any).pool?.size() || 0,
      buffers: (mongoose.connection as any).buffer?.length || 0,
    };
  }

  async ping(): Promise<boolean> {
    if (!this.isConnected && mongoose.connection.readyState !== 1) {
      return false;
    }

    try {
      const adminDb = mongoose.connection.db?.admin();
      if (!adminDb) {
        return false;
      }
      await adminDb.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): {
    size: number;
    available: number;
    checkedOut: number;
  } {
    const pool = (mongoose.connection as any).pool;
    return {
      size: pool?.size() || 0,
      available: pool?.available?.length() || 0,
      checkedOut: pool?.checkedOut?.length || 0,
    };
  }

  /**
   * Force close all connections (use with caution)
   */
  async forceClose(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    try {
      await mongoose.connection.close(true);
      this.isConnected = false;
      logger.info('MongoDB connections force closed');
    } catch (error) {
      logger.error('Error force closing MongoDB connections:', error);
      throw error;
    }
  }
}

export default Database.getInstance();
export { POOL_CONFIG, RETRY_CONFIG };