import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { checkRedisConnection } from '../config/redis';

export const getHealth = async (req: Request, res: Response) => {
  try {
    const dbState = mongoose.connection.readyState;
    const isConnected = dbState === 1;

    if (!isConnected) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: { database: 'disconnected' },
      });
      return;
    }

    // Ping the database to verify connection
    await mongoose.connection.db?.admin().ping();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
};

export const getReadiness = async (req: Request, res: Response) => {
  try {
    const dbState = mongoose.connection.readyState;
    const isConnected = dbState === 1;
    const redisHealthy = await checkRedisConnection();

    const checks = {
      database: isConnected ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected',
    };

    const allHealthy = isConnected && redisHealthy;

    if (!allHealthy) {
      res.status(503).json({
        status: 'not_ready',
        ready: false,
        checks,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Ping the database to verify connection
    await mongoose.connection.db?.admin().ping();

    res.json({
      status: 'ready',
      ready: true,
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'not_ready',
      ready: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getLiveness = (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
};
