/**
 * IA Agent API Service
 */
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { useAuthStore } from '../stores/authStore';

const getAuthHeader = () => {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ============================================================================
// Types
// ============================================================================

export enum IAAgentCategory {
  Admin = 'Admin',
  Provider = 'Provider',
  Client = 'Client',
  Partner = 'Partner',
}

export enum IAAgentType {
  Assistant = 'Assistant',
  Recherche = 'Recherche',
  Support = 'Support',
  FAQ = 'FAQ',
}

export enum IAAgentStatus {
  Draft = 'Draft',
  Testing = 'Testing',
  Deployed = 'Deployed',
  Suspended = 'Suspended',
  Archived = 'Archived',
}

export interface IAAgentConfiguration {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  contextWindow?: number;
  streaming?: boolean;
}

export interface KnowledgeBaseEntry {
  id: string;
  title: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAAgent {
  _id: string;
  name: string;
  description: string;
  category: IAAgentCategory;
  type: IAAgentType;
  status: IAAgentStatus;
  configuration: IAAgentConfiguration;
  instructions: string;
  knowledgeBase: KnowledgeBaseEntry[];
  deployedAt?: Date;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAAgentFormData {
  name: string;
  description: string;
  category: IAAgentCategory;
  type: IAAgentType;
  status?: IAAgentStatus;
  configuration?: IAAgentConfiguration;
  instructions: string;
  knowledgeBase?: KnowledgeBaseEntry[];
}

export interface IAAgentStats {
  total: number;
  deployed: number;
  testing: number;
  draft: number;
  suspended: number;
  archived: number;
  byCategory: Array<{ category: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
}

// ============================================================================
// API Functions
// ============================================================================

export interface ListAgentsParams {
  category?: IAAgentCategory;
  type?: IAAgentType;
  status?: IAAgentStatus;
  isActive?: boolean;
}

export const iaAgentApi = {
  /**
   * Get agent statistics
   */
  getStats: async (): Promise<IAAgentStats> => {
    const response = await axios.get(`${API_BASE_URL}/ia-agents/stats`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get all agents with optional filtering
   */
  list: async (params?: ListAgentsParams): Promise<{ agents: IAAgent[]; total: number }> => {
    const response = await axios.get(`${API_BASE_URL}/ia-agents`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data.data;
  },

  /**
   * Get agents by category
   */
  getByCategory: async (category: IAAgentCategory): Promise<{ agents: IAAgent[]; category: string; total: number }> => {
    const response = await axios.get(`${API_BASE_URL}/ia-agents/category/${category}`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get single agent by ID
   */
  getById: async (id: string): Promise<IAAgent> => {
    const response = await axios.get(`${API_BASE_URL}/ia-agents/${id}`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Create new agent
   */
  create: async (data: IAAgentFormData): Promise<IAAgent> => {
    const response = await axios.post(`${API_BASE_URL}/ia-agents`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Update agent
   */
  update: async (id: string, data: Partial<IAAgentFormData>): Promise<IAAgent> => {
    const response = await axios.put(`${API_BASE_URL}/ia-agents/${id}`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Deploy agent
   */
  deploy: async (id: string): Promise<IAAgent> => {
    const response = await axios.post(`${API_BASE_URL}/ia-agents/${id}/deploy`, {}, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Suspend agent
   */
  suspend: async (id: string): Promise<IAAgent> => {
    const response = await axios.post(`${API_BASE_URL}/ia-agents/${id}/suspend`, {}, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Archive (soft delete) agent
   */
  archive: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/ia-agents/${id}`, {
      headers: getAuthHeader(),
    });
  },
};

export default iaAgentApi;
