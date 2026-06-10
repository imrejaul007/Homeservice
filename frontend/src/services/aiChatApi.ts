/**
 * AI Chat API Service - Connects to IA Agents backend
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

export interface ChatContext {
  currentPage?: string;
  bookingId?: string;
  serviceId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentId?: string;
  agentName?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  messages: ChatMessage[];
  agentId?: string;
  agentCategory?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  _id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  version?: number;
}

export interface ChatRequest {
  message: string;
  context?: ChatContext;
  conversationId?: string;
  agentId?: string;
  category?: string;
}

export interface ChatResponse {
  message: string;
  response: string; // Backward compatibility
  conversationId: string;
  messages: ChatMessage[];
  agentId?: string;
  agentName?: string;
}

// ============================================================================
// API Functions
// ============================================================================

export const aiChatApi = {
  /**
   * Send a chat message to AI assistant
   * POST /api/ai/chat
   */
  sendMessage: async (data: ChatRequest): Promise<ChatResponse> => {
    const response = await axios.post(`${API_BASE_URL}/ai/chat`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get all conversations for current user
   * GET /api/ai/conversations
   */
  getConversations: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    conversations: Conversation[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  }> => {
    const response = await axios.get(`${API_BASE_URL}/ai/conversations`, {
      headers: getAuthHeader(),
      params,
    });
    return response.data.data;
  },

  /**
   * Get a single conversation
   * GET /api/ai/conversations/:id
   */
  getConversation: async (conversationId: string): Promise<Conversation> => {
    const response = await axios.get(`${API_BASE_URL}/ai/conversations/${conversationId}`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Delete a conversation
   * DELETE /api/ai/conversations/:id
   */
  deleteConversation: async (conversationId: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/ai/conversations/${conversationId}`, {
      headers: getAuthHeader(),
    });
  },

  /**
   * Get available agents for chat
   * GET /api/ai/agents/available
   */
  getAvailableAgents: async (category?: string): Promise<{ agents: Agent[] }> => {
    const response = await axios.get(`${API_BASE_URL}/ai/agents/available`, {
      headers: getAuthHeader(),
      params: category ? { category } : {},
    });
    return response.data.data;
  },
};

export default aiChatApi;