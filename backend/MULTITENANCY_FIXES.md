# MULTITENANCY CRITICAL FIXES

This file contains code fixes for all critical issues identified in the audit.

---

## FIX 1: Add tenantId to ProviderProfile

File: backend/src/models/providerProfile.model.ts

Add after userId field:

```typescript
tenantId: {
  type: Schema.Types.ObjectId,
  ref: 'Tenant',
  required: true,
  index: true
},
```

Add compound unique index:

```typescript
providerProfileSchema.index({ userId: 1, tenantId: 1 }, { unique: true });
```

---

## FIX 2: Add tenantId to CustomerProfile

File: backend/src/models/customerProfile.model.ts

Add after userId field:

```typescript
tenantId: {
  type: Schema.Types.ObjectId,
  ref: 'Tenant',
  required: true,
  index: true
},
```

Add compound unique index:

```typescript
customerProfileSchema.index({ userId: 1, tenantId: 1 }, { unique: true });
```

---

## FIX 3: Add tenantId to AuditLog

File: backend/src/models/auditLog.model.ts

Add to schema:

```typescript
tenantId: {
  type: Schema.Types.ObjectId,
  ref: 'Tenant',
  index: true
},
targetTenantId: {
  type: Schema.Types.ObjectId,
  ref: 'Tenant',
  index: true
},
isBreakGlassAccess: {
  type: Boolean,
  default: false
},
```

Add indexes:

```typescript
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, tenantId: 1, createdAt: -1 });
auditLogSchema.index({ targetTenantId: 1, createdAt: -1 });
```

---

## FIX 4: Enforce tenantId in Booking Service

File: backend/src/services/booking.service.ts

Update createCustomerBooking method:

```typescript
async createCustomerBooking(
  customerId: string, 
  data: BookingInputDTO,
  tenantId?: string
): Promise<BookingResult> {
  if (!tenantId) {
    throw new ApiError(400, 'Tenant context required');
  }
  
  const bookingData = {
    // ... existing fields
    tenantId: new mongoose.Types.ObjectId(tenantId),
  };
}
```

---

## FIX 5: Add tenant scoping to Admin Routes

File: backend/src/routes/admin.routes.ts

Update stats endpoint:

```typescript
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  
  if (!tenantId) {
    throw new ApiError(400, 'Tenant context required for admin operations');
  }
  
  const queryFilter = { tenantId: new mongoose.Types.ObjectId(tenantId) };
  
  const [totalUsers, activeProviders, todayBookings] = await Promise.all([
    User.countDocuments({ ...queryFilter, role: { $ne: 'admin' } }),
    ProviderProfile.countDocuments({ ...queryFilter, 'verificationStatus.overall': 'approved' }),
    Booking.countDocuments({ ...queryFilter, createdAt: { $gte: today, $lt: tomorrow } }),
  ]);
});
```

---

## FIX 6: Implement Break-Glass Mechanism

File: backend/src/middleware/auth.middleware.ts

Add constants:

```typescript
export const BREAK_GLASS_HEADER = 'X-Break-Glass';
export const BREAK_GLASS_REASON_HEADER = 'X-Break-Glass-Reason';
```

Update requireAdmin middleware to check for break-glass headers and log emergency access.

---

## FIX 7: Add Tenant-Aware Rate Limiting

File: backend/src/middleware/rateLimiter.ts

Add per-tenant rate limiter:

```typescript
export const perTenantRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10000,
  keyGenerator: (req: Request) => {
    const tenantId = (req as any).tenantId;
    return tenantId || req.ip || 'unknown';
  },
  message: { success: false, error: 'Tenant quota exceeded' },
});
```

Update perUserRateLimiter to combine user ID and tenant ID.

---

## FIX 8: Enforce tenantId in Analytics Service

File: backend/src/services/analytics.service.ts

Update getDashboardMetrics to require tenantId parameter and pass it to all aggregation methods.

---

## FIX 9: Update Admin Invite Service

File: backend/src/services/adminInvite.service.ts

Update generateInviteToken to accept tenantId parameter and validate creator has access.

---

## FIX 10: Add Quota Enforcement

File: backend/src/services/quota.service.ts (new file)

Create QuotaService class with checkQuota and enforceQuota methods.

---

## FIX 11: Privacy-Safe Aggregation

File: backend/src/services/analytics.service.ts

Add K_ANONYMITY_THRESHOLD constant and update aggregation methods to exclude cohorts below threshold.

---

## FIX 12: Update Service Discovery

File: backend/src/services/search.service.ts

Add tenantId parameter to searchServices method.

---

## IMPLEMENTATION ORDER

1. ProviderProfile tenantId
2. CustomerProfile tenantId
3. AuditLog tenantId
4. Break-glass mechanism
5. Rate limiting
6. Admin routes tenant scoping
7. Booking service tenantId
8. Analytics tenant scoping
9. Admin invite tenantId
10. Quota service
11. Privacy aggregation
12. Search service

---

## VERIFICATION CHECKLIST

- All models have tenantId
- Admin routes require tenant context
- Analytics queries filter by tenantId
- Rate limits apply per tenant
- Break-glass mechanism logs all cross-tenant access
- Quota enforcement prevents overages
- Privacy-safe aggregation excludes small cohorts
- Search results scoped to tenant

---

**Fixes Generated:** May 22, 2026
