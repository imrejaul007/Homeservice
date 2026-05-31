/**
 * Migration: 001_add_tenant_and_soft_delete
 *
 * This migration adds:
 * 1. tenantId field to NotificationQueue collection
 * 2. isDeleted and deletedAt fields to Dispute, Cashback, Voucher, VoucherUsage, and Coupon collections
 *
 * Run with: mongosh < backend/src/migrations/001_add_tenant_and_soft_delete.js
 * Or via mongoose migration system if configured
 */

db = db.getSiblingDB('homeservice');

print('===========================================');
print('Migration: 001_add_tenant_and_soft_delete');
print('Started at: ' + new Date().toISOString());
print('===========================================');

// ============================================
// 1. Add tenantId to NotificationQueue
// ============================================
print('\n[1/6] Adding tenantId to NotificationQueue...');

try {
  db.notifications.updateMany({}, { $set: { tenantId: null } });
  db.notifications.createIndex({ tenantId: 1, status: 1, nextRetry: 1 });
  print('  ✓ NotificationQueue: tenantId added and indexed');
} catch (e) {
  print('  ✗ NotificationQueue: ' + e.message);
}

// ============================================
// 2. Add soft delete to Dispute
// ============================================
print('\n[2/6] Adding soft delete fields to Dispute...');

try {
  db.disputes.updateMany({}, { $set: { isDeleted: false, deletedAt: null } });
  db.disputes.createIndex({ isDeleted: 1, createdAt: -1 });
  db.disputes.createIndex({ isDeleted: 1, status: 1 });
  print('  ✓ Dispute: isDeleted, deletedAt added and indexed');
} catch (e) {
  print('  ✗ Dispute: ' + e.message);
}

// ============================================
// 3. Add soft delete to Cashback
// ============================================
print('\n[3/6] Adding soft delete fields to Cashback...');

try {
  db.cashbacks.updateMany({}, { $set: { isDeleted: false, deletedAt: null } });
  db.cashbacks.createIndex({ isDeleted: 1, createdAt: -1 });
  db.cashbacks.createIndex({ tenantId: 1, isDeleted: 1 });
  print('  ✓ Cashback: isDeleted, deletedAt added and indexed');
} catch (e) {
  print('  ✗ Cashback: ' + e.message);
}

// ============================================
// 4. Add soft delete to Voucher
// ============================================
print('\n[4/6] Adding soft delete fields to Voucher...');

try {
  db.vouchers.updateMany({}, { $set: { isDeleted: false, deletedAt: null } });
  db.vouchers.createIndex({ isDeleted: 1, createdAt: -1 });
  db.vouchers.createIndex({ tenantId: 1, isDeleted: 1 });
  print('  ✓ Voucher: isDeleted, deletedAt added and indexed');
} catch (e) {
  print('  ✗ Voucher: ' + e.message);
}

// ============================================
// 5. Add soft delete to VoucherUsage
// ============================================
print('\n[5/6] Adding soft delete fields to VoucherUsage...');

try {
  db.voucherusages.updateMany({}, { $set: { isDeleted: false, deletedAt: null } });
  db.voucherusages.createIndex({ isDeleted: 1, createdAt: -1 });
  print('  ✓ VoucherUsage: isDeleted, deletedAt added and indexed');
} catch (e) {
  print('  ✗ VoucherUsage: ' + e.message);
}

// ============================================
// 6. Add soft delete to Coupon
// ============================================
print('\n[6/6] Adding soft delete fields to Coupon...');

try {
  db.coupons.updateMany({}, { $set: { isDeleted: false, deletedAt: null } });
  db.coupons.createIndex({ isDeleted: 1, createdAt: -1 });
  db.coupons.createIndex({ tenantId: 1, isDeleted: 1 });
  print('  ✓ Coupon: isDeleted, deletedAt added and indexed');
} catch (e) {
  print('  ✗ Coupon: ' + e.message);
}

print('\n===========================================');
print('Migration completed at: ' + new Date().toISOString());
print('===========================================');
print('\nNote: These fields are backwards compatible:');
print('  - tenantId on NotificationQueue is optional (null for existing records)');
print('  - isDeleted defaults to false (existing records remain accessible)');
print('  - Queries should filter by isDeleted: false to exclude soft-deleted records');
