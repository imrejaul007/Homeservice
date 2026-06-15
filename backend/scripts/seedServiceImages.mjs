#!/usr/bin/env node
/**
 * seedServiceImages.mjs
 *
 * One-off seed script: assign category-appropriate Unsplash stock photos to
 * any Service document whose `images` array is empty (or missing).
 *
 * Usage:
 *   node scripts/seedServiceImages.mjs            # apply changes
 *   node scripts/seedServiceImages.mjs --dry-run  # preview only
 *
 * Why a script: the search page only shows real images if the database has
 * them. Many existing services were created with `images: []`, so we backfill
 * with stable, hot-linkable Unsplash URLs.
 */

import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

// Load .env from the backend root so MONGODB_URI is available.
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const DRY_RUN = process.argv.includes('--dry-run');

// Curated Unsplash photo IDs. We use the `?w=800&auto=format&fit=crop` query
// string so the API serves a reasonably-sized JPEG without us hot-linking the
// full resolution file. Photos are stable — these IDs do not change.
const CATEGORY_IMAGES = {
  hair: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&auto=format&fit=crop',
  ],
  makeup: [
    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1457972729786-0411a3b2b626?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522335789203-aaa2f6e9b2cf?w=800&auto=format&fit=crop',
  ],
  nails: [
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1601612628452-9e99ced43524?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=800&auto=format&fit=crop',
  ],
  'skin & aesthetics': [
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop',
  ],
  'massage & body': [
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop',
  ],
  'personal care': [
    'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop',
  ],
  default: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522335789203-aaa2f6e9b2cf?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop',
  ],
};

// Deterministic pick: same service._id always yields the same image, so
// re-running the script is idempotent.
function pickImage(category, seed) {
  const key = (category || 'default').toLowerCase();
  const pool = CATEGORY_IMAGES[key] || CATEGORY_IMAGES.default;
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not set. Add it to backend/.env and retry.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  console.log('✅ Connected to MongoDB');

  const db = client.db();
  const services = db.collection('services');

  // Find services with no usable image. $or catches missing field and empty array.
  const cursor = services.find({
    $or: [
      { images: { $exists: false } },
      { images: null },
      { images: { $size: 0 } },
    ],
  });

  const targets = await cursor.toArray();
  console.log(`\n📋 Found ${targets.length} service(s) without images.`);
  if (targets.length === 0) {
    console.log('Nothing to do.');
    await client.close();
    return;
  }

  // Group by category so the log is readable.
  const byCategory = new Map();
  for (const s of targets) {
    const k = (s.category || 'uncategorized').toLowerCase();
    byCategory.set(k, (byCategory.get(k) || 0) + 1);
  }
  console.log('\nBreakdown by category:');
  for (const [cat, count] of byCategory) {
    console.log(`  - ${cat}: ${count}`);
  }

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN — no changes will be written.');
    console.log('First 5 would-be updates:');
    for (const s of targets.slice(0, 5)) {
      console.log(`  - [${s.category || 'default'}] ${s.name} → ${pickImage(s.category, s._id)}`);
    }
    await client.close();
    return;
  }

  let updated = 0;
  let failed = 0;
  for (const s of targets) {
    const url = pickImage(s.category, s._id);
    try {
      await services.updateOne(
        { _id: s._id },
        { $set: { images: [url], updatedAt: new Date() } }
      );
      updated++;
    } catch (err) {
      failed++;
      console.error(`  ❌ Failed to update ${s._id} (${s.name}):`, err.message);
    }
  }

  console.log(`\n✅ Updated ${updated} service(s).`);
  if (failed > 0) console.log(`⚠️  ${failed} service(s) failed.`);
  console.log('\nTip: hard-reload the search page (Ctrl+Shift+R) to bust any cached responses.');

  await client.close();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
