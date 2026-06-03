/**
 * Cleanup script for stale Redis slot locks
 * Run periodically (e.g., every 5 minutes) to clean up orphaned locks from crashed sessions
 *
 * Usage: node scripts/cleanup-stale-locks.js
 */

const Redis = require('ioredis');
const mongoose = require('mongoose');

const REDIS_URL = process.env.REDIS_URL || 'redis://default:jwTUlq5fg7BD4D8KQcpUfmSoMh0Z6s5w@redis-12442.c274.us-east-1-3.ec2.cloud.redislabs.com:12442';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/?appName=Cluster0';

const MAX_LOCK_AGE_MS = 300000; // 5 minutes - locks older than this are stale

async function cleanupStaleLocks() {
  console.log('Starting stale lock cleanup...\n');

  const redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 10000,
    maxRetriesPerRequest: 3
  });

  try {
    await redis.connect();
    console.log('Connected to Redis');

    // Get all slot locks
    const lockKeys = await redis.keys('slot:lock:*');
    console.log(`Found ${lockKeys.length} total slot locks\n`);

    let staleCount = 0;
    let validCount = 0;

    for (const lockKey of lockKeys) {
      try {
        const lockValue = await redis.get(lockKey);

        if (!lockValue) {
          console.log(`  ${lockKey}: Already expired/deleted`);
          continue;
        }

        const parsed = JSON.parse(lockValue);
        const lockAge = Date.now() - parsed.lockedAt;

        if (lockAge > MAX_LOCK_AGE_MS) {
          // This lock is stale - remove it
          await redis.del(lockKey);
          console.log(`  STALE: ${lockKey} (age: ${Math.round(lockAge / 1000)}s) - REMOVED`);
          staleCount++;
        } else {
          console.log(`  VALID: ${lockKey} (age: ${Math.round(lockAge / 1000)}s)`);
          validCount++;
        }
      } catch (err) {
        console.log(`  ERROR: ${lockKey} - ${err.message}`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total locks checked: ${lockKeys.length}`);
    console.log(`Valid locks: ${validCount}`);
    console.log(`Stale locks removed: ${staleCount}`);

    // Also check for orphaned cooldown entries
    const cooldownKeys = await redis.keys('slot:cooldown:*');
    console.log(`\nCooldown entries found: ${cooldownKeys.length}`);

    for (const cooldownKey of cooldownKeys) {
      const ttl = await redis.ttl(cooldownKey);
      if (ttl < 0) {
        // Key has no TTL or expired - delete
        await redis.del(cooldownKey);
        console.log(`  Removed orphan cooldown: ${cooldownKey}`);
      }
    }

    await redis.quit();
    console.log('\nCleanup complete!');
    process.exit(0);

  } catch (err) {
    console.error('Cleanup failed:', err.message);
    if (redis.status === 'ready') {
      await redis.quit();
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  cleanupStaleLocks();
}

module.exports = { cleanupStaleLocks };