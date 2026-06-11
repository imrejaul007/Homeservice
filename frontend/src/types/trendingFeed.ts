export type TrendingFeedItemType = 'curated' | 'experience' | 'service' | 'fallback';

export type TrendingFeedMetricKind = 'bookings' | 'rating' | 'trend' | 'custom';

export interface TrendingFeedMetric {
  value: string;
  kind: TrendingFeedMetricKind;
}

export interface TrendingFeedItem {
  id: string;
  type: TrendingFeedItemType;
  title: string;
  subtitle: string;
  imageUrl: string;
  videoUrl?: string;
  category: string;
  link: string;
  metric: TrendingFeedMetric;
  trendPercentage?: number;
  badge?: string;
}

export interface TrendingFeedMetadata {
  total: number;
  counts: Record<TrendingFeedItemType, number>;
  usedFallback: boolean;
  generatedAt: string;
}

export interface TrendingFeedResponse {
  success: boolean;
  data: {
    items: TrendingFeedItem[];
    metadata: TrendingFeedMetadata;
  };
}

export interface CuratedTrend {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  videoUrl?: string;
  linkType: 'service' | 'experience' | 'category' | 'external' | 'search';
  linkTarget: string;
  categoryLabel: string;
  metricOverride?: string;
  sortOrder: number;
  isActive: boolean;
  isPinned: boolean;
  startsAt?: string;
  endsAt?: string;
  placement: string;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}
