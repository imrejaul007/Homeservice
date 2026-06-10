import mongoose from 'mongoose';

/**
 * Build tenant-aware filters for customer booking queries.
 * Includes legacy bookings missing tenantId until backfill completes.
 */
export function getTenantObjectId(tenantId?: string): mongoose.Types.ObjectId | null {
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    return null;
  }
  return new mongoose.Types.ObjectId(tenantId);
}

export function applyTenantToBookingQuery(
  query: Record<string, unknown>,
  tenantId?: string,
  options?: { includeLegacyMissingTenant?: boolean }
): void {
  const tenantObjectId = getTenantObjectId(tenantId);
  if (!tenantObjectId) {
    return;
  }

  const includeLegacy = options?.includeLegacyMissingTenant !== false;
  const tenantClause: Record<string, unknown> = includeLegacy
    ? {
        $or: [
          { tenantId: tenantObjectId },
          { tenantId: { $exists: false } },
          { tenantId: null },
        ],
      }
    : { tenantId: tenantObjectId };

  if (query.$and && Array.isArray(query.$and)) {
    (query.$and as Record<string, unknown>[]).push(tenantClause);
    return;
  }

  if (query.$or) {
    query.$and = [{ $or: query.$or }, tenantClause];
    delete query.$or;
    return;
  }

  Object.assign(query, tenantClause);
}

export function buildCustomerBookingAggregationMatch(
  customerId: string,
  tenantId?: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const match: Record<string, unknown> = {
    customerId: new mongoose.Types.ObjectId(customerId),
    deletedAt: { $exists: false },
    ...extra,
  };
  applyTenantToBookingQuery(match, tenantId);
  return match;
}
