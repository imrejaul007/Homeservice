export interface HeroSlideData {
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  ctaLink: string;
  sortOrder: number;
}

/** Default hero slides when none are configured in the database */
export const DEFAULT_HERO_SLIDES: HeroSlideData[] = [
  {
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop',
    badge: 'Hair & Styling',
    title: 'Transform Your Look',
    subtitle: 'Expert hair styling from verified professionals',
    cta: 'Book Hair Services',
    ctaLink: '/category/hair',
    sortOrder: 0,
  },
  {
    image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1400&q=80&fit=crop',
    badge: 'Bridal Services',
    title: 'Bridal & Special Days',
    subtitle: 'Look stunning on your special occasions',
    cta: 'View Packages',
    ctaLink: '/category/makeup',
    sortOrder: 1,
  },
  {
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1400&q=80&fit=crop',
    badge: 'Spa & Wellness',
    title: 'Relax & Rejuvenate',
    subtitle: 'Premium spa treatments in your home',
    cta: 'Book Massage',
    ctaLink: '/category/massage-body',
    sortOrder: 2,
  },
];
