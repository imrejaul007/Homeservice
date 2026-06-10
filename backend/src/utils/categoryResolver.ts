import ServiceCategory from '../models/serviceCategory.model';
import { escapeRegex } from './formatBookingListItem';

export interface ResolvedCategoryFilters {
  categoryName?: string;
  subcategoryName?: string;
  categorySlug?: string;
  subcategorySlug?: string;
}

interface CategoryDoc {
  name: string;
  slug: string;
  subcategories?: Array<{
    name: string;
    slug: string;
    isActive?: boolean;
  }>;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedCategories: CategoryDoc[] | null = null;
let cacheTimestamp = 0;

async function loadCategories(): Promise<CategoryDoc[]> {
  if (cachedCategories && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedCategories;
  }
  cachedCategories = await ServiceCategory.find({ isActive: true }).lean() as CategoryDoc[];
  cacheTimestamp = Date.now();
  return cachedCategories;
}

/** Clear cache (useful after category seeding or migration) */
export function clearCategoryResolverCache(): void {
  cachedCategories = null;
  cacheTimestamp = 0;
}

function findCategory(categories: CategoryDoc[], category?: string): CategoryDoc | undefined {
  if (!category) return undefined;
  const lower = category.toLowerCase();
  return categories.find(
    (c) => c.slug === category || c.name.toLowerCase() === lower
  );
}

function findSubcategory(
  category: CategoryDoc,
  subcategory: string
): { name: string; slug: string } | undefined {
  const lower = subcategory.toLowerCase();
  return (category.subcategories || []).find(
    (s) => s.isActive !== false && (s.slug === subcategory || s.name.toLowerCase() === lower)
  );
}

/**
 * Resolve category/subcategory slugs or names to canonical ServiceCategory names.
 * URL params use slugs; Service documents store display names.
 */
export async function resolveCategoryFilters(
  category?: string,
  subcategory?: string
): Promise<ResolvedCategoryFilters> {
  if (!category && !subcategory) return {};

  const categories = await loadCategories();
  const result: ResolvedCategoryFilters = {};

  let matchedCategory = findCategory(categories, category);

  if (matchedCategory) {
    result.categoryName = matchedCategory.name;
    result.categorySlug = matchedCategory.slug;
  }

  if (subcategory) {
    if (matchedCategory) {
      const matchedSub = findSubcategory(matchedCategory, subcategory);
      if (matchedSub) {
        result.subcategoryName = matchedSub.name;
        result.subcategorySlug = matchedSub.slug;
      }
    } else {
      for (const cat of categories) {
        const matchedSub = findSubcategory(cat, subcategory);
        if (matchedSub) {
          result.categoryName = cat.name;
          result.categorySlug = cat.slug;
          result.subcategoryName = matchedSub.name;
          result.subcategorySlug = matchedSub.slug;
          matchedCategory = cat;
          break;
        }
      }
    }
  }

  // Pass through unresolved values so partial matches still work during migration
  if (category && !result.categoryName) {
    result.categoryName = category;
  }
  if (subcategory && !result.subcategoryName) {
    result.subcategoryName = subcategory;
  }

  return result;
}

/** Build a case-insensitive exact-match MongoDB filter for a string field */
export function buildCaseInsensitiveNameFilter(value: string): { $regex: RegExp } {
  return { $regex: new RegExp(`^${escapeRegex(value)}$`, 'i') };
}
