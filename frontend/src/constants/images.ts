// =============================================================================
// NILIN Beauty Marketplace — Centralized Image Library
// All images sourced from Unsplash with size-appropriate parameters.
// =============================================================================

// -----------------------------------------------------------------------------
// Category Images
// Each category has three sizes: hero (1400w), card (600w), thumbnail (300w)
// -----------------------------------------------------------------------------

export const CATEGORY_IMAGES: Record<
  string,
  { hero: string; card: string; thumbnail: string }
> = {
  hair: {
    hero: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop',
    card: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300&q=80&fit=crop',
  },
  makeup: {
    hero: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1400&q=80&fit=crop',
    card: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=300&q=80&fit=crop',
  },
  nails: {
    hero: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1400&q=80&fit=crop',
    card: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=300&q=80&fit=crop',
  },
  'skin-aesthetics': {
    hero: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1400&q=80&fit=crop',
    card: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=300&q=80&fit=crop',
  },
  'massage-body': {
    hero: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1400&q=80&fit=crop',
    card: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=300&q=80&fit=crop',
  },
  'personal-care': {
    hero: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1400&q=80&fit=crop',
    card: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=600&q=80&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=300&q=80&fit=crop',
  },
};

// -----------------------------------------------------------------------------
// Subcategory Images
// Keyed by category slug, then subcategory slug. Each image is 400w.
// Every URL is a unique Unsplash photo relevant to the specific service.
// -----------------------------------------------------------------------------

export const SUBCATEGORY_IMAGES: Record<string, Record<string, string>> = {
  // ── Hair ──────────────────────────────────────────────────────────────────
  hair: {
    'haircut-styling':
      'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=400&q=80&fit=crop',
    'hair-coloring':
      'https://images.unsplash.com/photo-1617896848219-5ec29577b578?w=400&q=80&fit=crop',
    'hair-treatment':
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&q=80&fit=crop',
    'blowout-blowdry':
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80&fit=crop',
    'bridal-hair':
      'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=400&q=80&fit=crop',
    'hair-extensions':
      'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=400&q=80&fit=crop',
  },

  // ── Makeup ────────────────────────────────────────────────────────────────
  makeup: {
    'bridal-makeup':
      'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&q=80&fit=crop',
    'party-makeup':
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&q=80&fit=crop',
    'everyday-makeup':
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80&fit=crop',
    'special-fx':
      'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=400&q=80&fit=crop',
    'makeup-lesson':
      'https://images.unsplash.com/photo-1457972729786-0411a3b2b626?w=400&q=80&fit=crop',
  },

  // ── Nails ─────────────────────────────────────────────────────────────────
  nails: {
    'classic-manicure':
      'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=400&q=80&fit=crop',
    'gel-nails':
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=80&fit=crop',
    'nail-art':
      'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=400&q=80&fit=crop',
    pedicure:
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=400&q=80&fit=crop',
    'acrylic-nails':
      'https://images.unsplash.com/photo-1583205605777-925aa0cb4c1b?w=400&q=80&fit=crop',
    'nail-extensions':
      'https://images.unsplash.com/photo-1610992015732-2449b0ae48db?w=400&q=80&fit=crop',
  },

  // ── Skin & Aesthetics ────────────────────────────────────────────────────
  'skin-aesthetics': {
    'facial-cleanup':
      'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&q=80&fit=crop',
    'chemical-peel':
      'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&q=80&fit=crop',
    'anti-aging':
      'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400&q=80&fit=crop',
    'acne-treatment':
      'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=400&q=80&fit=crop',
    'skin-brightening':
      'https://images.unsplash.com/photo-1508186225823-0963cf9ab0de?w=400&q=80&fit=crop',
    microdermabrasion:
      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&q=80&fit=crop',
  },

  // ── Massage & Body ───────────────────────────────────────────────────────
  'massage-body': {
    'swedish-massage':
      'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&q=80&fit=crop',
    'deep-tissue':
      'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&q=80&fit=crop',
    'hot-stone':
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80&fit=crop',
    aromatherapy:
      'https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=400&q=80&fit=crop',
    'thai-massage':
      'https://images.unsplash.com/photo-1611073615830-4dbdb2e5e093?w=400&q=80&fit=crop',
    'body-scrub':
      'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&q=80&fit=crop',
  },

  // ── Personal Care ────────────────────────────────────────────────────────
  'personal-care': {
    'threading-waxing':
      'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=400&q=80&fit=crop',
    'bleach-detan':
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80&fit=crop',
    'hair-removal':
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=80&fit=crop',
    'eyebrow-shaping':
      'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&q=80&fit=crop',
    'lash-extensions':
      'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=400&q=80&fit=crop',
  },
};

// -----------------------------------------------------------------------------
// Hero Slides — Full-width carousel on the homepage
// -----------------------------------------------------------------------------

export const HERO_SLIDES = [
  {
    image:
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop',
    title: 'Premium Beauty Services at Your Doorstep',
    subtitle:
      'Expert stylists, makeup artists, and wellness professionals — book in minutes.',
    cta: 'Explore Services',
    ctaLink: '/services',
  },
  {
    image:
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1400&q=80&fit=crop',
    title: 'Bridal Packages for Your Special Day',
    subtitle:
      'Complete bridal hair, makeup, and skincare packages tailored just for you.',
    cta: 'View Bridal Packages',
    ctaLink: '/services?category=makeup&sub=bridal-makeup',
  },
  {
    image:
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1400&q=80&fit=crop',
    title: 'Relax, Rejuvenate, Restore',
    subtitle:
      'Therapeutic massages and body treatments delivered by certified therapists.',
    cta: 'Book a Massage',
    ctaLink: '/services?category=massage-body',
  },
] as const;

// -----------------------------------------------------------------------------
// Promo Banners — Promotional cards / secondary CTAs
// -----------------------------------------------------------------------------

export const PROMO_BANNERS = [
  {
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80&fit=crop',
    title: 'New User Offer',
    subtitle: 'Get 25% off your first booking with code NILIN25',
    gradient: 'from-pink-500/80 to-purple-600/80',
    cta: 'Claim Offer',
  },
  {
    image:
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80&fit=crop',
    title: 'Glow-Up Package',
    subtitle: 'Facial + mani-pedi combo starting at AED 199',
    gradient: 'from-amber-400/80 to-rose-500/80',
    cta: 'Shop Combos',
  },
  {
    image:
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80&fit=crop',
    title: 'Weekend Self-Care',
    subtitle: 'Spa-day bundles with free add-ons every Friday & Saturday',
    gradient: 'from-teal-400/80 to-indigo-500/80',
    cta: 'See Bundles',
  },
] as const;
