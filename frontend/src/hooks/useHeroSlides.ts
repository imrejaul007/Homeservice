import { useQuery } from '@tanstack/react-query';
import { homeTrendingApi, type HeroSlide } from '@/services/homeTrendingApi';

const FALLBACK_SLIDES: HeroSlide[] = [
  {
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop',
    badge: 'Hair & Styling',
    title: 'Transform Your Look',
    subtitle: 'Expert hair styling from verified professionals',
    cta: 'Book Hair Services',
    ctaLink: '/category/hair',
  },
  {
    image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1400&q=80&fit=crop',
    badge: 'Bridal Services',
    title: 'Bridal & Special Days',
    subtitle: 'Look stunning on your special occasions',
    cta: 'View Packages',
    ctaLink: '/category/makeup',
  },
  {
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1400&q=80&fit=crop',
    badge: 'Spa & Wellness',
    title: 'Relax & Rejuvenate',
    subtitle: 'Premium spa treatments in your home',
    cta: 'Book Massage',
    ctaLink: '/category/massage-body',
  },
];

// Cache hero slides for 15 minutes - they rarely change (admin-curated content)
const HERO_SLIDES_STALE_TIME = 15 * 60 * 1000; // 15 minutes
const HERO_SLIDES_GC_TIME = 60 * 60 * 1000; // 1 hour

export function useHeroSlides(limit = 10) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hero-slides', limit],
    queryFn: async ({ signal }) => {
      const response = await homeTrendingApi.getHeroSlides(limit, signal);
      return response;
    },
    staleTime: HERO_SLIDES_STALE_TIME,
    gcTime: HERO_SLIDES_GC_TIME,
    // Don't retry on 4xx client errors
    retry: (failureCount, err) => {
      if (err && typeof err === 'object' && 'response' in err) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status && status >= 400 && status < 500) return false;
      }
      return failureCount < 2;
    },
  });

  // Use fetched data or fallback if empty/error
  const slides: HeroSlide[] = data && data.length > 0 ? data : FALLBACK_SLIDES;

  return { slides, isLoading, error };
}

export default useHeroSlides;
