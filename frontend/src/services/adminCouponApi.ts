import { api } from './api';

export interface AdminCoupon {
  _id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
  maxUses: number;
  currentUses: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  title: string;
  description?: string;
  featured?: boolean;
  createdAt: string;
}

export interface CouponFormPayload {
  code: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number;
  maxDiscount: number;
  minOrderAmount: number;
  usageLimit: number;
  validFrom: string;
  validUntil: string;
  title: string;
  description: string;
  featured: boolean;
  isActive?: boolean;
}

export interface CouponStats {
  total: number;
  active: number;
  inactive: number;
  totalUses: number;
  byType: { percentage: number; fixed: number; free_service: number };
  featured: number;
}

export interface CouponListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  isActive?: string;
  status?: 'live' | 'expired' | 'scheduled' | '';
}

function toApiPayload(form: CouponFormPayload) {
  return {
    ...form,
    code: form.code.trim().toUpperCase(),
    validFrom: new Date(`${form.validFrom}T00:00:00`).toISOString(),
    validUntil: new Date(`${form.validUntil}T23:59:59.999`).toISOString(),
    maxDiscount: form.maxDiscount || undefined,
  };
}

export const adminCouponApi = {
  list: async (params: CouponListParams = {}) => {
    const response = await api.get('/admin/coupons', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.search ? { search: params.search } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.isActive ? { isActive: params.isActive } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
    });
    return response.data.data as {
      coupons: AdminCoupon[];
      pagination: { page: number; limit: number; total: number; pages: number };
    };
  },

  stats: async (): Promise<CouponStats> => {
    const response = await api.get('/admin/coupons/stats');
    return response.data.data.stats;
  },

  create: async (form: CouponFormPayload) => {
    const response = await api.post('/admin/coupons', toApiPayload(form));
    return response.data;
  },

  update: async (id: string, form: Partial<CouponFormPayload>) => {
    const payload = { ...form };
    if (form.validFrom) {
      payload.validFrom = new Date(`${form.validFrom}T00:00:00`).toISOString() as unknown as string;
    }
    if (form.validUntil) {
      payload.validUntil = new Date(`${form.validUntil}T23:59:59.999`).toISOString() as unknown as string;
    }
    if (form.code) payload.code = form.code.trim().toUpperCase();
    const response = await api.put(`/admin/coupons/${id}`, payload);
    return response.data;
  },

  deactivate: async (id: string) => {
    const response = await api.post(`/admin/coupons/${id}/deactivate`);
    return response.data;
  },

  setActive: async (id: string, isActive: boolean) => {
    const response = await api.put(`/admin/coupons/${id}`, { isActive });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/admin/coupons/${id}`);
    return response.data;
  },
};
