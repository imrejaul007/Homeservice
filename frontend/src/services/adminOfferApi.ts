import { api } from './api';

export interface AdminOffer {
  _id: string;
  title: string;
  description?: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
  displayTitle?: string;
  displaySubtitle?: string;
  displayGradient?: string;
  displayBadge?: string;
  imageUrl?: string;
  featured?: boolean;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  maxUsesPerUser?: number;
  currentUses: number;
  applicableServices: string[];
  applicableCategories: string[];
}

export interface OfferFormPayload {
  title: string;
  displayTitle?: string;
  displaySubtitle?: string;
  description?: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
  maxUses: number;
  maxUsesPerUser?: number;
  validFrom: string;
  validUntil: string;
  displayBadge?: string;
  displayGradient?: string;
  featured?: boolean;
  isActive?: boolean;
  applicableServices?: string[];
  applicableCategories?: string[];
}

function normalizeOffer(raw: Record<string, unknown>): AdminOffer {
  const targetServices = (raw.targetServices as unknown[]) || [];
  const targetCategories = (raw.targetCategories as unknown[]) || [];
  const applicableServices =
    (raw.applicableServices as string[]) ||
    targetServices.map((id) => String(id));
  const applicableCategories =
    (raw.applicableCategories as string[]) ||
    targetCategories.map((id) => String(id));

  return {
    ...(raw as unknown as AdminOffer),
    applicableServices,
    applicableCategories,
  };
}

function toApiPayload(form: OfferFormPayload) {
  return {
    ...form,
    code: form.code.trim().toUpperCase(),
    validFrom: new Date(`${form.validFrom}T00:00:00`).toISOString(),
    validUntil: new Date(`${form.validUntil}T23:59:59.999`).toISOString(),
    applicableServices: form.applicableServices || [],
    applicableCategories: form.applicableCategories || [],
    maxUsesPerUser: form.maxUsesPerUser ?? 1,
    maxDiscount: form.maxDiscount || undefined,
  };
}

export const adminOfferApi = {
  list: async (): Promise<AdminOffer[]> => {
    const response = await api.get('/offers/admin/all');
    const rows = response.data.data || [];
    return rows.map((r: Record<string, unknown>) => normalizeOffer(r));
  },

  create: async (form: OfferFormPayload) => {
    const response = await api.post('/offers/admin', toApiPayload(form));
    return response.data;
  },

  update: async (id: string, form: Partial<OfferFormPayload>) => {
    const payload =
      form.validFrom && form.validUntil
        ? {
            ...form,
            ...(form.validFrom
              ? { validFrom: new Date(`${form.validFrom}T00:00:00`).toISOString() }
              : {}),
            ...(form.validUntil
              ? { validUntil: new Date(`${form.validUntil}T23:59:59.999`).toISOString() }
              : {}),
            ...(form.code ? { code: form.code.trim().toUpperCase() } : {}),
          }
        : form;
    const response = await api.put(`/offers/admin/${id}`, payload);
    return response.data;
  },

  setActive: async (id: string, isActive: boolean) => {
    const response = await api.put(`/offers/admin/${id}`, { isActive });
    return response.data;
  },

  deactivate: async (id: string) => {
    const response = await api.delete(`/offers/admin/${id}`);
    return response.data;
  },

  loadServiceOptions: async (): Promise<Array<{ _id: string; name: string; category?: { name: string } }>> => {
    const response = await api.get('/admin/services', { params: { limit: 100, page: 1 } });
    const data = response.data.data;
    return data?.services || data || [];
  },

  loadCategoryOptions: async (): Promise<Array<{ _id: string; name: string }>> => {
    const response = await api.get('/admin/categories', { params: { limit: 200, page: 1 } });
    return response.data.data?.categories || [];
  },
};
