/**
 * Seed curated trending items from static fallback content.
 * Run: npx ts-node src/scripts/seed-curated-trends.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CuratedTrend from '../models/curatedTrend.model';
import { HOME_TRENDING_FALLBACK } from '../constants/homeTrendingFallback';

dotenv.config();

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < HOME_TRENDING_FALLBACK.length; i++) {
    const item = HOME_TRENDING_FALLBACK[i];
    const slug = item.link.replace('/category/', '');

    const exists = await CuratedTrend.findOne({
      title: item.title,
      placement: 'homepage_trending',
      isDeleted: false,
    });

    if (exists) {
      skipped++;
      continue;
    }

    await CuratedTrend.create({
      title: item.title,
      subtitle: item.subtitle,
      imageUrl: item.imageUrl,
      linkType: 'category',
      linkTarget: slug,
      categoryLabel: item.category,
      metricOverride: item.metricValue,
      sortOrder: i,
      isActive: true,
      isPinned: i < 2,
      placement: 'homepage_trending',
    });
    created++;
  }

  console.log(`Curated trends seed complete: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
