/**
 * Audit and fix category/subcategory alignment on Service documents.
 *
 * Run:
 *   npx ts-node src/scripts/audit-category-subcategory.ts --audit
 *   npx ts-node src/scripts/audit-category-subcategory.ts --fix --dry-run
 *   npx ts-node src/scripts/audit-category-subcategory.ts --fix
 *   npx ts-node src/scripts/audit-category-subcategory.ts --fix --reindex
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import ServiceCategory from '../models/serviceCategory.model';
import { indexService } from '../services/search.service';

dotenv.config();

interface CategoryDoc {
  name: string;
  slug: string;
  subcategories?: Array<{ name: string; slug: string; isActive?: boolean }>;
}

interface AuditIssue {
  source: 'Service' | 'ProviderProfile';
  id: string;
  name: string;
  category: string;
  subcategory: string | undefined;
  issue: string;
  suggestedCategory?: string;
  suggestedSubcategory?: string;
}

// Legacy subcategory name → canonical subcategory name (within same category context)
const LEGACY_SUBCATEGORY_ALIASES: Record<string, string> = {
  'Haircut & Styling': "Women's Haircut",
  'Hair Coloring': 'Coloring',
  'Hair Treatment': 'Treatments',
  'Facial Treatment': 'Facial',
  'Skin Rejuvenation': 'Anti-Aging',
  'Bridal Makeup': 'Bridal',
  'Special Occasion': 'Party & Event',
  'Relaxation Massage': 'Swedish',
  'Therapeutic Massage': 'Deep Tissue',
  'Brow Services': 'Brow Shaping',
  'Lash Services': 'Lash Extensions',
};

const MENS_HAIR_KEYWORDS = /\b(men|man|barber|fade|beard|executive|kids|boy)\b/i;

function inferSubcategoryFromName(
  serviceName: string,
  categoryName: string
): string | undefined {
  const lower = serviceName.toLowerCase();

  const rules: Array<{ pattern: RegExp; subcategory: string; categories?: string[] }> = [
    // Hair — specific before generic
    { pattern: /\bbridal\b/i, subcategory: 'Bridal Hair', categories: ['Hair'] },
    { pattern: MENS_HAIR_KEYWORDS, subcategory: "Men's Haircut", categories: ['Hair'] },
    { pattern: /\b(women|ladies)\b/i, subcategory: "Women's Haircut", categories: ['Hair'] },
    { pattern: /\b(balayage|color|highlight|dye)\b/i, subcategory: 'Coloring', categories: ['Hair'] },
    { pattern: /\b(keratin|treatment)\b/i, subcategory: 'Treatments', categories: ['Hair'] },
    { pattern: /\b(blowout|blow.?dry)\b/i, subcategory: 'Blowout', categories: ['Hair'] },
    // Makeup
    { pattern: /\bbridal\b/i, subcategory: 'Bridal', categories: ['Makeup'] },
    { pattern: /\b(editorial)\b/i, subcategory: 'Editorial', categories: ['Makeup'] },
    { pattern: /\b(party|event|occasion|glam|evening)\b/i, subcategory: 'Party & Event', categories: ['Makeup'] },
    // Nails — specific before generic
    { pattern: /\bnail art\b/i, subcategory: 'Nail Art', categories: ['Nails'] },
    { pattern: /\bgel\b/i, subcategory: 'Gel', categories: ['Nails'] },
    { pattern: /\b(acrylic|extension)\b/i, subcategory: 'Acrylic', categories: ['Nails'] },
    { pattern: /\b(manicure)\b/i, subcategory: 'Manicure', categories: ['Nails'] },
    { pattern: /\b(pedicure)\b/i, subcategory: 'Pedicure', categories: ['Nails'] },
    // Skin — specific before generic "facial"
    { pattern: /\b(anti.?aging|rejuvenation)\b/i, subcategory: 'Anti-Aging', categories: ['Skin & Aesthetics'] },
    { pattern: /\b(chemical peel|peel)\b/i, subcategory: 'Chemical Peel', categories: ['Skin & Aesthetics'] },
    { pattern: /\bacne\b/i, subcategory: 'Acne', categories: ['Skin & Aesthetics'] },
    { pattern: /hydrafacial|hydra facial|\bfacial\b/i, subcategory: 'Facial', categories: ['Skin & Aesthetics'] },
    { pattern: /\b(hot stone)\b/i, subcategory: 'Hot Stone', categories: ['Massage & Body'] },
    { pattern: /\b(deep tissue|sports|therapeutic)\b/i, subcategory: 'Deep Tissue', categories: ['Massage & Body'] },
    { pattern: /\b(swedish|couples|relaxation)\b/i, subcategory: 'Swedish', categories: ['Massage & Body'] },
    { pattern: /\b(aromatherapy)\b/i, subcategory: 'Aromatherapy', categories: ['Massage & Body'] },
    { pattern: /\b(body scrub)\b/i, subcategory: 'Body Scrub', categories: ['Massage & Body'] },
    { pattern: /\b(brow)\b/i, subcategory: 'Brow Shaping', categories: ['Personal Care'] },
    { pattern: /\b(lash)\b/i, subcategory: 'Lash Extensions', categories: ['Personal Care'] },
    { pattern: /\b(threading)\b/i, subcategory: 'Threading', categories: ['Personal Care'] },
    { pattern: /\b(wax)\b/i, subcategory: 'Waxing', categories: ['Personal Care'] },
    { pattern: /\b(henna)\b/i, subcategory: 'Henna', categories: ['Personal Care'] },
  ];

  for (const rule of rules) {
    if (rule.categories && !rule.categories.includes(categoryName)) continue;
    if (rule.pattern.test(lower)) return rule.subcategory;
  }

  return undefined;
}

function buildCategoryLookup(categories: CategoryDoc[]) {
  const byName = new Map<string, CategoryDoc>();
  const bySlug = new Map<string, CategoryDoc>();
  const subByName = new Map<string, { category: CategoryDoc; subcategory: { name: string; slug: string } }>();
  const subBySlug = new Map<string, { category: CategoryDoc; subcategory: { name: string; slug: string } }>();

  for (const cat of categories) {
    byName.set(cat.name.toLowerCase(), cat);
    bySlug.set(cat.slug, cat);
    for (const sub of cat.subcategories || []) {
      if (sub.isActive === false) continue;
      subByName.set(sub.name.toLowerCase(), { category: cat, subcategory: sub });
      subBySlug.set(sub.slug, { category: cat, subcategory: sub });
    }
  }

  return { byName, bySlug, subByName, subBySlug };
}

function resolveCanonical(
  category: string,
  subcategory: string | undefined,
  serviceName: string,
  lookup: ReturnType<typeof buildCategoryLookup>
): { category?: string; subcategory?: string; issue?: string } {
  const catLower = category?.toLowerCase() || '';
  let matchedCat = lookup.byName.get(catLower) || lookup.bySlug.get(category);

  if (!matchedCat) {
    return { issue: `Invalid category "${category}"` };
  }

  const canonicalCategory = matchedCat.name;

  if (!subcategory || subcategory === 'undefined') {
    const inferred = inferSubcategoryFromName(serviceName, canonicalCategory);
    if (inferred) {
      return { category: canonicalCategory, subcategory: inferred, issue: 'Missing subcategory (inferred from name)' };
    }
    return { category: canonicalCategory, issue: 'Missing subcategory' };
  }

  // subcategory equals category (recommendedPros bug)
  if (subcategory === category || subcategory === canonicalCategory) {
    const inferred = inferSubcategoryFromName(serviceName, canonicalCategory);
    if (inferred) {
      return { category: canonicalCategory, subcategory: inferred, issue: 'Subcategory equals category (inferred from name)' };
    }
    return { category: canonicalCategory, issue: 'Subcategory equals category' };
  }

  // Exact match
  const exactSub = lookup.subByName.get(subcategory.toLowerCase());
  if (exactSub && exactSub.category.name === canonicalCategory) {
    return { category: canonicalCategory, subcategory: exactSub.subcategory.name };
  }

  // Slug match
  const slugSub = lookup.subBySlug.get(subcategory);
  if (slugSub && slugSub.category.name === canonicalCategory) {
    return { category: canonicalCategory, subcategory: slugSub.subcategory.name, issue: 'Subcategory stored as slug' };
  }

  // Legacy alias
  const aliasTarget = LEGACY_SUBCATEGORY_ALIASES[subcategory];
  if (aliasTarget) {
    let resolved = aliasTarget;
    if (aliasTarget === "Women's Haircut" && MENS_HAIR_KEYWORDS.test(serviceName)) {
      resolved = "Men's Haircut";
    }
    const aliasSub = lookup.subByName.get(resolved.toLowerCase());
    if (aliasSub && aliasSub.category.name === canonicalCategory) {
      return {
        category: canonicalCategory,
        subcategory: aliasSub.subcategory.name,
        issue: `Legacy subcategory "${subcategory}" → "${aliasSub.subcategory.name}"`,
      };
    }
  }

  // Infer from service name as last resort
  const inferred = inferSubcategoryFromName(serviceName, canonicalCategory);
  if (inferred) {
    return {
      category: canonicalCategory,
      subcategory: inferred,
      issue: `Invalid subcategory "${subcategory}" (inferred from name)`,
    };
  }

  return {
    category: canonicalCategory,
    issue: `Invalid subcategory "${subcategory}" for category "${canonicalCategory}"`,
  };
}

async function auditServices(lookup: ReturnType<typeof buildCategoryLookup>): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const services = await Service.find({}).select('name category subcategory').lean();

  for (const svc of services) {
    const current = svc as { _id: mongoose.Types.ObjectId; name: string; category: string; subcategory?: string };
    const resolved = resolveCanonical(current.category, current.subcategory, current.name, lookup);

    const needsFix =
      resolved.issue !== undefined ||
      resolved.category !== current.category ||
      (resolved.subcategory && resolved.subcategory !== current.subcategory);

    if (needsFix) {
      issues.push({
        source: 'Service',
        id: current._id.toString(),
        name: current.name,
        category: current.category,
        subcategory: current.subcategory,
        issue: resolved.issue || 'Category/subcategory mismatch',
        suggestedCategory: resolved.category,
        suggestedSubcategory: resolved.subcategory,
      });
    }
  }

  return issues;
}

async function auditProviderProfiles(lookup: ReturnType<typeof buildCategoryLookup>): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [];
  const profiles = await ProviderProfile.find({}).select('services').lean();

  for (const profile of profiles) {
    const services = (profile as any).services || [];
    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      if (!svc?.name) continue;

      const resolved = resolveCanonical(svc.category, svc.subcategory, svc.name, lookup);
      const needsFix =
        resolved.issue !== undefined ||
        resolved.category !== svc.category ||
        (resolved.subcategory && resolved.subcategory !== svc.subcategory);

      if (needsFix) {
        issues.push({
          source: 'ProviderProfile',
          id: `${(profile as any)._id}:services.${i}`,
          name: svc.name,
          category: svc.category,
          subcategory: svc.subcategory,
          issue: resolved.issue || 'Category/subcategory mismatch',
          suggestedCategory: resolved.category,
          suggestedSubcategory: resolved.subcategory,
        });
      }
    }
  }

  return issues;
}

async function applyFixes(issues: AuditIssue[], dryRun: boolean): Promise<number> {
  let fixed = 0;

  for (const issue of issues) {
    if (!issue.suggestedCategory) {
      console.log(`  [SKIP] ${issue.source} "${issue.name}" (${issue.id}): ${issue.issue} — no auto-fix`);
      continue;
    }

    const update: Record<string, string> = { category: issue.suggestedCategory };
    if (issue.suggestedSubcategory) {
      update.subcategory = issue.suggestedSubcategory;
    }

    console.log(
      `  [FIX] ${issue.source} "${issue.name}": ` +
      `category="${issue.category}" subcategory="${issue.subcategory ?? ''}" → ` +
      `category="${update.category}" subcategory="${update.subcategory ?? ''}"` +
      (dryRun ? ' (dry-run)' : '')
    );

    if (!dryRun) {
      if (issue.source === 'Service') {
        await Service.updateOne({ _id: issue.id }, { $set: update });
      } else if (issue.source === 'ProviderProfile') {
        const [profileId, servicePath] = issue.id.split(':');
        const index = parseInt(servicePath.replace('services.', ''), 10);
        const setFields: Record<string, string> = {
          [`services.${index}.category`]: update.category,
        };
        if (update.subcategory) {
          setFields[`services.${index}.subcategory`] = update.subcategory;
        }
        await ProviderProfile.updateOne({ _id: profileId }, { $set: setFields });
      }
    }
    fixed++;
  }

  return fixed;
}

async function reindexFixedServices(): Promise<void> {
  const services = await Service.find({ isActive: true }).lean();
  console.log(`\nReindexing ${services.length} services in MeiliSearch...`);
  let count = 0;
  for (const svc of services) {
    try {
      await indexService(svc);
      count++;
    } catch (err) {
      console.warn(`  Failed to index service ${svc._id}:`, err);
    }
  }
  console.log(`Reindexed ${count} services.`);
}

async function main() {
  const args = process.argv.slice(2);
  const isFix = args.includes('--fix');
  const isDryRun = args.includes('--dry-run');
  const isReindex = args.includes('--reindex');
  const isAudit = !isFix || args.includes('--audit');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('No MONGODB_URI or MONGO_URI found in environment');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB\n');

  const categories = await ServiceCategory.find({ isActive: true }).lean() as CategoryDoc[];
  console.log(`Loaded ${categories.length} categories from ServiceCategory\n`);

  const lookup = buildCategoryLookup(categories);

  const serviceIssues = await auditServices(lookup);
  const profileIssues = await auditProviderProfiles(lookup);
  const allIssues = [...serviceIssues, ...profileIssues];

  console.log('=== AUDIT SUMMARY ===');
  console.log(`Service documents with issues: ${serviceIssues.length}`);
  console.log(`ProviderProfile embedded services with issues: ${profileIssues.length}`);
  console.log(`Total issues: ${allIssues.length}\n`);

  if (allIssues.length > 0) {
    console.log('=== ISSUES ===');
    for (const issue of allIssues) {
      console.log(
        `[${issue.source}] ${issue.name} (${issue.id})\n` +
        `  Current:  category="${issue.category}" subcategory="${issue.subcategory ?? ''}"\n` +
        `  Issue:    ${issue.issue}\n` +
        (issue.suggestedCategory
          ? `  Suggest:  category="${issue.suggestedCategory}" subcategory="${issue.suggestedSubcategory ?? ''}"\n`
          : '')
      );
    }
  } else {
    console.log('All services have valid category/subcategory assignments.');
  }

  if (isAudit && !isFix) {
    console.log('\nRun with --fix to apply corrections, or --fix --dry-run to preview.');
  }

  if (isFix) {
    console.log(`\n=== ${isDryRun ? 'DRY RUN' : 'APPLYING'} FIXES ===`);
    const fixed = await applyFixes(allIssues, isDryRun);
    console.log(`\n${isDryRun ? 'Would fix' : 'Fixed'} ${fixed} records.`);

    if (!isDryRun && isReindex) {
      await reindexFixedServices();
    } else if (!isDryRun) {
      console.log('\nTip: run with --reindex to refresh MeiliSearch after fixing.');
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
