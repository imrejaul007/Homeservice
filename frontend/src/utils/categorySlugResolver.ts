/**
 * Resolves legacy/marketing category & subcategory slugs to canonical
 * ServiceCategory slugs used in the API and database.
 */

/** Legacy category slugs → canonical category slug */
const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  beauty: 'personal-care',
  skincare: 'skin-aesthetics',
  eyebrow: 'personal-care',
  brows: 'personal-care',
  spa: 'massage-body',
};

/** Legacy subcategory slugs → canonical subcategory slug (per category) */
const SUBCATEGORY_SLUG_ALIASES: Record<string, Record<string, string>> = {
  hair: {
    'haircut-styling': 'womens-haircut',
    'hair-coloring': 'coloring',
    'hair-treatment': 'treatments',
    'blowout-blowdry': 'blowout',
    'hair-extensions': 'treatments',
  },
  makeup: {
    'party-makeup': 'party-event-makeup',
    'makeup-lesson': 'makeup-lessons',
    'special-fx': 'editorial-makeup',
  },
  nails: {
    'classic-manicure': 'manicure',
    'nail-extensions': 'gel-nails',
  },
  'skin-aesthetics': {
    'facial-cleanup': 'facial',
    'skin-brightening': 'anti-aging',
    microdermabrasion: 'facial',
  },
  'personal-care': {
    'threading-waxing': 'threading',
    'eyebrow-shaping': 'brow-shaping',
    'lash-extensions': 'lash-extensions',
    'bleach-detan': 'waxing',
    'hair-removal': 'waxing',
  },
};

/**
 * Canonical API subcategory slug → serviceContent.ts / images.ts content key
 */
const CONTENT_KEY_ALIASES: Record<string, Record<string, string>> = {
  hair: {
    'womens-haircut': 'haircut-styling',
    'mens-haircut': 'haircut-styling',
    coloring: 'hair-coloring',
    treatments: 'hair-treatment',
    blowout: 'blowout-blowdry',
    'bridal-hair': 'bridal-hair',
  },
  makeup: {
    bridal: 'bridal-makeup',
    'bridal-makeup': 'bridal-makeup',
    'party-event-makeup': 'party-makeup',
    'everyday-makeup': 'everyday-makeup',
    'makeup-lessons': 'makeup-lesson',
    'editorial-makeup': 'special-fx',
  },
  nails: {
    manicure: 'classic-manicure',
    pedicure: 'pedicure',
    'gel-nails': 'gel-nails',
    'acrylic-nails': 'acrylic-nails',
    'nail-art': 'nail-art',
  },
  'skin-aesthetics': {
    facial: 'facial-cleanup',
    'chemical-peel': 'chemical-peel',
    'anti-aging': 'anti-aging',
    acne: 'acne-treatment',
    'acne-treatment': 'acne-treatment',
    'skin-consultation': 'facial-cleanup',
  },
  'massage-body': {
    'swedish-massage': 'swedish-massage',
    'deep-tissue': 'deep-tissue',
    'hot-stone': 'hot-stone',
    aromatherapy: 'aromatherapy',
    'body-scrub': 'body-scrub',
  },
  'personal-care': {
    threading: 'threading-waxing',
    waxing: 'threading-waxing',
    'lash-extensions': 'lash-extensions',
    'brow-shaping': 'eyebrow-shaping',
    henna: 'threading-waxing',
  },
};

/** Canonical subcategory slug → SUBCATEGORY_IMAGES key */
const IMAGE_KEY_ALIASES: Record<string, Record<string, string>> = {
  ...CONTENT_KEY_ALIASES,
  hair: {
    ...CONTENT_KEY_ALIASES.hair,
    'mens-haircut': 'haircut-styling',
  },
};

export function resolveCategorySlug(slug?: string): string | undefined {
  if (!slug) return undefined;
  return CATEGORY_SLUG_ALIASES[slug] ?? slug;
}

export function resolveSubcategorySlug(categorySlug: string, subcategorySlug: string): string {
  const canonicalCategory = resolveCategorySlug(categorySlug) ?? categorySlug;
  const aliases = SUBCATEGORY_SLUG_ALIASES[canonicalCategory];
  if (aliases?.[subcategorySlug]) {
    return aliases[subcategorySlug];
  }
  return subcategorySlug;
}

export function getServiceContentKey(categorySlug: string, subcategorySlug: string): string {
  const canonicalCategory = resolveCategorySlug(categorySlug) ?? categorySlug;
  const canonicalSub = resolveSubcategorySlug(canonicalCategory, subcategorySlug);
  return CONTENT_KEY_ALIASES[canonicalCategory]?.[canonicalSub] ?? canonicalSub;
}

export function getSubcategoryImageKey(categorySlug: string, subcategorySlug: string): string {
  const canonicalCategory = resolveCategorySlug(categorySlug) ?? categorySlug;
  const canonicalSub = resolveSubcategorySlug(canonicalCategory, subcategorySlug);
  return IMAGE_KEY_ALIASES[canonicalCategory]?.[canonicalSub] ?? canonicalSub;
}

/** Build search/subcategory page URL with canonical slugs */
export function buildSubcategoryPath(categorySlug: string, subcategorySlug: string): string {
  const cat = resolveCategorySlug(categorySlug) ?? categorySlug;
  const sub = resolveSubcategorySlug(cat, subcategorySlug);
  return `/service/${cat}/${sub}`;
}

export function buildCategoryPath(categorySlug: string): string {
  const cat = resolveCategorySlug(categorySlug) ?? categorySlug;
  return `/category/${cat}`;
}
