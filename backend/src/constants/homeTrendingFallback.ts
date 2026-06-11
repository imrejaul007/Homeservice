/**
 * Vetted static fallback items when live feed has fewer than minItems.
 * Used only when curated + experiences + trending services are insufficient.
 */

export interface HomeTrendingFallbackItem {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  category: string;
  link: string;
  metricValue: string;
}

export const HOME_TRENDING_FALLBACK: HomeTrendingFallbackItem[] = [
  {
    id: 'fallback-bridal-glam',
    title: 'Bridal Glam',
    subtitle: 'Flawless bridal look',
    imageUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=640&q=80',
    category: 'Makeup',
    link: '/category/makeup',
    metricValue: 'Popular',
  },
  {
    id: 'fallback-balayage',
    title: 'Balayage',
    subtitle: 'Sun-kissed highlights',
    imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=640&q=80',
    category: 'Hair',
    link: '/category/hair',
    metricValue: 'Popular',
  },
  {
    id: 'fallback-chrome-nails',
    title: 'Chrome Nails',
    subtitle: 'Metallic perfection',
    imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=640&q=80',
    category: 'Nails',
    link: '/category/nails',
    metricValue: 'Popular',
  },
  {
    id: 'fallback-glass-skin',
    title: 'Glass Skin',
    subtitle: 'Korean beauty glow',
    imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=640&q=80',
    category: 'Skincare',
    link: '/category/skin-aesthetics',
    metricValue: 'Popular',
  },
  {
    id: 'fallback-deep-tissue',
    title: 'Deep Tissue',
    subtitle: 'Ultimate relaxation',
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=640&q=80',
    category: 'Massage',
    link: '/category/massage-body',
    metricValue: 'Popular',
  },
  {
    id: 'fallback-brow-art',
    title: 'Brow Art',
    subtitle: 'Fluffy perfect brows',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=640&q=80',
    category: 'Brows',
    link: '/category/personal-care',
    metricValue: 'Popular',
  },
];
