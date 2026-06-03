import authService from './AuthService';
import {
  buildSettingsPatch,
  mergePlatformSettings,
  type PlatformSettings,
} from '../types/platformSettings';

export interface SettingsExportPayload {
  exportedAt: string;
  version: string;
  settings: PlatformSettings;
}

export interface SettingsHistoryEntry {
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  changedBy?: string;
  changedAt?: string;
  reason?: string;
  updatedBy?: string;
  updatedAt?: string;
  changes?: string[];
}

let settingsGetInFlight: Promise<PlatformSettings> | null = null;

export const adminSettingsApi = {
  async get(): Promise<PlatformSettings> {
    if (settingsGetInFlight) {
      return settingsGetInFlight;
    }

    settingsGetInFlight = (async () => {
      const response = await authService.get<{
        success: boolean;
        data: { settings: Partial<PlatformSettings> };
      }>('/settings');
      if (!response.success || !response.data?.settings) {
        throw new Error('Failed to load platform settings');
      }
      return mergePlatformSettings(response.data.settings);
    })();

    try {
      return await settingsGetInFlight;
    } finally {
      settingsGetInFlight = null;
    }
  },

  async patch(changes: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const response = await authService.patch<{
      success: boolean;
      data: { settings: Partial<PlatformSettings> };
    }>('/settings', changes);
    if (!response.success || !response.data?.settings) {
      throw new Error('Failed to save platform settings');
    }
    return mergePlatformSettings(response.data.settings);
  },

  async saveDiff(current: PlatformSettings, original: PlatformSettings): Promise<PlatformSettings> {
    const changes = buildSettingsPatch(current, original);
    if (Object.keys(changes).length === 0) {
      return current;
    }
    return this.patch(changes);
  },

  async reset(): Promise<PlatformSettings> {
    const response = await authService.post<{
      success: boolean;
      data: { settings: Partial<PlatformSettings> };
    }>('/settings/reset');
    if (!response.success || !response.data?.settings) {
      throw new Error('Failed to reset platform settings');
    }
    return mergePlatformSettings(response.data.settings);
  },

  async export(): Promise<SettingsExportPayload> {
    const response = await authService.get<{
      success: boolean;
      data: SettingsExportPayload;
    }>('/settings/export');
    if (response.success && response.data?.settings) {
      return response.data;
    }
    throw new Error('Failed to export platform settings');
  },

  async import(filePayload: unknown): Promise<PlatformSettings> {
    const importBody =
      filePayload !== null &&
      typeof filePayload === 'object' &&
      'settings' in (filePayload as object)
        ? filePayload
        : { settings: filePayload, exportedAt: new Date().toISOString(), version: '1.0' };

    const response = await authService.post<{
      success: boolean;
      data: { settings: Partial<PlatformSettings> };
    }>('/settings/import', importBody);

    if (!response.success || !response.data?.settings) {
      throw new Error('Failed to import platform settings');
    }
    return mergePlatformSettings(response.data.settings);
  },

  async testEmail(testEmail: string): Promise<void> {
    const response = await authService.post<{ success: boolean; message?: string }>(
      '/settings/test-email',
      { testEmail }
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to send test email');
    }
  },

  async uploadLogo(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await authService.uploadFile<{
      success: boolean;
      data: { logoUrl: string };
    }>('/settings/upload-logo', formData);
    if (!response.success || !response.data?.logoUrl) {
      throw new Error('Failed to upload logo');
    }
    return response.data.logoUrl;
  },

  async deleteLogo(): Promise<PlatformSettings> {
    const response = await authService.delete<{
      success: boolean;
      data: { settings: Partial<PlatformSettings> };
    }>('/settings/logo');
    if (!response.success || !response.data?.settings) {
      throw new Error('Failed to delete logo');
    }
    return mergePlatformSettings(response.data.settings);
  },

  async getHistory(limit = 20): Promise<SettingsHistoryEntry[]> {
    const response = await authService.get<{
      success: boolean;
      data: { history: SettingsHistoryEntry[] };
    }>(`/settings/history?limit=${limit}`);
    if (!response.success) {
      throw new Error('Failed to load settings history');
    }
    return response.data?.history ?? [];
  },
};
