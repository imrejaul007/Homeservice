/**
 * Test Setup
 * Configures Jest environment for backend tests
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-4000-8000-000000000001'),
}));

let mongoServer: MongoMemoryServer;

// Global setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-jwt-testing';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-jwt-testing';

  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Set MONGODB_URI for environment checks (e.g., user model cascade delete)
  process.env.MONGODB_URI = mongoUri;

  // Connect to the in-memory database
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });

  console.log('MongoDB Memory Server connected');
});

// Global teardown
afterAll(async () => {
  // Close all model connections
  await mongoose.disconnect();

  // Stop the memory server
  await mongoServer.stop();

  console.log('MongoDB Memory Server disconnected');
});

// Clear collections before each test
beforeEach(async () => {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }

  // Reset all mocks
  jest.clearAllMocks();
});

// Increase timeout for database operations
jest.setTimeout(60000);

export { mongoServer };
