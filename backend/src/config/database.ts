import mongoose from 'mongoose';
import winston from 'winston';

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
});

interface DatabaseConfig {
  uri: string;
  options?: mongoose.ConnectOptions;
}

class Database {
  private static instance: Database;
  private isConnected: boolean = false;

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
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      }
    };

    try {
      mongoose.set('strictQuery', true);
      
      await mongoose.connect(dbConfig.uri, dbConfig.options);
      
      this.isConnected = true;
      logger.info('✅ MongoDB Connected Successfully');
      logger.info(`📍 Database: ${mongoose.connection.name}`);
      logger.info(`🏠 Host: ${mongoose.connection.host}`);

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        this.isConnected = true;
        logger.info('MongoDB reconnected');
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      logger.error('❌ MongoDB connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
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
    host: string | undefined;
    name: string | undefined;
  } {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  async ping(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await mongoose.connection.db?.admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}

export default Database.getInstance();