// Meilisearch configuration using REST API
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

// Index names
export const INDEXES = {
  SERVICES: 'services',
  PROVIDERS: 'providers',
  CATEGORIES: 'categories',
} as const;

// Index configuration types
export interface ServiceDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  pricing: {
    basePrice: number;
    currency: string;
  };
  rating: {
    average: number;
    count: number;
  };
  provider: {
    id: string;
    name: string;
    trustScore: number;
  };
  totalBookings: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderDocument {
  id: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  trustScore: number;
  rating: {
    average: number;
    count: number;
  };
  totalServices: number;
  totalBookings: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: number;
}

export interface CategoryDocument {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  icon?: string;
  serviceCount: number;
  isActive: boolean;
}

// MeiliSearch REST API client interface
interface MeiliSearchClient {
  health: () => Promise<{ status: string }>;
  getIndex: (name: string) => Promise<any>;
  createIndex: (name: string, options?: any) => Promise<any>;
  index: (name: string) => any;
  getStats: () => Promise<any>;
}

// REST API wrapper that implements the MeiliSearchClient interface
class MeiliSearchRestClient implements MeiliSearchClient {
  private client: AxiosInstance;
  private host: string;

  constructor(host: string, apiKey: string) {
    this.host = host.replace(/\/$/, '');
    this.client = axios.create({
      baseURL: this.host,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async health(): Promise<{ status: string }> {
    const response = await this.client.get('/health');
    return { status: response.data.status };
  }

  async getIndex(name: string): Promise<any> {
    try {
      const response = await this.client.get(`/indexes/${name}`);
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  index(name: string): any {
    return new MeiliSearchIndex(this.client, this.host, name);
  }

  async getStats(): Promise<any> {
    const response = await this.client.get('/stats');
    return response.data;
  }

  async waitForTask(taskUid: number, timeoutMs: number = 30000): Promise<any> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const response = await this.client.get(`/tasks/${taskUid}`);
      const task = response.data;
      if (task.status === 'succeeded') return task;
      if (task.status === 'failed') throw new Error(`Task ${taskUid} failed: ${task.error?.message}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Task ${taskUid} timed out after ${timeoutMs}ms`);
  }

  async createIndex(name: string, options?: { primaryKey?: string }): Promise<any> {
    try {
      const response = await this.client.post('/indexes', {
        uid: name,
        primaryKey: options?.primaryKey,
      });
      const taskUid = response.data.taskUid;
      if (taskUid) {
        await this.waitForTask(taskUid);
      }
      return response.data;
    } catch (error: any) {
      // If index already exists, ignore the error
      if (error?.response?.status === 409) {
        return { uid: name, status: 'exists' };
      }
      throw error;
    }
  }
}

// Wrapper for index operations
class MeiliSearchIndex {
  private client: AxiosInstance;
  private host: string;
  private indexName: string;

  constructor(client: AxiosInstance, host: string, indexName: string) {
    this.client = client;
    this.host = host;
    this.indexName = indexName;
  }

  async addDocuments(documents: any[]): Promise<any> {
    const response = await this.client.post(`/indexes/${this.indexName}/documents`, documents);
    const taskUid = response.data?.taskUid;
    if (taskUid) {
      await this.waitForTask(taskUid);
    }
    return response.data;
  }

  async deleteDocument(documentId: string): Promise<any> {
    const response = await this.client.delete(`/indexes/${this.indexName}/documents/${documentId}`);
    return response.data;
  }

  async deleteAllDocuments(): Promise<any> {
    const response = await this.client.delete(`/indexes/${this.indexName}/documents`);
    const taskUid = response.data?.taskUid;
    if (taskUid) {
      await this.waitForTask(taskUid);
    }
    return response.data;
  }

  async search(query: string, options?: any): Promise<any> {
    const response = await this.client.post(`/indexes/${this.indexName}/search`, {
      q: query,
      ...options,
    });
    return response.data;
  }

  async updateSettings(settings: any): Promise<any> {
    // Use PATCH for Meilisearch Cloud (PUT returns 405)
    const response = await this.client.patch(`/indexes/${this.indexName}/settings`, settings);
    const taskUid = response.data?.taskUid;
    if (taskUid) {
      // Wait for the settings update task to complete
      await this.waitForTask(taskUid);
    }
    return response.data;
  }

  async waitForTask(taskUid: number, timeoutMs: number = 30000): Promise<any> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const response = await this.client.get(`/tasks/${taskUid}`);
      const task = response.data;
      if (task.status === 'succeeded') return task;
      if (task.status === 'failed') throw new Error(`Task ${taskUid} failed: ${task.error?.message}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Task ${taskUid} timed out after ${timeoutMs}ms`);
  }

  async getStats(): Promise<any> {
    const response = await this.client.get(`/indexes/${this.indexName}/stats`);
    return response.data;
  }
}

// Lazy client instance
let _meiliClient: MeiliSearchClient | null = null;

// Check if Meilisearch is configured
export const isMeiliSearchConfigured = (): boolean => {
  const host = process.env.MEILISEARCH_HOST;
  const apiKey = process.env.MEILISEARCH_API_KEY;
  return !!(host && apiKey);
};

// Get or create MeiliSearch client using REST API
export const getMeiliClient = async (): Promise<MeiliSearchClient | null> => {
  // Return null if not configured
  if (!isMeiliSearchConfigured()) {
    return null;
  }

  // Return cached client if already initialized
  if (_meiliClient) {
    return _meiliClient;
  }

  try {
    const host = process.env.MEILISEARCH_HOST!;
    const apiKey = process.env.MEILISEARCH_API_KEY!;

    _meiliClient = new MeiliSearchRestClient(host, apiKey);

    // Verify connection by checking health
    const health = await (_meiliClient as MeiliSearchRestClient).health();
    if (health.status !== 'available') {
      throw new Error(`Meilisearch health check failed: ${health.status}`);
    }

    logger.info('Meilisearch client initialized successfully');
    return _meiliClient;
  } catch (error: any) {
    logger.error('Failed to initialize Meilisearch client:', { message: error?.message, code: error?.code });
    _meiliClient = null;
    return null;
  }
};

// Check Meilisearch health
export const checkMeiliSearchHealth = async (): Promise<boolean> => {
  const client = await getMeiliClient();
  if (!client) return false;

  try {
    const health = await client.health();
    return health.status === 'available';
  } catch (error: any) {
    logger.error('Meilisearch health check failed', { message: error?.message });
    return false;
  }
};

// Get index statistics
export const getIndexStats = async (): Promise<{
  services?: { totalDocuments: number; isIndexing: boolean };
  providers?: { totalDocuments: number; isIndexing: boolean };
  categories?: { totalDocuments: number; isIndexing: boolean };
}> => {
  const client = await getMeiliClient();
  if (!client) return {};

  try {
    const [services, providers, categories] = await Promise.all([
      client.index(INDEXES.SERVICES).getStats(),
      client.index(INDEXES.PROVIDERS).getStats(),
      client.index(INDEXES.CATEGORIES).getStats(),
    ]);

    return {
      services: {
        totalDocuments: services.numberOfDocuments,
        isIndexing: services.isIndexing,
      },
      providers: {
        totalDocuments: providers.numberOfDocuments,
        isIndexing: providers.isIndexing,
      },
      categories: {
        totalDocuments: categories.numberOfDocuments,
        isIndexing: categories.isIndexing,
      },
    };
  } catch (error: any) {
    logger.error('Failed to get Meilisearch index stats', { message: error?.message });
    return {};
  }
};

export default {
  getMeiliClient,
  INDEXES,
  isMeiliSearchConfigured,
  checkMeiliSearchHealth,
  getIndexStats,
};
