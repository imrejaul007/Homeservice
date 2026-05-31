import { Request, Response } from 'express';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import { getCircuitBreakerHealth, getAllCircuitBreakerStats } from '../services/circuitBreaker.service';

/**
 * Metrics endpoint for monitoring and alerting systems
 */
export const getMetrics = async (_req: Request, res: Response) => {
  try {
    // Memory usage
    const memoryUsage = process.memoryUsage();

    // CPU usage
    const cpuUsage = process.cpuUsage();

    // Uptime
    const uptime = process.uptime();

    // Database stats
    let dbStats = null;
    try {
      if (mongoose.connection.readyState === 1) {
        dbStats = await mongoose.connection.db?.stats();
      }
    } catch (error) {
      logger.warn('Failed to get database stats', { error });
    }

    // Response metrics
    const metrics = {
      // System metrics
      uptime_seconds: uptime,
      memory: {
        rss_bytes: memoryUsage.rss,
        heapTotal_bytes: memoryUsage.heapTotal,
        heapUsed_bytes: memoryUsage.heapUsed,
        external_bytes: memoryUsage.external,
      },
      cpu: {
        user_microseconds: cpuUsage.user,
        system_microseconds: cpuUsage.system,
      },

      // Application metrics
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,

      // Database metrics
      database: {
        connected: mongoose.connection.readyState === 1,
        readyState: mongoose.connection.readyState,
        collections: dbStats?.collections || 0,
        documents: dbStats?.objects || 0,
        avgObjSize: dbStats?.avgObjSize || 0,
        dataSize: dbStats?.dataSize || 0,
        storageSize: dbStats?.storageSize || 0,
        indexes: dbStats?.indexes || 0,
      },

      // Process info
      pid: process.pid,
      versions: process.versions,

      // Config info (non-sensitive)
      config: {
        node_env: process.env.NODE_ENV,
        port: process.env.PORT,
        log_level: process.env.LOG_LEVEL,
      },

      // Circuit breaker health
      circuitBreakers: {
        ...getCircuitBreakerHealth(),
        metrics: getAllCircuitBreakerStats(),
      },
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics', { error });
    res.status(500).json({
      error: 'Failed to collect metrics',
    });
  }
};

/**
 * Prometheus-formatted metrics endpoint
 */
export const getPrometheusMetrics = async (_req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    let dbConnections = 0;
    try {
      if (mongoose.connection.readyState === 1) {
        const adminDb = mongoose.connection.db?.admin();
        if (adminDb) {
          const serverStatus = await adminDb.serverStatus();
          dbConnections = serverStatus?.connections?.current || 0;
        }
      }
    } catch {
      // Ignore
    }

    const prometheusMetrics = `
# HELP nodejs_uptime_seconds Node.js process uptime in seconds
# TYPE nodejs_uptime_seconds gauge
nodejs_uptime_seconds ${uptime}

# HELP nodejs_memory_heap_used_bytes Process heap used memory in bytes
# TYPE nodejs_memory_heap_used_bytes gauge
nodejs_memory_heap_used_bytes ${memoryUsage.heapUsed}

# HELP nodejs_memory_heap_total_bytes Process heap total memory in bytes
# TYPE nodejs_memory_heap_total_bytes gauge
nodejs_memory_heap_total_bytes ${memoryUsage.heapTotal}

# HELP nodejs_memory_rss_bytes Process resident set memory in bytes
# TYPE nodejs_memory_rss_bytes gauge
nodejs_memory_rss_bytes ${memoryUsage.rss}

# HELP nodejs_external_memory_bytes Process external memory in bytes
# TYPE nodejs_external_memory_bytes gauge
nodejs_external_memory_bytes ${memoryUsage.external}

# HELP nodejs_active_connections Current number of active database connections
# TYPE nodejs_active_connections gauge
nodejs_active_connections ${dbConnections}

# HELP homeservice_info Application information
# TYPE homeservice_info gauge
homeservice_info{version="${process.env.APP_VERSION || '1.0.0'}",environment="${process.env.NODE_ENV}"} 1
`.trim();

    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    logger.error('Failed to get Prometheus metrics', { error });
    res.status(500).send('Failed to collect metrics');
  }
};

export default {
  getMetrics,
  getPrometheusMetrics,
};
