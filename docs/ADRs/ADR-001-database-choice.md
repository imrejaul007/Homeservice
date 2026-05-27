# ADR-001: MongoDB Database Choice

**Date:** 2024-01-15
**Status:** Accepted
**Deciders:** Engineering Team

## Context

We need to choose a database for NILIN's primary data store. The platform requires:
- Flexible schema for varying service types
- Geospatial queries for location-based services
- High write throughput for bookings
- ACID transactions for payments
- Horizontal scalability

## Decision

We will use **MongoDB** as the primary database.

## Rationale

### Benefits
1. **Flexible Schema**: Different services have different attributes
2. **Geospatial Indexes**: Native support for $near queries
3. **Document Model**: Maps naturally to our domain objects
4. **Horizontal Scaling**: Sharding for scale
5. **Transactions**: Multi-document ACID transactions
6. **JSON/BSON**: Native JavaScript compatibility

### Alternatives Considered

#### PostgreSQL
- Pros: ACID compliance, mature, PostGIS for geo
- Cons: Schema rigidity, harder to evolve

#### MySQL
- Pros: Wide adoption, good performance
- Cons: Schema rigidity, less flexible

#### DynamoDB
- Pros: Managed, serverless
- Cons: Vendor lock-in, limited query patterns

## Consequences

### Positive
- Rapid development with flexible schema
- Easy to add new service types
- Native JSON support

### Negative
- Eventual consistency in sharded setup
- Requires careful indexing strategy
- Less mature ecosystem than SQL

## Implementation

- Use Mongoose ODM for schema management
- Create compound indexes for common queries
- Use transactions for multi-document operations
