# NILIN Monitoring and Observability Guide

## Overview

NILIN uses a comprehensive observability stack for monitoring, logging, and alerting.

## Stack Components

| Component | Purpose | Default Port |
|-----------|---------|--------------|
| Prometheus | Metrics collection | 9090 |
| Grafana | Dashboards and visualization | 3000 |
| Loki | Log aggregation | 3100 |
| Jaeger | Distributed tracing | 16686 |
| Alertmanager | Alert routing | 9093 |

## Key Metrics

### API Metrics
```promql
# Request rate
rate(http_requests_total{job="nilin-api"}[5m])

# Error rate
rate(http_requests_total{job="nilin-api",status=~"5.."}[5m])

# Latency p99
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Active connections
sum(http_connections_active{job="nilin-api"})
```

### Business Metrics
```promql
# Booking rate
rate(bookings_created_total[5m])

# Revenue
rate(payments_completed_total[1h]) * 100

# Active users
sum(user_sessions_active)

# Provider availability
sum(provider_online) / count(provider_total)
```

### System Metrics
```promql
# CPU usage
sum(rate(container_cpu_usage_seconds_total{job="nilin-api"}[5m])) by (pod)

# Memory usage
sum(container_memory_working_set_bytes{job="nilin-api"}) by (pod)

# Network I/O
sum(rate(container_network_receive_bytes_total[5m])) by (pod)
```

## Alert Rules

### Critical Alerts
```yaml
# api-down
- alert: APIUnreachable
  expr: up{job="nilin-api"} == 0
  for: 1m
  severity: critical

# high-error-rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 2m
  severity: critical

# payment-failures
- alert: HighPaymentFailureRate
  expr: rate(payment_failures_total[5m]) > 0.1
  for: 2m
  severity: critical
```

### Warning Alerts
```yaml
# high-latency
- alert: HighLatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
  for: 5m
  severity: warning

# disk-space-low
- alert: LowDiskSpace
  expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.15
  for: 5m
  severity: warning

# queue-backlog
- alert: QueueBacklogGrowing
  expr: rate(queue_depth[5m]) > rate(queue_processed[5m])
  for: 10m
  severity: warning
```

## Dashboards

### Executive Dashboard
- Total users, bookings, revenue (daily/weekly/monthly)
- Conversion funnels
- Provider utilization
- Customer satisfaction (CSAT)

### Operations Dashboard
- API health and latency
- Error rates by type
- Worker queue depth
- Database connections
- Cache hit rates

### Business Dashboard
- Bookings by category
- Revenue by provider
- Loyalty program metrics
- Offer redemption rates

## Logging

### Log Levels
- **ERROR**: Failures requiring immediate attention
- **WARN**: Potential issues or degraded behavior
- **INFO**: Significant business events
- **DEBUG**: Detailed debugging information

### Structured Log Format
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "nilin-api",
  "trace_id": "abc123",
  "user_id": "user_456",
  "action": "booking_created",
  "duration_ms": 245,
  "metadata": {
    "booking_id": "bk_789",
    "provider_id": "prov_101"
  }
}
```

### Query Examples
```logql
# All errors in last hour
{job="nilin-api"} |= "level=error" | json | duration > 1s

# Bookings by user
{job="nilin-api"} | json | action="booking_created"

# Slow requests
{job="nilin-api"} | json | duration_ms > 1000
```

## Tracing

### Trace Attributes
- `trace_id`: Unique trace identifier
- `span_id`: Unique span identifier
- `service.name`: Service name
- `http.method`: HTTP method
- `http.route`: Route path
- `user.id`: User identifier (if authenticated)

### Common Traces
- Request lifecycle
- Database queries
- External API calls
- Queue job processing
- Payment processing

## SLOs

| Service | Availability | Latency | Error Rate |
|---------|-------------|---------|------------|
| API | 99.9% | p99 < 500ms | < 0.1% |
| Payments | 99.95% | p99 < 2s | < 0.01% |
| Notifications | 99.5% | p99 < 5s | < 0.5% |

## On-Call Procedures

### Incident Response
1. Acknowledge alert in PagerDuty
2. Check dashboard for affected services
3. Review recent deployments
4. Check error logs and traces
5. Mitigate issue (rollback, scale, restart)
6. Update status page
7. Write incident report

### Escalation Path
1. On-call engineer (5 min)
2. Team lead (15 min)
3. Engineering manager (30 min)
4. VP Engineering (1 hour)
