import { api } from './api';

export interface AdminApiKeyRecord {
  _id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  isActive: boolean;
  isExpired?: boolean;
  rateLimit: number;
  createdBy?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
}

export interface ApiKeyStats {
  total: number;
  active: number;
  inactive: number;
  expiringSoon: number;
}

export interface ApiKeyFormPayload {
  name: string;
  description: string;
  permissions: string[];
  expiresAt: string;
  rateLimit: number;
}

export const API_KEY_PERMISSIONS = [
  { value: 'read', label: 'Read', description: 'Read-only integration access' },
  { value: 'write', label: 'Write', description: 'Create and update resources' },
  { value: 'delete', label: 'Delete', description: 'Delete resources' },
  { value: 'analytics', label: 'Analytics', description: 'Access analytics exports' },
  { value: 'webhooks', label: 'Webhooks', description: 'Register and manage webhooks' },
  { value: 'broadcast', label: 'Broadcast', description: 'Send notification broadcasts' },
  { value: 'coupons', label: 'Coupons', description: 'Manage coupon codes' },
  { value: 'admin', label: 'Admin', description: 'Full integration access (use sparingly)' },
] as const;

function toCreatePayload(form: ApiKeyFormPayload) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    permissions: form.permissions,
    rateLimit: form.rateLimit,
    ...(form.expiresAt
      ? { expiresAt: new Date(`${form.expiresAt}T23:59:59.999`).toISOString() }
      : {}),
  };
}

export const adminApiKeyApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: string;
  } = {}) => {
    const response = await api.get('/admin/api-keys', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.search ? { search: params.search } : {}),
        ...(params.isActive ? { isActive: params.isActive } : {}),
      },
    });
    return response.data.data as {
      apiKeys: AdminApiKeyRecord[];
      pagination: { page: number; limit: number; total: number; pages: number };
    };
  },

  stats: async (): Promise<ApiKeyStats> => {
    const response = await api.get('/admin/api-keys/stats');
    return response.data.data.stats;
  },

  create: async (form: ApiKeyFormPayload) => {
    const response = await api.post('/admin/api-keys', toCreatePayload(form));
    return response.data.data as { key: string; id: string; keyPrefix: string };
  },

  update: async (id: string, payload: Partial<ApiKeyFormPayload> & { isActive?: boolean }) => {
    const body: Record<string, unknown> = { ...payload };
    if (payload.expiresAt) {
      body.expiresAt = new Date(`${payload.expiresAt}T23:59:59.999`).toISOString();
    }
    const response = await api.patch(`/admin/api-keys/${id}`, body);
    return response.data;
  },

  toggle: async (id: string) => {
    const response = await api.post(`/admin/api-keys/${id}/toggle`);
    return response.data;
  },

  regenerate: async (id: string) => {
    const response = await api.post(`/admin/api-keys/${id}/regenerate`);
    return response.data.data as { key: string; keyPrefix: string };
  },

  delete: async (id: string) => {
    const response = await api.delete(`/admin/api-keys/${id}`);
    return response.data;
  },

  // Bulk operations
  bulkDelete: async (ids: string[]) => {
    const response = await api.delete('/admin/api-keys/bulk', { data: { ids } });
    return response.data;
  },
};
