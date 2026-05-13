import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import ServiceCategory from '../models/serviceCategory.model';
import { getMeiliClient, INDEXES, isMeiliSearchConfigured } from '../config/meilisearch';
import logger from '../utils/logger';

/**
 * Escape special regex characters to prevent ReDoS attacks
 * @param str - The input string to escape
 * @returns The escaped string safe for use in regex
 */
const escapeRegex = (str: string): string => {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Default search ranking rules for Meilisearch
const DEFAULT_RANKING_RULES = [
  'words',
  'typo',
  'proximity',
  'attribute',
  'sort',
  'exactness',
  'provider.trustScore:desc',
];

// Search options interface
export interface SearchOptions {
  limit?: number;
  offset?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: 'rating' | 'price_asc' | 'price_desc' | 'popular';
  providerId?: string;
  tags?: string[];
}

// Search results interface
export interface SearchResults {
  hits: any[];
  estimatedTotalHits: number;
  processingTimeMs: number;
  query: string;
  facetDistribution?: Record<string, Record<string, number>>;
}

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

    // Configure services index
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
        'price.amount',
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
    logger.error('Failed to initialize Meilisearch indexes:', error);
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
      createdAt: new Date(service.createdAt).getTime(),
      updatedAt: new Date(service.updatedAt).getTime(),
    };

    await client.index(INDEXES.SERVICES).addDocuments([document]);
    logger.debug(`Service ${service._id} indexed in Meilisearch`);
  } catch (error) {
    logger.error(`Failed to index service ${service._id}:`, error);
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

/**
 * Search services using Meilisearch
 */
export const searchServices = async (
  query: string,
  options: SearchOptions = {}
): Promise<SearchResults> => {
  const client = await getMeiliClient();

  // Fallback to MongoDB if Meilisearch not available
  if (!client) {
    return fallbackSearch(query, options);
  }

  try {
    const {
      limit = 20,
      offset = 0,
      category,
      minPrice,
      maxPrice,
      minRating,
      sortBy,
      tags,
    } = options;

    // Build filters
    const filters: string[] = ['isActive = true'];
    if (category) filters.push(`category = "${category}"`);
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

    const searchResult = await client.index(INDEXES.SERVICES).search(query, {
      limit,
      offset,
      filter: filters.join(' AND '),
      sort,
      attributesToHighlight: ['name', 'description'],
    });

    return {
      hits: searchResult.hits,
      estimatedTotalHits: searchResult.estimatedTotalHits || 0,
      processingTimeMs: searchResult.processingTimeMs,
      query: searchResult.query,
      facetDistribution: searchResult.facetDistribution,
    };
  } catch (error) {
    logger.error('Meilisearch search failed, using fallback:', error);
    return fallbackSearch(query, options);
  }
};

/**
 * Get search suggestions using Meilisearch
 */
export const getSearchSuggestions = async (
  query: string,
  limit: number = 5
): Promise<string[]> => {
  const client = await getMeiliClient();

  if (!client) {
    return [];
  }

  try {
    const searchResult = await client.index(INDEXES.SERVICES).search(query, {
      limit,
      attributesToRetrieve: ['name', 'category'],
    });

    const suggestions: string[] = searchResult.hits.map(
      (hit: any) => hit.name as string
    );
    return [...new Set<string>(suggestions)];
  } catch (error) {
    logger.error('Failed to get search suggestions:', error);
    return [];
  }
};

/**
 * Fallback search using MongoDB when Meilisearch is unavailable
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
      minPrice,
      maxPrice,
      minRating,
    } = options;

    const searchQuery: any = {
      isActive: true,
    };

    // Text search if query provided - use escaped regex to prevent ReDoS
    if (query) {
      const escapedQuery = escapeRegex(query);
      searchQuery.$or = [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { description: { $regex: escapedQuery, $options: 'i' } },
        { category: { $regex: escapedQuery, $options: 'i' } },
      ];
    }

    if (category) searchQuery.category = category;
    if (minPrice !== undefined) searchQuery['price.amount'] = { $gte: minPrice };
    if (maxPrice !== undefined) searchQuery['price.amount'] = { ...searchQuery['price.amount'], $lte: maxPrice };
    if (minRating !== undefined) searchQuery['rating.average'] = { $gte: minRating };

    const [services, total] = await Promise.all([
      Service.find(searchQuery)
        .skip(offset)
        .limit(limit)
        .lean(),
      Service.countDocuments(searchQuery),
    ]);

    return {
      hits: services,
      estimatedTotalHits: total,
      processingTimeMs: Date.now() - startTime,
      query,
    };
  } catch (error) {
    logger.error('Fallback search failed:', error);
    return {
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: Date.now() - startTime,
      query,
    };
  }
};

/**
 * Reindex all services
 */
export const reindexAllServices = async (): Promise<void> => {
  const client = await getMeiliClient();
  if (!client) return;

  try {
    // Clear existing index
    await client.index(INDEXES.SERVICES).deleteAllDocuments();

    // Fetch all active services
    const services = await Service.find({ isActive: true }).lean();

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
      createdAt: new Date(service.createdAt).getTime(),
      updatedAt: new Date(service.updatedAt).getTime(),
    }));

    // Batch add documents
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await client.index(INDEXES.SERVICES).addDocuments(batch);
    }

    logger.info(`Reindexed ${documents.length} services in Meilisearch`);
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
  } catch (error) {
    logger.error('Failed to reindex categories:', error);
  }
};

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
  indexProvider,
  indexCategory,
  searchServices,
  getSearchSuggestions,
  reindexAllServices,
  reindexAllProviders,
  reindexAllCategories,
  getSearchStats,
};
