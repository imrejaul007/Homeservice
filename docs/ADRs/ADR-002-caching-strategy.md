# ADR-002: Redis Caching Strategy

**Date:** 2024-01-15
**Status:** Accepted
**Deciders:** Engineering Team

## Context

We need to implement caching to reduce database load and improve response times.

## Decision

We will use **Redis** as the caching layer with a fallback to in-memory cache.

## Caching Strategy

### Cache-Aside Pattern
1. Check cache first
2. On miss, fetch from database
3. Store in cache with TTL
4. Return data

### TTL Guidelines

| Data Type | TTL | Reason |
|-----------|-----|--------|
| User session | 15 min | Security, frequent updates |
| Categories | 1 hour | Rarely change |
| Provider list | 30 min | Moderate change |
| Search results | 5 min | Frequently updated |
| Analytics | 5 min | Real-time needs |

### Cache Invalidation
- On write, invalidate related cache keys
- Use wildcard deletes for patterns
- TTL as fallback for eventual consistency

## Fallback Strategy

When Redis is unavailable:
1. Use in-memory Map as fallback
2. Log warning for monitoring
3. Continue operation without caching

## Implementation

```typescript
// Cache-aside pattern
async getOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached);

  const value = await factory();
  await cache.set(key, JSON.stringify(value), ttl);
  return value;
}
```

## Consequences

### Positive
- Reduced database load
- Faster response times
- Reduced costs

### Negative
- Cache invalidation complexity
- Stale data risk (mitigated by TTL)
- Redis as SPOF (mitigated by fallback)
