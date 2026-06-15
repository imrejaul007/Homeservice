import mongoose from 'mongoose';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import ServiceCategory from '../models/serviceCategory.model';
import { getMeiliClient, resetMeiliClient, INDEXES, isMeiliSearchConfigured } from '../config/meilisearch';
import { cache } from '../config/redis';
import logger from '../utils/logger';
import { buildCaseInsensitiveNameFilter } from '../utils/categoryResolver';

/**
 * Search result cache TTL in seconds (5 minutes)
 */
const SEARCH_CACHE_TTL = 5 * 60;

/**
 * Popular searches cache TTL in seconds (24 hours)
 */
const POPULAR_SEARCHES_TTL = 24 * 60 * 60;

/**
 * Suggestions cache TTL in seconds (15 minutes)
 */
const SUGGESTIONS_CACHE_TTL = 15 * 60;

/**
 * Build a simple cache key for search results using string concatenation
 * @param query - Search query string
 * @param options - Search options
 * @param tenantId - Optional tenant ID for multi-tenant isolation
 * @returns Cache key string
 */
const buildSearchCacheKey = (query: string, options: SearchOptions, tenantId?: string): string => {
  const parts = ['search', query || ''];
  // SECURITY FIX: Include tenantId in cache key for multi-tenant isolation
  if (tenantId) parts.push(`tenant:${tenantId}`);
  if (options.category) parts.push(`cat:${options.category}`);
  if (options.subcategory) parts.push(`sub:${options.subcategory}`);
  if (options.minPrice !== undefined) parts.push(`minP:${options.minPrice}`);
  if (options.maxPrice !== undefined) parts.push(`maxP:${options.maxPrice}`);
  if (options.minRating !== undefined) parts.push(`minR:${options.minRating}`);
  if (options.sortBy) parts.push(`sort:${options.sortBy}`);
  if (options.providerId) parts.push(`prov:${options.providerId}`);
  if (options.tags && options.tags.length > 0) parts.push(`tags:${options.tags.join(',')}`);
  if (options.limit) parts.push(`limit:${options.limit}`);
  if (options.offset) parts.push(`offset:${options.offset}`);
  return parts.join('|');
};

/**
 * Escape special regex characters to prevent ReDoS attacks
 * @param str - The input string to escape
 * @returns The escaped string safe for use in regex
 */
