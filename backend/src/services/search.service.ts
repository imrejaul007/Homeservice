import Service from '../models/service.model';
import logger from '../utils/logger';

// Check if MeiliSearch is configured
export const isMeiliSearchConfigured = (): boolean => {
  return !!(process.env.MEILISEARCH_HOST && process.env.MEILISEARCH_API_KEY);
};

// Initialize indexes
export const initializeIndexes = async (): Promise<void> => {
  logger.info('MeiliSearch initialization skipped - using MongoDB fallback');
};

// Index a service
export const indexService = async (service: any): Promise<void> => {
  if (!isMeiliSearchConfigured()) return;
  logger.debug(`Service would be indexed: ${service._id}`);
};

// Index multiple services (bulk)
export const indexServices = async (services: any[]): Promise<void> => {
  if (!isMeiliSearchConfigured()) return;
  logger.info(`Would bulk index ${services.length} services`);
};

// Delete a service from index
export const deleteService = async (serviceId: string): Promise<void> => {
  if (!isMeiliSearchConfigured()) return;
  logger.debug(`Service would be deleted from index: ${serviceId}`);
};

// Search services
export const searchServices = async (query: string, options?: {
  limit?: number;
  offset?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: 'rating' | 'price_asc' | 'price_desc' | 'popular';
}): Promise<{ hits: any[]; estimatedTotalHits: number; processingTimeMs: number; query: string }> => {
  return fallbackServiceSearch(query, options);
};

// MongoDB search fallback
const fallbackServiceSearch = async (query: string, options?: any) => {
  try {
    const searchRegex = new RegExp(query, 'i');
    const match: any = {
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
      ],
      isActive: true,
    };

    if (options?.category) {
      match.category = options.category;
    }

    let sort: any = { createdAt: -1 };
    if (options?.sortBy === 'rating') sort = { 'rating.average': -1 };
    else if (options?.sortBy === 'price_asc') sort = { 'pricing.basePrice': 1 };
    else if (options?.sortBy === 'price_desc') sort = { 'pricing.basePrice': -1 };
    else if (options?.sortBy === 'popular') sort = { totalBookings: -1 };

    const services = await Service.find(match)
      .sort(sort)
      .limit(options?.limit || 20)
      .skip(options?.offset || 0)
      .populate('category', 'name')
      .populate('providerId', 'firstName lastName');

    const total = await Service.countDocuments(match);

    return {
      hits: services.map(s => ({ ...s.toObject(), id: s._id.toString() })),
      estimatedTotalHits: total,
      processingTimeMs: 0,
      query,
    };
  } catch (error) {
    logger.error('Search failed', { error, query });
    return { hits: [], estimatedTotalHits: 0, processingTimeMs: 0, query };
  }
};

// Reindex all services
export const reindexAllServices = async (): Promise<void> => {
  if (!isMeiliSearchConfigured()) {
    logger.warn('Cannot reindex - MeiliSearch not configured');
    return;
  }
  logger.info('Would reindex all services');
};

// Get search statistics
export const getSearchStats = async (): Promise<{
  isConfigured: boolean;
  servicesCount?: number;
}> => {
  if (!isMeiliSearchConfigured()) {
    const count = await Service.countDocuments({ isActive: true });
    return { isConfigured: false, servicesCount: count };
  }
  return { isConfigured: true, servicesCount: 0 };
};

export const INDEX_NAMES = {
  SERVICES: 'services',
  PROVIDERS: 'providers',
  CATEGORIES: 'categories',
};

export default {
  INDEX_NAMES,
  isMeiliSearchConfigured,
  initializeIndexes,
  indexService,
  indexServices,
  deleteService,
  searchServices,
  reindexAllServices,
  getSearchStats,
};
