/**
 * Migration: 004_wallet_indexes
 *
 * Adds indexes for wallet transaction idempotency and referral lookups.
 *
 * Run with: mongosh < backend/src/migrations/004_wallet_indexes.js
 */

db = db.getSiblingDB('homeservice');

print('===========================================');
print('Migration: 004_wallet_indexes');
print('Started at: ' + new Date().toISOString());
print('===========================================');

// Wallet transaction reference lookup
try {
  db.wallets.createIndex(
    { userId: 1, 'transactions.reference': 1, 'transactions.referenceType': 1 },
    { name: 'wallet_user_tx_reference', background: true }
  );
  print('Created index: wallet_user_tx_reference');
} catch (e) {
  print('Index wallet_user_tx_reference may already exist: ' + e.message);
}

// Referral stats lookup
try {
  db.users.createIndex(
    { 'loyaltySystem.referredBy': 1 },
    { name: 'user_referred_by', background: true }
  );
  print('Created index: user_referred_by');
} catch (e) {
  print('Index user_referred_by may already exist: ' + e.message);
}

// Cashback balance queries
try {
  db.cashbacks.createIndex(
    { userId: 1, status: 1, expiresAt: 1 },
    { name: 'cashback_user_status_expiry', background: true }
  );
  print('Created index: cashback_user_status_expiry');
} catch (e) {
  print('Index cashback_user_status_expiry may already exist: ' + e.message);
}

print('Migration 004_wallet_indexes completed at: ' + new Date().toISOString());
