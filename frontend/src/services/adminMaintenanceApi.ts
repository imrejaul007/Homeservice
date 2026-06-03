import { api } from './api';

export interface MaintenanceSettings {
  maintenanceMode: boolean;
  message: string;
  estimatedDuration?: string | null;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string | null;
}

export interface MaintenanceUpdatePayload {
  enabled: boolean;
  message: string;
  estimatedDuration?: string;
}

export const adminMaintenanceApi = {
  get: async (): Promise<MaintenanceSettings> => {
    const response = await api.get('/admin/maintenance');
    return response.data.data;
  },

  update: async (payload: MaintenanceUpdatePayload) => {
    const response = await api.put('/admin/maintenance', payload);
    return response.data;
  },
};

export const DURATION_PRESETS = [
  '15 minutes',
  '30 minutes',
  '1 hour',
  '2 hours',
  '4 hours',
  '8 hours',
  '24 hours',
] as const;
