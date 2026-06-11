import Experience from '../models/experience.model';
import CuratedTrend, { ICuratedTrend, CuratedTrendLinkType } from '../models/curatedTrend.model';
import { trendingService, TrendingServiceItem } from './trending.service';
import { HOME_TRENDING_FALLBACK } from '../constants/homeTrendingFallback';
import { getOrSet, CACHE_KEYS } from './cache.service';
import logger from '../utils/logger';

export type TrendingFeedItemType = 'curated' | 'experience' | 'service' | 'fallback';

export interface TrendingFeedMetric {
  value: string;
  kind: 'bookings' | 'rating' | 'trend' | 'custom';
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

export interface TrendingFeedOptions {
  limit?: number;
  minItems?: number;
  city?: string;
  lat?: number;
  lng?: number;
  period?: '7d' | '30d';
  types?: TrendingFeedItemType[];
}

export interface TrendingFeedResult {
  items: TrendingFeedItem[];
  metadata: {
    total: number;
    counts: Record<TrendingFeedItemType, number>;
    usedFallback: boolean;
    generatedAt: string;
  };
}

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

function resolveCuratedLink(linkType: CuratedTrendLinkType, linkTarget: string): string {
  switch (linkType) {
    case 'service':
      return `/services/${linkTarget}`;
    case 'experience':
      return `/experiences`;
    case 'category':
      return `/category/${linkTarget}`;
    case 'external':
      return linkTarget;
    case 'search':
      return `/search?q=${encodeURIComponent(linkTarget)}`;
    default:
      return '/search';
  }
}

function mapCuratedItem(item: ICuratedTrend): TrendingFeedItem {
  return {
    id: `curated-${item._id.toString()}`,
    type: 'curated',
    title: item.title,
    subtitle: item.subtitle,
    imageUrl: item.imageUrl,
    videoUrl: item.videoUrl,
    category: item.categoryLabel,
    link: resolveCuratedLink(item.linkType, item.linkTarget),
    metric: {
      value: item.metricOverride || (item.clickCount > 0 ? `${formatCount(item.clickCount)} views` : 'Featured'),
      kind: 'custom',
    },
    badge: 'Featured',
  };
}

function mapExperienceItem(exp: any): TrendingFeedItem {
  const category =
    typeof exp.serviceId?.category === 'string'
      ? exp.serviceId.category
      : exp.serviceId?.category?.name || 'Beauty';

  return {
    id: `experience-${exp._id.toString()}`,
    type: 'experience',
    title: exp.title,
    subtitle: exp.description?.slice(0, 80) || 'Real transformation',
    imageUrl: exp.images?.[0] || '',
    videoUrl: exp.videoUrl,
    category,
    link: '/experiences',
    metric: {
      value: `★ ${Number(exp.rating || 0).toFixed(1)}`,
      kind: 'rating',
    },
    badge: 'Real Result',
  };
}

function mapServiceItem(service: TrendingServiceItem): TrendingFeedItem {
  const trendLabel =
    service.trendPercentage > 0
      ? `↑ ${Math.round(service.trendPercentage)}%`
      : service.trendPercentage < 0
        ? `↓ ${Math.abs(Math.round(service.trendPercentage))}%`
        : undefined;

  return {
    id: `service-${service.serviceId}`,
    type: 'service',
    title: service.serviceName,
    subtitle: service.providerName || 'Top provider',
    imageUrl: service.imageUrl || '',
    category: service.categoryName || 'Service',
    link: `/services/${service.serviceId}`,
    metric: {
      value: `${formatCount(service.bookingCount)} bookings`,
      kind: 'bookings',
    },
    trendPercentage: service.trendPercentage,
    badge: trendLabel,
  };
}

function mapFallbackItem(item: (typeof HOME_TRENDING_FALLBACK)[number]): TrendingFeedItem {
  return {
    id: item.id,
    type: 'fallback',
    title: item.title,
    subtitle: item.subtitle,
    imageUrl: item.imageUrl,
    category: item.category,
    link: item.link,
    metric: {
      value: item.metricValue,
      kind: 'custom',
    },
    badge: item.category,
  };
}

function dedupeKey(item: TrendingFeedItem): string {
  if (item.type === 'service') return `service:${item.link}`;
  if (item.type === 'experience') return `experience:${item.id}`;
  if (item.type === 'curated') return `curated:${item.id}`;
  return `fallback:${item.id}`;
}

function isTypeAllowed(type: TrendingFeedItemType, allowed?: TrendingFeedItemType[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(type);
}

export class HomeTrendingFeedService {
  async getFeed(options: TrendingFeedOptions = {}): Promise<TrendingFeedResult> {
    const limit = Math.min(Math.max(options.limit ?? 8, 1), 24);
    const minItems = Math.min(options.minItems ?? 4, limit);
    const window = options.period === '30d' ? '30d' : '7d';
    const types = options.types;

    const cacheKey = `home:trending-feed:${limit}:${minItems}:${window}:${options.city || 'all'}:${options.lat || ''}:${options.lng || ''}:${(types || []).join(',')}`;

    return getOrSet(
      cacheKey,
      async () => this.buildFeed({ ...options, limit, minItems, period: window }),
      { prefix: CACHE_KEYS.SERVICE, ttl: 300 }
    );
  }

  private async buildFeed(options: Required<Pick<TrendingFeedOptions, 'limit' | 'minItems'>> & TrendingFeedOptions): Promise<TrendingFeedResult> {
    const { limit, minItems } = options;
    const window = options.period === '30d' ? '30d' : '7d';
    const items: TrendingFeedItem[] = [];
    const seen = new Set<string>();
    const counts: Record<TrendingFeedItemType, number> = {
      curated: 0,
      experience: 0,
      service: 0,
      fallback: 0,
    };

    const addItem = (item: TrendingFeedItem) => {
      if (!isTypeAllowed(item.type, options.types)) return;
      const key = dedupeKey(item);
      if (seen.has(key)) return;
      if (items.length >= limit) return;
      seen.add(key);
      items.push(item);
      counts[item.type] += 1;
    };

    try {
      if (isTypeAllowed('curated', options.types)) {
        const curated = await CuratedTrend.findActiveForPlacement('homepage_trending', limit);
        curated.forEach((c) => addItem(mapCuratedItem(c)));
      }
    } catch (err) {
      logger.warn('homeTrendingFeed: curated fetch failed', { err });
    }

    const experienceCap = Math.min(3, limit - items.length);
    if (experienceCap > 0 && isTypeAllowed('experience', options.types)) {
      try {
        let experiences = await Experience.findFeatured(experienceCap);
        if (experiences.length < experienceCap) {
          const featuredIds = experiences.map((e: any) => e._id);
          const additional = await Experience.find({
            status: 'approved',
            isDeleted: false,
            _id: { $nin: featuredIds },
          })
            .populate('serviceId', 'name category')
            .sort({ rating: -1, createdAt: -1 })
            .limit(experienceCap - experiences.length)
            .lean();
          experiences = [...experiences, ...additional];
        }
        experiences.forEach((exp: any) => addItem(mapExperienceItem(exp)));
      } catch (err) {
        logger.warn('homeTrendingFeed: experiences fetch failed', { err });
      }
    }

    const serviceCap = limit - items.length;
    if (serviceCap > 0 && isTypeAllowed('service', options.types)) {
      try {
        let trendingServices: TrendingServiceItem[] = [];

        if (options.lat != null && options.lng != null) {
          const locationTrending = await trendingService.getTrendingByLocation(
            { lat: options.lat, lng: options.lng },
            15,
            window,
            { limit: serviceCap + 5 }
          );
          trendingServices = locationTrending.topServices || [];
        } else {
          trendingServices = await trendingService.getTrendingServices(window, {
            limit: serviceCap + 5,
          });
        }

        trendingServices.forEach((s) => addItem(mapServiceItem(s)));
      } catch (err) {
        logger.warn('homeTrendingFeed: trending services fetch failed', { err });
      }
    }

    let usedFallback = false;
    if (items.length < minItems) {
      usedFallback = true;
      for (const fallback of HOME_TRENDING_FALLBACK) {
        if (items.length >= limit) break;
        addItem(mapFallbackItem(fallback));
      }
    }

    return {
      items,
      metadata: {
        total: items.length,
        counts,
        usedFallback,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async trackClick(itemId: string): Promise<void> {
    if (!itemId.startsWith('curated-')) return;
    const id = itemId.replace('curated-', '');
    await CuratedTrend.findByIdAndUpdate(id, { $inc: { clickCount: 1 } });
  }
}

export const homeTrendingFeedService = new HomeTrendingFeedService();