const escapeRegex = (str: string): string => {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/** Safe error metadata for logging (avoids circular Axios/socket refs) */
const toSearchErrorMeta = (error: unknown): { message: string; code?: string; status?: number } => {
  const err = error as { message?: string; code?: string; response?: { status?: number } };
  return {
    message: err?.message ?? String(error),
    code: err?.code,
    status: err?.response?.status,
  };
};

const logSearchError = (context: string, error: unknown): void => {
  logger.error(context, toSearchErrorMeta(error));
};

// ============================================
// LEVENSHTEIN DISTANCE & TYPO TOLERANCE
// ============================================

/**
 * Calculate Levenshtein distance between two strings
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance between the two strings
 */
export const levenshteinDistance = (a: string, b: string): number => {
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Get the similarity ratio between two strings (0-1)
 * @param a - First string
 * @param b - Second string
 * @returns Similarity ratio (0 = completely different, 1 = identical)
 */
export const getSimilarityRatio = (a: string, b: string): number => {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
};

/**
 * Find suggestions for a misspelled query based on known terms
 * @param query - The misspelled query
 * @param knownTerms - Array of known terms to match against
 * @param maxDistance - Maximum Levenshtein distance to consider (default: 2)
 * @param minSimilarity - Minimum similarity ratio (default: 0.6)
 * @returns Array of suggested corrections sorted by similarity
 */
export const findSuggestions = (
  query: string,
  knownTerms: string[],
  maxDistance: number = 2,
  minSimilarity: number = 0.6
): Array<{ term: string; distance: number; similarity: number }> => {
  if (!query || knownTerms.length === 0) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const suggestions: Array<{ term: string; distance: number; similarity: number }> = [];

  for (const term of knownTerms) {
    const normalizedTerm = term.toLowerCase();

    // Skip exact matches
    if (normalizedTerm === normalizedQuery) continue;

    const distance = levenshteinDistance(normalizedQuery, normalizedTerm);
    const similarity = getSimilarityRatio(normalizedQuery, normalizedTerm);

    // Include if within max distance or meets similarity threshold
    if (distance <= maxDistance || similarity >= minSimilarity) {
      suggestions.push({ term, distance, similarity });
    }
  }

  // Sort by similarity (descending), then by distance (ascending)
  return suggestions
    .sort((a, b) => b.similarity - a.similarity || a.distance - b.distance)
    .slice(0, 5);
};

// ============================================
// SYNONYM HANDLING
// ============================================

/**
 * Synonym dictionary for common search terms
 * Key: canonical form, Value: array of synonyms
 */
export const SYNONYM_DICTIONARY: Record<string, string[]> = {
  // General terms
  'cleaning': ['housekeeping', 'maid', 'house cleaner', 'domestic cleaning', 'home cleaning'],
  'plumbing': ['plumber', 'pipe', 'drain', 'water', 'leak', 'bathroom'],
  'electrical': ['electrician', 'wiring', 'power', 'lights', 'switch', 'outlet'],
  'painting': ['paint', 'wall painting', 'interior painting', 'exterior painting', 'paint job'],
  'carpentry': ['carpenter', 'wood', 'furniture', 'woodwork', 'cabinet'],
  'gardening': ['landscaping', 'lawn', 'yard', 'plants', 'garden maintenance', 'grass'],
  'pest control': ['pest', 'bugs', 'insects', 'rodents', 'termites', 'exterminator'],
  'moving': ['relocation', 'movers', 'packers', 'shift', 'transport'],
  'repair': ['fix', 'maintenance', 'restore', 'handyman'],
  'installation': ['install', 'setup', 'mount', 'assemble'],

  // Home services
  'ac': ['air conditioning', 'air conditioner', 'cooling', 'hvac', 'split ac', 'duct'],
  'appliance': ['fridge', 'refrigerator', 'washer', 'dryer', 'dishwasher', 'oven'],
  'car wash': ['car cleaning', 'vehicle wash', 'auto detailing', 'auto wash'],
  'salon': ['beauty', 'hair', 'spa', 'nails', 'makeup', 'styling'],
  'massage': ['massage therapy', 'spa treatment', 'relaxation', 'therapeutic massage'],

  // Common misspellings/variations
  'air conditioning': ['ac', 'air conditiong', 'air conditioning service'],
  'house cleaning': ['house keeping', 'house cleanin', 'home cleaning service'],
  'plumbing service': ['plumbin', 'plumbng', 'plummer'],
  'electrician': ['electrican', 'electritian', 'electrical service'],
  'carpenter': ['carpentar', 'carpender', 'wood worker'],

  // Time-based
  'hourly': ['per hour', 'hour', 'regular'],
  'emergency': ['urgent', 'immediate', '24/7', 'same day'],
  'regular': ['routine', 'scheduled', 'periodic', 'maintenance'],

  // Quality descriptors
  'professional': ['pro', 'expert', 'skilled', 'certified', 'qualified'],
  'affordable': ['cheap', 'budget', 'reasonable', 'economical', 'low cost'],
  'quality': ['best', 'top', 'premium', 'high quality', 'excellent'],
};

/**
 * Reverse synonym map for quick lookup (synonym -> canonical)
 */
const REVERSE_SYNONYM_MAP: Map<string, string> = new Map();

/**
 * Initialize the reverse synonym map
 */
const initializeSynonymMap = (): void => {
  if (REVERSE_SYNONYM_MAP.size > 0) return;

  for (const [canonical, synonyms] of Object.entries(SYNONYM_DICTIONARY)) {
    // Map each synonym to its canonical form
    for (const synonym of synonyms) {
      REVERSE_SYNONYM_MAP.set(synonym.toLowerCase(), canonical);
    }
  }
};

/**
 * Expand query by adding synonyms
 * @param query - Original search query
 * @returns Expanded query with synonyms
 */
export const expandQueryWithSynonyms = (query: string): string[] => {
  initializeSynonymMap();

  if (!query) return [query];

  const normalizedQuery = query.toLowerCase().trim();
  const expandedQueries: string[] = [query]; // Keep original

  // Check for exact matches in reverse map
  const canonicalForm = REVERSE_SYNONYM_MAP.get(normalizedQuery);
  if (canonicalForm) {
    expandedQueries.push(canonicalForm);
  }

  // Check each word in the query
  const words = normalizedQuery.split(/\s+/);
  for (const word of words) {
    const canonical = REVERSE_SYNONYM_MAP.get(word);
    if (canonical && canonical !== word) {
      expandedQueries.push(canonical);
    }
  }

  // Check for phrase matches (multi-word synonyms)
  for (const [canonical, synonyms] of Object.entries(SYNONYM_DICTIONARY)) {
    for (const synonym of synonyms) {
      if (normalizedQuery.includes(synonym.toLowerCase())) {
        const expanded = normalizedQuery.replace(synonym.toLowerCase(), canonical);
        if (expanded !== normalizedQuery) {
          expandedQueries.push(expanded);
        }
      }
    }
  }

  return Array.from(new Set(expandedQueries));
};

/**
 * Get all searchable terms from the database for typo tolerance
 * This is cached for performance with bounded memory usage
 */
let cachedSearchTerms: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHED_TERMS = 10000; // Maximum number of search terms to cache (prevents unbounded growth)

/**
 * Refresh the cached search terms with bounded cache size
 * SECURITY FIX C6: Exclude soft-deleted services from search terms cache
 */
export const refreshSearchTermsCache = async (): Promise<void> => {
  try {
    // SECURITY FIX C6: Exclude soft-deleted services from search terms
    const [services, categories] = await Promise.all([
      Service.find({ isActive: true, isDeleted: { $ne: true } }, { name: 1, tags: 1, category: 1 }).lean(),
      ServiceCategory.find({ isActive: { $ne: false } }, { name: 1 }).lean(),
    ]);

    const terms = new Set<string>();

    // Add service names
    for (const service of services) {
      if (service.name) terms.add(service.name);
      if (service.category) terms.add(service.category);
      if (service.tags) {
        for (const tag of service.tags) {
          terms.add(tag);
        }
      }
    }

    // Add category names
    for (const category of categories) {
      if (category.name) terms.add(category.name);
    }

    // Add canonical forms from synonym dictionary
    for (const canonical of Object.keys(SYNONYM_DICTIONARY)) {
      terms.add(canonical);
    }

    // Convert to array and sort alphabetically before truncation
    // This ensures deterministic cache eviction when limit is reached
    let termArray = Array.from(terms).sort((a, b) => a.localeCompare(b));

    // Enforce max cache size to prevent unbounded memory growth
    // Using sorted array ensures consistent cache eviction
    if (termArray.length > MAX_CACHED_TERMS) {
      logger.warn(`Search terms cache exceeded limit (${termArray.length}), truncating to ${MAX_CACHED_TERMS}`);
      termArray = termArray.slice(0, MAX_CACHED_TERMS);
    }

    cachedSearchTerms = termArray;
    cacheTimestamp = Date.now();

    logger.debug(`Refreshed search terms cache: ${cachedSearchTerms.length} terms (limit: ${MAX_CACHED_TERMS})`);
  } catch (error) {
    logger.error('Failed to refresh search terms cache:', error);
  }
};

/**
 * Get cached search terms, refreshing if stale
 */
const getSearchTerms = async (): Promise<string[]> => {
  if (!cachedSearchTerms || Date.now() - cacheTimestamp > CACHE_TTL_MS) {
    await refreshSearchTermsCache();
  }
  return cachedSearchTerms || [];
};

// ============================================
// SEARCH ANALYTICS
// ============================================

/**
 * Search analytics data structure
 */
interface SearchAnalytics {
  totalSearches: number;
  zeroResultSearches: number;
  refinementCount: number;
  averageClickPosition: number;
  topQueries: Array<{ query: string; count: number }>;
  zeroResultQueries: Array<{ query: string; count: number; timestamp: number }>;
  queryRefinements: Array<{ original: string; refined: string; timestamp: number }>;
}

/**
 * Redis-backed search analytics (prevents unbounded memory growth)
 * Uses sorted sets and lists with TTL for efficient tracking
 */
const SEARCH_ANALYTICS_TTL = 7 * 24 * 60 * 60; // 7 days retention
const TOP_QUERIES_LIMIT = 100;
const ZERO_RESULT_LIMIT = 500;
const REFINEMENTS_LIMIT = 1000;

interface RedisSearchAnalytics {
  getTotalSearches(): Promise<number>;
  getZeroResultSearches(): Promise<number>;
  getRefinementCount(): Promise<number>;
  getAverageClickPosition(): Promise<number>;
  getTopQueries(limit?: number): Promise<Array<{ query: string; count: number }>>;
  getZeroResultQueries(limit?: number): Promise<Array<{ query: string; count: number; timestamp: number }>>;
  getQueryRefinements(limit?: number): Promise<Array<{ original: string; refined: string; timestamp: number }>>;
  incrementTotalSearches(): Promise<void>;
  incrementZeroResultSearches(): Promise<void>;
  incrementRefinementCount(): Promise<void>;
  recordClickPosition(position: number): Promise<void>;
  addTopQuery(query: string): Promise<void>;
  addZeroResultQuery(query: string): Promise<void>;
  addQueryRefinement(original: string, refined: string): Promise<void>;
  getAll(): Promise<SearchAnalytics>;
  reset(): Promise<void>;
}

const createRedisSearchAnalytics = (): RedisSearchAnalytics => {
  const getClient = () => cache.client;

  return {
    async getTotalSearches() {
      const client = getClient();
      if (!client) return 0;
      return parseInt(await client.get('analytics:search:total') || '0', 10);
    },

    async getZeroResultSearches() {
      const client = getClient();
      if (!client) return 0;
      return parseInt(await client.get('analytics:search:zeroResults') || '0', 10);
    },

    async getRefinementCount() {
      const client = getClient();
      if (!client) return 0;
      return parseInt(await client.get('analytics:search:refinements') || '0', 10);
    },

    async getAverageClickPosition() {
      const client = getClient();
      if (!client) return 0;
      const sum = parseFloat(await client.get('analytics:search:clickSum') || '0');
      const count = parseInt(await client.get('analytics:search:clickCount') || '0', 10);
      return count > 0 ? sum / count : 0;
    },

    async getTopQueries(limit = TOP_QUERIES_LIMIT) {
      const client = getClient();
      if (!client) return [];
      const results = await client.zrevrange('analytics:search:topQueries', 0, limit - 1, 'WITHSCORES');
      const queries: Array<{ query: string; count: number }> = [];
      for (let i = 0; i < results.length; i += 2) {
        queries.push({ query: results[i], count: parseInt(results[i + 1], 10) });
      }
      return queries;
    },

    async getZeroResultQueries(limit = ZERO_RESULT_LIMIT) {
      const client = getClient();
      if (!client) return [];
      const keys = await client.lrange('analytics:search:zeroResultList', 0, limit - 1);
      return keys.map(k => JSON.parse(k) as { query: string; count: number; timestamp: number });
    },

    async getQueryRefinements(limit = REFINEMENTS_LIMIT) {
      const client = getClient();
      if (!client) return [];
      const keys = await client.lrange('analytics:search:refinementList', 0, limit - 1);
      return keys.map(k => JSON.parse(k) as { original: string; refined: string; timestamp: number });
    },

    async incrementTotalSearches() {
      const client = getClient();
      if (!client) return;
      await client.incr('analytics:search:total');
      await client.expire('analytics:search:total', SEARCH_ANALYTICS_TTL);
    },

    async incrementZeroResultSearches() {
      const client = getClient();
      if (!client) return;
      await client.incr('analytics:search:zeroResults');
      await client.expire('analytics:search:zeroResults', SEARCH_ANALYTICS_TTL);
    },

    async incrementRefinementCount() {
      const client = getClient();
      if (!client) return;
      await client.incr('analytics:search:refinements');
      await client.expire('analytics:search:refinements', SEARCH_ANALYTICS_TTL);
    },

    async recordClickPosition(position: number) {
      const client = getClient();
      if (!client) return;
      await client.incrbyfloat('analytics:search:clickSum', position);
      await client.incr('analytics:search:clickCount');
      await client.expire('analytics:search:clickSum', SEARCH_ANALYTICS_TTL);
      await client.expire('analytics:search:clickCount', SEARCH_ANALYTICS_TTL);
    },

    async addTopQuery(query: string) {
      const client = getClient();
      if (!client) return;
      await client.zincrby('analytics:search:topQueries', 1, query);
      await client.expire('analytics:search:topQueries', SEARCH_ANALYTICS_TTL);
      // Trim to prevent unbounded growth
      const count = await client.zcard('analytics:search:topQueries');
      if (count > TOP_QUERIES_LIMIT * 2) {
        await client.zremrangebyrank('analytics:search:topQueries', 0, count - TOP_QUERIES_LIMIT - 1);
      }
    },

    async addZeroResultQuery(query: string) {
      const client = getClient();
      if (!client) return;
      const entry = JSON.stringify({ query, count: 1, timestamp: Date.now() });
      await client.lpush('analytics:search:zeroResultList', entry);
      await client.ltrim('analytics:search:zeroResultList', 0, ZERO_RESULT_LIMIT - 1);
      await client.expire('analytics:search:zeroResultList', SEARCH_ANALYTICS_TTL);
    },

    async addQueryRefinement(original: string, refined: string) {
      const client = getClient();
      if (!client) return;
      const entry = JSON.stringify({ original, refined, timestamp: Date.now() });
      await client.lpush('analytics:search:refinementList', entry);
      await client.ltrim('analytics:search:refinementList', 0, REFINEMENTS_LIMIT - 1);
      await client.expire('analytics:search:refinementList', SEARCH_ANALYTICS_TTL);
    },

    async getAll() {
      return {
        totalSearches: await this.getTotalSearches(),
        zeroResultSearches: await this.getZeroResultSearches(),
        refinementCount: await this.getRefinementCount(),
        averageClickPosition: await this.getAverageClickPosition(),
        topQueries: await this.getTopQueries(),
        zeroResultQueries: await this.getZeroResultQueries(),
        queryRefinements: await this.getQueryRefinements(),
      };
    },

    async reset() {
      const client = getClient();
      if (!client) return;
      await client.del(
        'analytics:search:total',
        'analytics:search:zeroResults',
        'analytics:search:refinements',
        'analytics:search:clickSum',
        'analytics:search:clickCount',
        'analytics:search:topQueries',
        'analytics:search:zeroResultList',
        'analytics:search:refinementList'
      );
    },
  };
};

// Singleton instance
let searchAnalyticsInstance: RedisSearchAnalytics | null = null;

const getSearchAnalyticsInstance = (): RedisSearchAnalytics => {
  if (!searchAnalyticsInstance) {
    searchAnalyticsInstance = createRedisSearchAnalytics();
  }
  return searchAnalyticsInstance;
};

/**
 * Track a search query (async Redis-backed tracking)
 * @param query - The search query
 * @param resultCount - Number of results returned
 * @param previousQuery - Previous query if this is a refinement (optional)
 */
export const trackSearch = async (
  query: string,
  resultCount: number,
  previousQuery?: string
): Promise<void> => {
  if (!query) return;

  const normalizedQuery = query.toLowerCase().trim();
  const analytics = getSearchAnalyticsInstance();

  // Update total searches
  await analytics.incrementTotalSearches();

  // Track top queries
  await analytics.addTopQuery(normalizedQuery);

  // Track zero-result searches
  if (resultCount === 0) {
    await analytics.incrementZeroResultSearches();
    await analytics.addZeroResultQuery(normalizedQuery);

    // Log zero-result search for investigation
    logger.info('Zero-result search detected', {
      query: normalizedQuery,
      timestamp: new Date().toISOString(),
    });
  }

  // Track query refinements (user modified their search)
  if (previousQuery && previousQuery.toLowerCase().trim() !== normalizedQuery) {
    await analytics.incrementRefinementCount();
    await analytics.addQueryRefinement(previousQuery.toLowerCase().trim(), normalizedQuery);

    // Log refinement pattern
    logger.debug('Search refinement', {
      from: previousQuery,
      to: normalizedQuery,
    });
  }
};

/**
 * Get search analytics summary (async Redis-backed)
 */
export const getSearchAnalytics = async (): Promise<SearchAnalytics> => {
  const analytics = getSearchAnalyticsInstance();
  return analytics.getAll();
};

/**
 * Analyze refinement patterns (async Redis-backed)
 * @returns Analysis of how users refine their searches
 */
export const analyzeRefinementPatterns = async (): Promise<{
  commonRefinements: Array<{ from: string; to: string; count: number }>;
  averageRefinementsPerSession: number;
  mostAbandonedQueryPattern: string | null;
}> => {
  const analytics = getSearchAnalyticsInstance();
  const queryRefinements = await analytics.getQueryRefinements(1000);
  const zeroResultQueries = await analytics.getZeroResultQueries(500);
  const totalSearches = await analytics.getTotalSearches();
  const refinementCount = await analytics.getRefinementCount();

  const refinementCounts = new Map<string, number>();

  for (const ref of queryRefinements) {
    const key = `${ref.original} -> ${ref.refined}`;
    refinementCounts.set(key, (refinementCounts.get(key) || 0) + 1);
  }

  const commonRefinements = Array.from(refinementCounts.entries())
    .map(([key, count]) => {
      const [from, to] = key.split(' -> ');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate abandoned query patterns (queries that lead to zero results)
  const abandonedPatterns = zeroResultQueries
    .filter(z => {
      // Check if this query was later refined
      return !queryRefinements.some(
        r => r.original === z.query && r.refined !== z.query
      );
    })
    .map(z => z.query);

  return {
    commonRefinements,
    averageRefinementsPerSession: totalSearches > 0
      ? refinementCount / Math.ceil(totalSearches / 10)
      : 0,
    mostAbandonedQueryPattern: abandonedPatterns.length > 0
      ? abandonedPatterns.sort((a, b) => {
          const countA = zeroResultQueries.find(z => z.query === a)?.count || 0;
          const countB = zeroResultQueries.find(z => z.query === b)?.count || 0;
          return countB - countA;
        })[0]
      : null,
  };
};

// ============================================
// GEO-SEARCH FALLBACK
// ============================================

/**
 * Search options with geo-location support
 */
export interface GeoSearchOptions extends SearchOptions {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

/**
 * Search results with geo-distance
 */
export interface GeoSearchResults extends SearchResults {
  centerPoint?: {
    latitude: number;
    longitude: number;
  };
  geoFallbackTriggered?: boolean;
  geoResults?: any[];
  textQuery?: string;
}

/**
 * Fallback geo search using MongoDB $geoWithin when Meilisearch is unavailable
 * SECURITY FIX C3: Add isDeleted filter to exclude soft-deleted services
 * @param query - Search query
 * @param options - Search options including geo parameters
 * @returns Search results with distance information
 */
const geoFallbackSearch = async (
  query: string,
  options: GeoSearchOptions = {}
): Promise<GeoSearchResults> => {
  const startTime = Date.now();

  try {
    const {
      limit = 20,
      offset = 0,
      category,
      subcategory,
      minPrice,
      maxPrice,
      minRating,
      latitude,
      longitude,
      radiusKm = 25, // Default 25km radius
      tags,
    } = options;

    // SECURITY FIX C3: Exclude soft-deleted services
    const searchQuery: any = {
      isActive: true,
      isDeleted: { $ne: true },
    };

    // Text search if query provided
    if (query) {
      const escapedQuery = escapeRegex(query);
      searchQuery.$or = [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { description: { $regex: escapedQuery, $options: 'i' } },
        { category: { $regex: escapedQuery, $options: 'i' } },
        { tags: { $regex: escapedQuery, $options: 'i' } },
      ];
    }

    // Apply filters
    if (category) searchQuery.category = buildCaseInsensitiveNameFilter(category);
    if (subcategory) searchQuery.subcategory = buildCaseInsensitiveNameFilter(subcategory);
    if (minPrice !== undefined) searchQuery['price.amount'] = { $gte: minPrice };
    if (maxPrice !== undefined) {
      searchQuery['price.amount'] = {
        ...searchQuery['price.amount'],
        $lte: maxPrice,
      };
    }
    if (minRating !== undefined) searchQuery['rating.average'] = { $gte: minRating };
    if (tags && tags.length > 0) {
      searchQuery.tags = { $in: tags };
    }
    if (options.providerId && mongoose.Types.ObjectId.isValid(options.providerId)) {
      searchQuery.providerId = new mongoose.Types.ObjectId(options.providerId);
    }

    let queryBuilder = Service.find(searchQuery);

    // Apply geo-filter if coordinates provided
    if (latitude !== undefined && longitude !== undefined) {
      queryBuilder = Service.find({
        ...searchQuery,
        location: {
          $geoWithin: {
            $centerSphere: [
              [longitude, latitude], // [lng, lat] for MongoDB
              radiusKm / 6378.1, // Convert km to radians (Earth radius = 6378.1 km)
            ],
          },
        },
      });
    }

    // Execute query with sorting and pagination
    const [services, total] = await Promise.all([
      queryBuilder
        .skip(offset)
        .limit(limit)
        .select({
          name: 1,
          description: 1,
          category: 1,
          subcategory: 1,
          price: 1,
          rating: 1,
          location: 1,
          images: 1,
          tags: 1,
          providerId: 1,
        })
        .lean(),
      Service.countDocuments(searchQuery),
    ]);

    // Calculate distances for services that have coordinates
    const resultsWithDistance = services.map((service: any) => {
      if (
        latitude !== undefined &&
        longitude !== undefined &&
        service.location?.coordinates
      ) {
        const [svcLng, svcLat] = service.location.coordinates;
        const distance = calculateHaversineDistance(
          latitude,
          longitude,
          svcLat,
          svcLng
        );
        return { ...service, distance };
      }
      return { ...service, distance: null };
    });

    // Sort by distance if geo coordinates provided
    if (latitude !== undefined && longitude !== undefined) {
      resultsWithDistance.sort((a: any, b: any) => (a.distance || Infinity) - (b.distance || Infinity));
    }

    return {
      hits: resultsWithDistance,
      estimatedTotalHits: total,
      processingTimeMs: Date.now() - startTime,
      query,
      centerPoint:
        latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : undefined,
    };
  } catch (error) {
    logger.error('Geo fallback search failed:', error);
    return {
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: Date.now() - startTime,
      query,
    };
  }
};

/**
 * Calculate Haversine distance between two points
 * @param lat1 - Latitude of point 1
 * @param lon1 - Longitude of point 1
 * @param lat2 - Latitude of point 2
 * @param lon2 - Longitude of point 2
 * @returns Distance in kilometers
 */
const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6378.1; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

// ============================================
// DEFAULT SEARCH RANKING RULES
// ============================================

const DEFAULT_RANKING_RULES = [
  'providerTrustScore:desc',
  'words',
  'typo',
  'proximity',
  'attribute',
  'sort',
  'exactness',
];

// ============================================
// SEARCH OPTIONS INTERFACES
// ============================================

export interface SearchOptions {
  limit?: number;
  offset?: number;
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: 'rating' | 'price_asc' | 'price_desc' | 'popular';
  providerId?: string;
  tags?: string[];
  tenantId?: string; // SECURITY: tenant isolation
}

const buildMongoSort = (sortBy?: SearchOptions['sortBy']): Record<string, 1 | -1> => {
  switch (sortBy) {
    case 'price_asc':
      return { 'price.amount': 1 };
    case 'price_desc':
      return { 'price.amount': -1 };
    case 'rating':
      return { 'rating.average': -1 };
    case 'popular':
    default:
      return { 'searchMetadata.popularityScore': -1 };
  }
};

// ============================================
// SEARCH RESULTS INTERFACE
// ============================================

export interface SearchResults {
  hits: any[];
  estimatedTotalHits: number;
  processingTimeMs: number;
  query: string;
  facetDistribution?: Record<string, Record<string, number>>;
  didYouMean?: string[];
  correctionApplied?: boolean;
}

// ============================================
// MEILISEARCH INDEX INITIALIZATION
// ============================================

/**
 * Initialize Meilisearch indexes with proper configuration
 */
export const initializeIndexes = async (): Promise<void> => {
  if (!isMeiliSearchConfigured()) {
    logger.warn('Meilisearch not configured - using MongoDB fallback');
    return;
  }

  try {
    const client = await getMeiliClient();
    if (!client) return;

    // Create indexes if they don't exist
    try {
      await client.createIndex(INDEXES.SERVICES, { primaryKey: 'id' });
      logger.info(`Created Meilisearch index: ${INDEXES.SERVICES}`);
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        logger.warn(`Index ${INDEXES.SERVICES} creation: ${e.message}`);
      }
    }

    try {
      await client.createIndex(INDEXES.PROVIDERS, { primaryKey: 'id' });
      logger.info(`Created Meilisearch index: ${INDEXES.PROVIDERS}`);
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        logger.warn(`Index ${INDEXES.PROVIDERS} creation: ${e.message}`);
      }
    }

    try {
      await client.createIndex(INDEXES.CATEGORIES, { primaryKey: 'id' });
      logger.info(`Created Meilisearch index: ${INDEXES.CATEGORIES}`);
    } catch (e: any) {
      if (!e.message?.includes('already exists')) {
        logger.warn(`Index ${INDEXES.CATEGORIES} creation: ${e.message}`);
      }
    }

    // Configure services index with enhanced typo tolerance
    // SECURITY FIX C10: Add tenantId, isDeleted, and status to filterableAttributes
    const servicesIndex = client.index(INDEXES.SERVICES);
    await servicesIndex.updateSettings({
      searchableAttributes: [
        'name',
        'description',
        'category',
        'subcategory',
        'tags',
        'provider.name',
      ],
      filterableAttributes: [
        'category',
        'subcategory',
        'isActive',
        'isDeleted',
        'status',
        'tenantId',
        'pricing.basePrice',
        'rating.average',
        'provider.id',
        'tags',
      ],
      sortableAttributes: [
        'price.amount',
        'rating.average',
        'totalBookings',
        'createdAt',
        'provider.trustScore',
      ],
      rankingRules: DEFAULT_RANKING_RULES,
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 4,
          twoTypos: 8,
        },
      },
      // Enable synonyms in Meilisearch
      synonyms: SYNONYM_DICTIONARY,
    });

    // Configure providers index
    const providersIndex = client.index(INDEXES.PROVIDERS);
    await providersIndex.updateSettings({
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness', 'trustScore:desc'],
      searchableAttributes: [
        'firstName',
        'lastName',
        'businessName',
        'email',
        'city',
        'state',
      ],
      filterableAttributes: [
        'isActive',
        'isVerified',
        'city',
        'state',
        'trustScore',
        'rating.average',
      ],
      sortableAttributes: [
        'trustScore',
        'rating.average',
        'totalServices',
        'totalBookings',
        'createdAt',
      ],
    });

    // Configure categories index
    const categoriesIndex = client.index(INDEXES.CATEGORIES);
    await categoriesIndex.updateSettings({
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      searchableAttributes: ['name', 'description'],
      filterableAttributes: ['isActive', 'parentId'],
      sortableAttributes: ['serviceCount', 'name'],
    });

    logger.info('Meilisearch indexes initialized successfully');
  } catch (error) {
    logSearchError('Failed to initialize Meilisearch indexes', error);
    resetMeiliClient();
  }
};

// ============================================
// INDEXING FUNCTIONS
// ============================================

/**
 * Invalidate search cache
 * Called when services are created, updated, or deleted
 */
// FIX: Use SCAN instead of KEYS to avoid blocking Redis in production
const invalidateSearchCache = async (): Promise<void> => {
  const redisClient = cache.client;
  if (!redisClient) return;

  try {
    // Use SCAN with cursor iteration to avoid blocking Redis
    let cursor = '0';
    let deletedCount = 0;
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        'MATCH', 'cache:search*',
        'COUNT', 100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');
    logger.debug(`Invalidated ${deletedCount} search cache entries`);
  } catch (err) {
    logger.warn('Search cache invalidation failed:', err);
  }
};

/**
 * Track popular search queries for analytics and caching
 * @param query - The search query to track
 */
const trackPopularSearch = async (query: string): Promise<void> => {
  if (!query || query.length < 2) return;

  const redisClient = cache.client;
  if (!redisClient) return;

  try {
    const normalizedQuery = query.toLowerCase().trim();
    await redisClient.zincrby('analytics:search:popularQueries', 1, normalizedQuery);
    await redisClient.expire('analytics:search:popularQueries', POPULAR_SEARCHES_TTL);
  } catch (err) {
    logger.warn('Popular search tracking failed:', err);
  }
};

/**
 * Get popular search queries
 * @param limit - Maximum number of queries to return
 */
export const getPopularSearches = async (limit = 10): Promise<string[]> => {
  const redisClient = cache.client;
  if (!redisClient) return [];

  try {
    const results = await redisClient.zrevrange('analytics:search:popularQueries', 0, limit - 1, 'WITHSCORES');
    return results.filter((_, i) => i % 2 === 0);
  } catch (err) {
    logger.warn('Get popular searches failed:', err);
    return [];
  }
};

/**
 * Get cached suggestions for a query
 * @param query - The search query
 * @returns Cached suggestions or null if not cached
 */
const getCachedSuggestions = async (query: string): Promise<string[] | null> => {
  const redisClient = cache.client;
  if (!redisClient) return null;

  try {
    const normalizedQuery = query.toLowerCase().trim();
    const cached = await redisClient.get(`cache:suggestions:${normalizedQuery}`);
    if (cached) {
      logger.debug(`Suggestion cache hit for: ${normalizedQuery}`);
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.warn('Get cached suggestions failed:', err);
  }
  return null;
};

/**
 * Cache search suggestions
 * @param query - The search query
 * @param suggestions - The suggestions to cache
 */
const setCachedSuggestions = async (query: string, suggestions: string[]): Promise<void> => {
  const redisClient = cache.client;
  if (!redisClient || suggestions.length === 0) return;

  try {
    const normalizedQuery = query.toLowerCase().trim();
    await redisClient.setex(
      `cache:suggestions:${normalizedQuery}`,
      SUGGESTIONS_CACHE_TTL,
      JSON.stringify(suggestions)
    );
    logger.debug(`Cached ${suggestions.length} suggestions for: ${normalizedQuery}`);
  } catch (err) {
    logger.warn('Cache suggestions failed:', err);
  }
};

/**
 * Index a single service in Meilisearch
 */
export const indexService = async (service: any): Promise<void> => {
  const client = await getMeiliClient();
  if (!client) return;

  try {
    const document = {
      id: service._id.toString(),
      title: service.name,
      description: service.description,
      category: service.category,
      subcategory: service.subcategory,
      tags: service.tags || [],
      pricing: {
        basePrice: service.price?.amount || 0,
        currency: service.price?.currency || 'AED',
      },
      rating: {
        average: service.rating?.average || 0,
        count: service.rating?.count || 0,
      },
      provider: {
        id: service.providerId?.toString(),
        name: service.providerName || 'Unknown',
        trustScore: service.providerTrustScore || 0,
      },
      totalBookings: service.searchMetadata?.bookingCount || 0,
      isActive: service.isActive,
      isDeleted: service.isDeleted || false, // SECURITY FIX: Track deletion status
      tenantId: service.tenantId || null, // SECURITY FIX: Track tenant for isolation
      createdAt: new Date(service.createdAt).getTime(),
      updatedAt: new Date(service.updatedAt).getTime(),
      providerTrustScore: service.providerTrustScore || 0,
    };

    await client.index(INDEXES.SERVICES).addDocuments([document]);
    logger.debug(`Service ${service._id} indexed in Meilisearch`);

    // Phase 1: Invalidate search cache on service create
    await invalidateSearchCache();
  } catch (error) {
    logger.error(`Failed to index service ${service._id}:`, error);
  }
};

/**
 * Partially update a service document in Meilisearch (or full re-index if needed)
 */
export const updateServiceInIndex = async (
  serviceId: string,
  partial: Record<string, unknown>
): Promise<void> => {
  const client = await getMeiliClient();
  if (!client) return;

  try {
    const service = await Service.findById(serviceId).lean();
    if (!service) {
      await client.index(INDEXES.SERVICES).deleteDocument(serviceId);
      // Phase 1: Invalidate search cache on service delete
      await invalidateSearchCache();
      return;
    }

    const merged = {
      ...service,
      isActive: partial.isActive ?? service.isActive,
      status: partial.status ?? service.status,
      updatedAt: partial.updatedAt ?? service.updatedAt,
    };
    await indexService(merged);
    // Phase 1: Cache invalidation handled in indexService
  } catch (error) {
    logger.error(`Failed to update service ${serviceId} in Meilisearch:`, error);
  }
};

/**
 * Remove a service from the Meilisearch index
 */
export const removeServiceFromIndex = async (serviceId: string): Promise<void> => {
  const client = await getMeiliClient();
  if (!client) return;

  try {
    await client.index(INDEXES.SERVICES).deleteDocument(serviceId);
    logger.debug(`Service ${serviceId} removed from Meilisearch`);
    // Phase 1: Invalidate search cache on service remove
    await invalidateSearchCache();
  } catch (error) {
    logger.error(`Failed to remove service ${serviceId} from Meilisearch:`, error);
  }
};

/**
 * Index a single provider in Meilisearch
 */
export const indexProvider = async (provider: any): Promise<void> => {
  const client = await getMeiliClient();
  if (!client) return;

  try {
    const document = {
      id: provider._id.toString(),
      firstName: provider.firstName || '',
      lastName: provider.lastName || '',
      businessName: provider.businessInfo?.businessName,
      email: provider.email,
      phone: provider.phone || '',
      city: provider.locationInfo?.city || '',
      state: provider.locationInfo?.state || '',
      trustScore: provider.trustScore || 0,
      rating: {
        average: provider.rating?.average || 0,
        count: provider.rating?.count || 0,
      },
      totalServices: provider.totalServices || 0,
      totalBookings: provider.totalBookings || 0,
      isVerified: provider.isVerified || false,
      isActive: provider.isActive !== false,
      createdAt: new Date(provider.createdAt).getTime(),
    };

    await client.index(INDEXES.PROVIDERS).addDocuments([document]);
    logger.debug(`Provider ${provider._id} indexed in Meilisearch`);
  } catch (error) {
    logger.error(`Failed to index provider ${provider._id}:`, error);
  }
};

/**
 * Index a single category in Meilisearch
 */
export const indexCategory = async (category: any): Promise<void> => {
  const client = await getMeiliClient();
  if (!client) return;

  try {
    const document = {
      id: category._id.toString(),
      name: category.name,
      description: category.description || '',
      parentId: category.parentId?.toString(),
      icon: category.icon,
      serviceCount: category.serviceCount || 0,
      isActive: category.isActive !== false,
    };

    await client.index(INDEXES.CATEGORIES).addDocuments([document]);
    logger.debug(`Category ${category._id} indexed in Meilisearch`);
  } catch (error) {
    logger.error(`Failed to index category ${category._id}:`, error);
  }
};

// ============================================
// MAIN SEARCH FUNCTIONS
// ============================================

/**
 * Search services using Meilisearch with typo tolerance and synonym support
 */
export const searchServices = async (
  query: string,
  options: SearchOptions = {},
  previousQuery?: string
): Promise<SearchResults> => {
  const startTime = Date.now();
  const { tenantId } = options;

  // Track search for analytics
  trackSearch(query, 0, previousQuery);

  // Track popular searches for caching
  trackPopularSearch(query);

  // Apply synonym expansion first
  const expandedQueries = expandQueryWithSynonyms(query);
  const primaryQuery = expandedQueries[0];

  // Phase 1: Search result caching layer (5-minute TTL)
  // SECURITY FIX: Include tenantId in cache key for multi-tenant isolation
  const cacheKey = buildSearchCacheKey(primaryQuery, options, tenantId);
  const redisClient = cache.client;
  if (redisClient) {
    try {
      const cached = await redisClient.get(`cache:${cacheKey}`);
      if (cached) {
        logger.debug(`Search cache hit for key: ${cacheKey}`);
        const parsed = JSON.parse(cached) as SearchResults;
        trackSearch(query, parsed.estimatedTotalHits, previousQuery);
        return parsed;
      }
    } catch (err) {
      logger.warn('Search cache read failed:', err);
    }
  }

  // Try Meilisearch first (skip when empty query — MongoDB is faster for browse/popular lists)
  const client = primaryQuery ? await getMeiliClient() : null;

  if (!client) {
    const results = await fallbackSearch(primaryQuery, options);
    trackSearch(query, results.estimatedTotalHits, previousQuery);
    return results;
  }

  try {
    const {
      limit = 20,
      offset = 0,
      category,
      subcategory,
      minPrice,
      maxPrice,
      minRating,
      sortBy,
      tags,
    } = options;

    // Build filters
    // SECURITY FIX C1-C2: Add tenantId and isDeleted filters for multi-tenant isolation
    const filters: string[] = ['isActive = true', 'isDeleted = false'];
    if (tenantId) filters.push(`tenantId = "${tenantId}"`);
    if (category) filters.push(`category = "${category}"`);
    if (subcategory) filters.push(`subcategory = "${subcategory}"`);
    if (minPrice !== undefined) filters.push(`pricing.basePrice >= ${minPrice}`);
    if (maxPrice !== undefined) filters.push(`pricing.basePrice <= ${maxPrice}`);
    if (minRating !== undefined) filters.push(`rating.average >= ${minRating}`);
    if (tags && tags.length > 0) {
      filters.push(`tags IN [${tags.map(t => `"${t}"`).join(', ')}]`);
    }
    if (options.providerId) {
      // FIX: Use correct Meilisearch document field name 'provider.id' instead of 'providerId'
      filters.push(`provider.id = "${options.providerId}"`);
    }

    // Build sort
    let sort: string[] | undefined;
    if (sortBy) {
      switch (sortBy) {
        case 'rating':
          sort = ['rating.average:desc'];
          break;
        case 'price_asc':
          sort = ['pricing.basePrice:asc'];
          break;
        case 'price_desc':
          sort = ['pricing.basePrice:desc'];
          break;
        case 'popular':
          sort = ['totalBookings:desc'];
          break;
      }
    }

    const searchResult = await client.index(INDEXES.SERVICES).search(primaryQuery, {
      limit,
      offset,
      filter: filters.join(' AND '),
      sort,
      attributesToHighlight: ['name', 'description'],
    });

    // Check if we got results, if not try synonym-expanded queries
    let finalResult = searchResult;
    let correctionApplied = false;
    let didYouMean: string[] | undefined;

    if (searchResult.estimatedTotalHits === 0 && expandedQueries.length > 1) {
      // Try each expanded query
      for (let i = 1; i < expandedQueries.length; i++) {
        const altQuery = expandedQueries[i];
        const altResult = await client.index(INDEXES.SERVICES).search(altQuery, {
          limit,
          offset,
          filter: filters.join(' AND '),
          sort,
          attributesToHighlight: ['name', 'description'],
        });

        if (altResult.estimatedTotalHits > 0) {
          finalResult = altResult;
          correctionApplied = true;
          didYouMean = [altQuery];
          logger.info(`Search corrected: "${primaryQuery}" -> "${altQuery}"`);
          break;
        }
      }
    }

    // If still no results, try MongoDB fallback for provider-specific queries
    // This ensures provider search works even if Meilisearch is not synced
    if (finalResult.estimatedTotalHits === 0 && options.providerId) {
      logger.info(`Meilisearch returned 0 results for provider search, falling back to MongoDB`);
      const fallbackResults = await fallbackSearch(primaryQuery, options);
      return {
        hits: fallbackResults.hits,
        estimatedTotalHits: fallbackResults.estimatedTotalHits,
        processingTimeMs: fallbackResults.processingTimeMs,
        query: fallbackResults.query,
        facetDistribution: fallbackResults.facetDistribution,
        didYouMean: fallbackResults.didYouMean,
        correctionApplied: false,
      };
    }

    // If still no results, generate "Did you mean?" suggestions using Levenshtein
    if (finalResult.estimatedTotalHits === 0) {
      const knownTerms = await getSearchTerms();
      const suggestions = findSuggestions(primaryQuery, knownTerms);

      if (suggestions.length > 0) {
        didYouMean = suggestions.map(s => s.term);
        logger.info(`No results for "${primaryQuery}", suggestions: ${didYouMean.join(', ')}`);
      }
    }

    // Update analytics with actual result count
    trackSearch(query, finalResult.estimatedTotalHits || 0, previousQuery);

    const searchResults: SearchResults = {
      hits: finalResult.hits || [],
      estimatedTotalHits: finalResult.estimatedTotalHits || 0,
      processingTimeMs: finalResult.processingTimeMs || Date.now() - startTime,
      query: finalResult.query || primaryQuery,
      facetDistribution: finalResult.facetDistribution,
      didYouMean,
      correctionApplied,
    };

    // Phase 1: Store search results in cache with 5-minute TTL
    if (redisClient) {
      try {
        await redisClient.setex(`cache:${cacheKey}`, SEARCH_CACHE_TTL, JSON.stringify(searchResults));
        logger.debug(`Search results cached with key: ${cacheKey}`);
      } catch (err) {
        logger.warn('Search cache write failed:', err);
      }
    }

    return searchResults;
  } catch (error) {
    logSearchError('Meilisearch search failed, using MongoDB fallback', error);
    resetMeiliClient();
    const results = await fallbackSearch(primaryQuery, options);

    // Phase 1: Store fallback search results in cache with 5-minute TTL
    if (redisClient) {
      try {
        await redisClient.setex(`cache:${cacheKey}`, SEARCH_CACHE_TTL, JSON.stringify(results));
        logger.debug(`Fallback search results cached with key: ${cacheKey}`);
      } catch (err) {
        logger.warn('Search cache write failed:', err);
      }
    }

    trackSearch(query, results.estimatedTotalHits, previousQuery);
    return results;
  }
};

/**
 * Get search suggestions with typo tolerance and caching
 * SECURITY FIX: Support tenant isolation
 */
export const getSearchSuggestions = async (
  query: string,
  limit: number = 5,
  tenantId?: string
): Promise<string[]> => {
  // Check cache first
  const cachedSuggestions = await getCachedSuggestions(query);
  if (cachedSuggestions !== null) {
    return cachedSuggestions.slice(0, limit);
  }

  const client = await getMeiliClient();

  if (!client) {
    // Fallback to MongoDB suggestions with tenant isolation
    const suggestions = await getMongoSuggestions(query, limit, tenantId);
    await setCachedSuggestions(query, suggestions);
    return suggestions;
  }

  try {
    const searchResult = await client.index(INDEXES.SERVICES).search(query, {
      limit,
      attributesToRetrieve: ['name', 'category'],
    });

    let suggestions: string[] = searchResult.hits.map(
      (hit: any) => hit.title as string
    );

    // If no results, try Levenshtein-based suggestions
    if (suggestions.length === 0 && query.length >= 2) {
      const knownTerms = await getSearchTerms();
      const typoSuggestions = findSuggestions(query, knownTerms);
      suggestions = typoSuggestions.map(s => s.term);
    }

    const uniqueSuggestions = Array.from(new Set<string>(suggestions));

    // Cache the suggestions
    await setCachedSuggestions(query, uniqueSuggestions);

    return uniqueSuggestions.slice(0, limit);
  } catch (error) {
    logSearchError('Meilisearch suggestions failed, using MongoDB fallback', error);
    resetMeiliClient();
    // Pass tenantId to MongoDB fallback for tenant isolation
    const suggestions = await getMongoSuggestions(query, limit, tenantId);
    await setCachedSuggestions(query, suggestions);
    return suggestions;
  }
};

/**
 * Get suggestions from MongoDB fallback
 * SECURITY FIX C11: Add tenantId and isDeleted filters for multi-tenant isolation
 */
const getMongoSuggestions = async (
  query: string,
  limit: number,
  tenantId?: string
): Promise<string[]> => {
  if (!query) return [];

  try {
    const escapedQuery = escapeRegex(query);
    // SECURITY FIX C11: Exclude soft-deleted services and apply tenant isolation
    const serviceQuery: any = {
      isActive: true,
      isDeleted: { $ne: true },
    };

    // SECURITY FIX: Apply tenant filter for multi-tenant isolation
    if (tenantId) {
      serviceQuery.tenantId = tenantId;
    }

    serviceQuery.name = { $regex: escapedQuery, $options: 'i' };

    const services = await Service.find(serviceQuery)
      .select('name')
      .limit(limit)
      .lean();

    return services.map(s => s.name).filter(Boolean);
  } catch (error) {
    logger.error('Failed to get MongoDB suggestions:', error);
    return [];
  }
};

// ============================================
// GEO-SEARCH FUNCTIONS
// ============================================

/**
 * Search services with geo-filtering
 * MANDATORY GEO FALLBACK: When text search returns <3 results, always trigger geo search
 */
export const searchServicesWithGeo = async (
  query: string,
  options: GeoSearchOptions = {},
  previousQuery?: string
): Promise<GeoSearchResults> => {
  const client = await getMeiliClient();

  // Track search
  trackSearch(query, 0, previousQuery);

  // Apply synonym expansion
  const expandedQueries = expandQueryWithSynonyms(query);
  const primaryQuery = expandedQueries[0];

  const {
    limit = 20,
    offset = 0,
    category,
    subcategory,
    minPrice,
    maxPrice,
    minRating,
    sortBy,
    latitude,
    longitude,
    radiusKm = 50, // Default 50km radius for geo fallback
    tags,
    tenantId,
  } = options;

  let textSearchResults: any[] = [];
  let textTotalHits = 0;
  let meilisearchAvailable = false;

  // If Meilisearch is available, try it first
  if (client) {
    try {
      meilisearchAvailable = true;

      // SECURITY FIX C1-C2: Add tenantId and isDeleted filters for multi-tenant isolation
      // Build filters
      const filters: string[] = ['isActive = true', 'isDeleted = false'];
      if (tenantId) filters.push(`tenantId = "${tenantId}"`);
      if (category) filters.push(`category = "${category}"`);
      if (subcategory) filters.push(`subcategory = "${subcategory}"`);
      if (minPrice !== undefined) filters.push(`pricing.basePrice >= ${minPrice}`);
      if (maxPrice !== undefined) filters.push(`pricing.basePrice <= ${maxPrice}`);
      if (minRating !== undefined) filters.push(`rating.average >= ${minRating}`);
      if (tags && tags.length > 0) {
        filters.push(`tags IN [${tags.map(t => `"${t}"`).join(', ')}]`);
      }

      // Build sort
      let sort: string[] | undefined;
      if (sortBy) {
        switch (sortBy) {
          case 'rating':
            sort = ['rating.average:desc'];
            break;
          case 'price_asc':
            sort = ['pricing.basePrice:asc'];
            break;
          case 'price_desc':
            sort = ['pricing.basePrice:desc'];
            break;
          case 'popular':
            sort = ['totalBookings:desc'];
            break;
        }
      }

      const searchResult = await client.index(INDEXES.SERVICES).search(primaryQuery, {
        limit,
        offset,
        filter: filters.join(' AND '),
        sort,
        attributesToHighlight: ['name', 'description'],
      });

      textSearchResults = searchResult.hits || [];
      textTotalHits = searchResult.estimatedTotalHits || 0;

      trackSearch(query, textTotalHits, previousQuery);

      // If text search has sufficient results (>= 3), return immediately
      if (textTotalHits >= 3) {
        return {
          hits: textSearchResults,
          estimatedTotalHits: textTotalHits,
          processingTimeMs: searchResult.processingTimeMs,
          query: searchResult.query || primaryQuery,
          facetDistribution: searchResult.facetDistribution,
          centerPoint:
            latitude !== undefined && longitude !== undefined
              ? { latitude, longitude }
              : undefined,
        };
      }
    } catch (error) {
      logSearchError('Meilisearch geo search failed, using fallback', error);
      resetMeiliClient();
    }
  }

  // MANDATORY GEO FALLBACK: If text search returned < 3 results OR Meilisearch unavailable
  // Always search by service location, ignoring text query for geo matching
  const LOW_TEXT_RESULTS_THRESHOLD = 3;

  if (textTotalHits < LOW_TEXT_RESULTS_THRESHOLD || !meilisearchAvailable) {
    logger.info('Triggering mandatory geo fallback search', {
      query,
      textHits: textTotalHits,
      meilisearchAvailable,
      action: 'GEO_FALLBACK_TRIGGERED',
    });

    // Perform geo-only search to find nearby services
    const geoResults = await performGeoSearch(options, limit, offset, category, subcategory, minPrice, maxPrice, minRating, tags);

    // If we had some text results, include them too
    const combinedHits = [...textSearchResults];

    // Add geo results that aren't already in text results
    const textIds = new Set(textSearchResults.map((h: any) => h.id));
    for (const geoHit of geoResults.hits) {
      if (!textIds.has(geoHit.id)) {
        combinedHits.push(geoHit);
      }
    }

    trackSearch(query, combinedHits.length, previousQuery);

    return {
      hits: combinedHits,
      estimatedTotalHits: combinedHits.length,
      processingTimeMs: geoResults.processingTimeMs || 0,
      query: primaryQuery,
      geoFallbackTriggered: true,
      geoResults: geoResults.hits,
      textQuery: textTotalHits < LOW_TEXT_RESULTS_THRESHOLD ? query : undefined,
      centerPoint:
        latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : undefined,
    };
  }

  // Fallback to MongoDB geo search
  const results = await geoFallbackSearch(query, options);
  trackSearch(query, results.estimatedTotalHits, previousQuery);
  return results;
};

/**
 * Perform geo-only search to find nearby services
 * Uses service's registered location coordinates, not user's location
 */
/**
 * Perform geo-only search to find nearby services
 * Uses service's registered location coordinates, not user's location
 * SECURITY FIX C4: Add isDeleted filter and tenant isolation
 */
async function performGeoSearch(
  options: GeoSearchOptions,
  limit: number,
  offset: number,
  category?: string,
  subcategory?: string,
  minPrice?: number,
  maxPrice?: number,
  minRating?: number,
  tags?: string[]
): Promise<{ hits: any[]; processingTimeMs: number }> {
  const startTime = Date.now();
  const { latitude, longitude, radiusKm = 50, tenantId } = options;

  if (latitude === undefined || longitude === undefined) {
    return { hits: [], processingTimeMs: Date.now() - startTime };
  }

  try {
    // SECURITY FIX C4: Exclude soft-deleted services and apply tenant isolation
    const searchQuery: any = {
      isActive: true,
      isDeleted: { $ne: true },
    };

    // SECURITY FIX: Apply tenant filter for multi-tenant isolation
    if (tenantId) {
      searchQuery.tenantId = tenantId;
    }

    if (category) searchQuery.category = buildCaseInsensitiveNameFilter(category);
    if (subcategory) searchQuery.subcategory = buildCaseInsensitiveNameFilter(subcategory);
    if (minPrice !== undefined) searchQuery['price.amount'] = { $gte: minPrice };
    if (maxPrice !== undefined) {
      searchQuery['price.amount'] = {
        ...searchQuery['price.amount'],
        $lte: maxPrice,
      };
    }
    if (minRating !== undefined) searchQuery['rating.average'] = { $gte: minRating };
    if (tags && tags.length > 0) {
      searchQuery.tags = { $in: tags };
    }

    // Add geo filter - find services within radius of user's location
    searchQuery.location = {
      $geoWithin: {
        $centerSphere: [
          [longitude, latitude],
          radiusKm / 6378.1, // Convert km to radians
        ],
      },
    };

    const services = await Service.find(searchQuery)
      .skip(offset)
      .limit(limit)
      .lean();

    // Calculate distance for each service
    const servicesWithDistance = services.map((service: any) => {
      if (service.location?.coordinates) {
        const [svcLng, svcLat] = service.location.coordinates;
        const distance = calculateHaversineDistance(
          latitude,
          longitude,
          svcLat,
          svcLng
        );
        return { ...service, distance: Math.round(distance * 100) / 100 };
      }
      return { ...service, distance: null };
    });

    // Sort by distance
    servicesWithDistance.sort((a: any, b: any) =>
      (a.distance || Infinity) - (b.distance || Infinity)
    );

    return {
      hits: servicesWithDistance,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Geo search failed:', error);
    return { hits: [], processingTimeMs: Date.now() - startTime };
  }
}

// ============================================
// FALLBACK SEARCH (MONGODB)
// ============================================

/**
 * Fallback search using MongoDB when Meilisearch is unavailable
 * SECURITY FIX C5: Add isDeleted filter and tenant isolation
 */
const fallbackSearch = async (
  query: string,
  options: SearchOptions = {}
): Promise<SearchResults> => {
  const startTime = Date.now();

  try {
    const {
      limit = 20,
      offset = 0,
      category,
      subcategory,
      minPrice,
      maxPrice,
      minRating,
      sortBy,
      tags,
      tenantId,
    } = options;

    // SECURITY FIX C5: Exclude soft-deleted services and apply tenant isolation
    const searchQuery: any = {
      isActive: true,
      isDeleted: { $ne: true },
    };

    // SECURITY FIX: Apply tenant filter for multi-tenant isolation
    if (tenantId) {
      searchQuery.tenantId = tenantId;
    }

    // Text search if query provided - use escaped regex to prevent ReDoS
    if (query) {
      const escapedQuery = escapeRegex(query);
      searchQuery.$or = [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { description: { $regex: escapedQuery, $options: 'i' } },
        { category: { $regex: escapedQuery, $options: 'i' } },
      ];
    }

    if (category) searchQuery.category = buildCaseInsensitiveNameFilter(category);
    if (subcategory) searchQuery.subcategory = buildCaseInsensitiveNameFilter(subcategory);
    if (minPrice !== undefined) searchQuery['price.amount'] = { $gte: minPrice };
    if (maxPrice !== undefined)
      searchQuery['price.amount'] = {
        ...searchQuery['price.amount'],
        $lte: maxPrice,
      };
    if (minRating !== undefined)
      searchQuery['rating.average'] = { $gte: minRating };
    if (tags && tags.length > 0) {
      searchQuery.tags = { $in: tags };
    }
    if (options.providerId && mongoose.Types.ObjectId.isValid(options.providerId)) {
      searchQuery.providerId = new mongoose.Types.ObjectId(options.providerId);
    }

    const sort = buildMongoSort(sortBy);

    const [services, total] = await Promise.all([
      Service.find(searchQuery)
        .populate('providerId', 'firstName lastName avatar rating location')
        .sort(sort)
        .skip(offset)
        .limit(limit)
        .lean(),
      Service.countDocuments(searchQuery),
    ]);

    // Try Levenshtein suggestions if no results
    let didYouMean: string[] | undefined;
    if (total === 0 && query.length >= 2) {
      const knownTerms = await getSearchTerms();
      const suggestions = findSuggestions(query, knownTerms);
      if (suggestions.length > 0) {
        didYouMean = suggestions.map(s => s.term);
      }
    }

    return {
      hits: services,
      estimatedTotalHits: total,
      processingTimeMs: Date.now() - startTime,
      query,
      didYouMean,
    };
  } catch (error) {
    logSearchError('MongoDB fallback search failed', error);
    return {
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: Date.now() - startTime,
      query,
    };
  }
};

// ============================================
// REINDEXING FUNCTIONS
// ============================================

/**
 * Reindex all services
 * SECURITY FIX C12: Exclude soft-deleted services from reindexing
 */
export const reindexAllServices = async (): Promise<void> => {
  const client = await getMeiliClient();
  if (!client) return;

  try {
    // Clear existing index
    await client.index(INDEXES.SERVICES).deleteAllDocuments();

    // Fetch all active services (exclude soft-deleted)
    const services = await Service.find({ isActive: true, isDeleted: { $ne: true } }).lean();

    // Transform to Meilisearch documents
    const documents = services.map((service: any) => ({
      id: service._id.toString(),
      title: service.name,
      description: service.description,
      category: service.category,
      subcategory: service.subcategory,
      tags: service.tags || [],
      pricing: {
        basePrice: service.price?.amount || 0,
        currency: service.price?.currency || 'AED',
      },
      rating: {
        average: service.rating?.average || 0,
        count: service.rating?.count || 0,
      },
      provider: {
        id: service.providerId?.toString(),
        name: service.providerName || 'Unknown',
        trustScore: service.providerTrustScore || 0,
      },
      totalBookings: service.searchMetadata?.bookingCount || 0,
      isActive: service.isActive,
      isDeleted: service.isDeleted || false, // SECURITY FIX: Track deletion status
      tenantId: service.tenantId || null, // SECURITY FIX: Track tenant for isolation
      status: service.status || 'active',
      createdAt: new Date(service.createdAt).getTime(),
      updatedAt: new Date(service.updatedAt).getTime(),
      providerTrustScore: service.providerTrustScore || 0,
    }));
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await client.index(INDEXES.SERVICES).addDocuments(batch);
    }

    logger.info(`Reindexed ${documents.length} services in Meilisearch`);

    // Refresh the search terms cache after reindexing
    await refreshSearchTermsCache();
  } catch (error) {
    logger.error('Failed to reindex services:', error);
  }
};

/**
 * Reindex all providers
 */
export const reindexAllProviders = async (): Promise<void> => {
  const client = await getMeiliClient();
  if (!client) return;

  try {
    await client.index(INDEXES.PROVIDERS).deleteAllDocuments();

    const providers = await ProviderProfile.find({ isActive: { $ne: false } }).lean();

    const documents = providers.map((provider: any) => ({
      id: provider._id.toString(),
      firstName: provider.firstName || '',
      lastName: provider.lastName || '',
      businessName: provider.businessInfo?.businessName,
      email: provider.email,
      phone: provider.phone || '',
      city: provider.locationInfo?.city || '',
      state: provider.locationInfo?.state || '',
      trustScore: provider.trustScore || 0,
      rating: {
        average: provider.rating?.average || 0,
        count: provider.rating?.count || 0,
      },
      totalServices: provider.totalServices || 0,
      totalBookings: provider.totalBookings || 0,
      isVerified: provider.isVerified || false,
      isActive: provider.isActive !== false,
      createdAt: new Date(provider.createdAt).getTime(),
    }));

    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await client.index(INDEXES.PROVIDERS).addDocuments(batch);
    }

    logger.info(`Reindexed ${documents.length} providers in Meilisearch`);
  } catch (error) {
    logger.error('Failed to reindex providers:', error);
  }
};

/**
 * Reindex all categories
 */
export const reindexAllCategories = async (): Promise<void> => {
  const client = await getMeiliClient();
  if (!client) return;

  try {
    await client.index(INDEXES.CATEGORIES).deleteAllDocuments();

    const categories = await ServiceCategory.find({ isActive: { $ne: false } }).lean();

    const documents = categories.map((category: any) => ({
      id: category._id.toString(),
      name: category.name,
      description: category.description || '',
      parentId: category.parentId?.toString(),
      icon: category.icon,
      serviceCount: category.serviceCount || 0,
      isActive: category.isActive !== false,
    }));

    await client.index(INDEXES.CATEGORIES).addDocuments(documents);

    logger.info(`Reindexed ${documents.length} categories in Meilisearch`);

    // Refresh the search terms cache after reindexing
    await refreshSearchTermsCache();
  } catch (error) {
    logger.error('Failed to reindex categories:', error);
  }
};

// ============================================
// STATISTICS
// ============================================

/**
 * Get search engine statistics
 */
export const getSearchStats = async (): Promise<{
  meilisearch: {
    configured: boolean;
    healthy: boolean;
    services: { totalDocuments: number; isIndexing: boolean };
    providers: { totalDocuments: number; isIndexing: boolean };
    categories: { totalDocuments: number; isIndexing: boolean };
  };
  mongodb: {
    totalServices: number;
    totalProviders: number;
    totalCategories: number;
  };
}> => {
  const { getIndexStats, checkMeiliSearchHealth } = await import('../config/meilisearch');

  const [
    meiliHealthy,
    meiliStats,
    totalServices,
    totalProviders,
    totalCategories,
  ] = await Promise.all([
    checkMeiliSearchHealth(),
    getIndexStats(),
    Service.countDocuments(),
    ProviderProfile.countDocuments(),
    ServiceCategory.countDocuments(),
  ]);

  return {
    meilisearch: {
      configured: isMeiliSearchConfigured(),
      healthy: meiliHealthy,
      services: meiliStats.services || { totalDocuments: 0, isIndexing: false },
      providers: meiliStats.providers || { totalDocuments: 0, isIndexing: false },
      categories: meiliStats.categories || { totalDocuments: 0, isIndexing: false },
    },
    mongodb: {
      totalServices,
      totalProviders,
      totalCategories,
    },
  };
};

export default {
  initializeIndexes,
  indexService,
  updateServiceInIndex,
  removeServiceFromIndex,
  indexProvider,
  indexCategory,
  searchServices,
  searchServicesWithGeo,
  getSearchSuggestions,
  reindexAllServices,
  reindexAllProviders,
  reindexAllCategories,
  getSearchStats,
  // Export analytics functions
  trackSearch,
  getSearchAnalytics,
  analyzeRefinementPatterns,
  // Export typo tolerance functions
  levenshteinDistance,
  getSimilarityRatio,
  findSuggestions,
  // Export synonym functions
  expandQueryWithSynonyms,
  SYNONYM_DICTIONARY,
  // Export cache refresh
  refreshSearchTermsCache,
  // Export popular searches
  getPopularSearches,
};
