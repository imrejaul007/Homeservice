import { useEffect, useState } from 'react';
import { searchApi } from '@/services/searchApi';

const FALLBACK_TERMS = [
  'Bridal Makeup',
  'Swedish Massage',
  'Gel Nails',
  'Hair Coloring',
  'Deep Tissue Massage',
  'Facial Treatment',
];

export function useTrendingSearchTerms(limit = 8) {
  const [terms, setTerms] = useState<string[]>(FALLBACK_TERMS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();

    searchApi
      .getTrendingServices('7d', limit, abortController.signal)
      .then((res) => {
        if (res.success && res.data.services?.length) {
          setTerms(res.data.services.slice(0, limit).map((s) => s.name));
        }
      })
      .catch(() => {
        // Keep fallback terms
      })
      .finally(() => setIsLoading(false));

    return () => abortController.abort();
  }, [limit]);

  return { terms, isLoading };
}

export default useTrendingSearchTerms;
