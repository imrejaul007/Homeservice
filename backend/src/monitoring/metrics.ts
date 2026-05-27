// @ts-expect-error prom-client types will be installed
import { Counter, Histogram, Gauge, Summary } from 'prom-client';

// HTTP metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Business metrics
export const bookingsTotal = new Counter({
  name: 'bookings_total',
  help: 'Total number of bookings',
  labelNames: ['status'],
});

export const bookingsValue = new Histogram({
  name: 'bookings_value_aed',
  help: 'Booking value in AED',
  labelNames: ['status'],
  buckets: [50, 100, 200, 500, 1000, 2000],
});

export const activeBookingsGauge = new Gauge({
  name: 'active_bookings_total',
  help: 'Current number of active bookings',
});

export const providersActiveGauge = new Gauge({
  name: 'providers_active_total',
  help: 'Current number of active providers',
});

// Database metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'collection'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
});

// Queue metrics
export const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'job_type', 'status'],
});

export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30],
});

// Payment metrics
export const paymentTotal = new Counter({
  name: 'payments_total',
  help: 'Total number of payments',
  labelNames: ['status', 'method'],
});

export const paymentValue = new Histogram({
  name: 'payment_value_aed',
  help: 'Payment value in AED',
  labelNames: ['status'],
  buckets: [50, 100, 200, 500, 1000],
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity'],
});

// Cache metrics
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
});
