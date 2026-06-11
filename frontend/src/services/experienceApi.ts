import { api } from './api';
import authService from './AuthService';
import type {
  ExperienceSubmission,
  ExperienceStats,
  ExperienceFilters,
  ExperiencesResponse,
  ExperienceResponse,
  CheckExperienceResponse,
  ExperienceStatsResponse,
  BulkActionResponse
} from '../types/experience';

/** Normalize backend pagination into frontend shape */
function normalizeExperiencesResponse(data: Record<string, unknown>): ExperiencesResponse['data'] {
  const pagination = data.pagination as Record<string, number> | undefined;
  const stats = data.stats as Record<string, number> | undefined;

  return {
    experiences: (data.experiences as ExperiencesResponse['data']['experiences']) || [],
    total: pagination?.total ?? (data.total as number) ?? 0,
    page: pagination?.page ?? (data.page as number) ?? 1,
    pages: pagination?.pages ?? (data.pages as number) ?? 1,
    stats: stats
      ? {
          total: stats.total ?? 0,
          pending: stats.pending ?? 0,
          approved: stats.approved ?? 0,
          rejected: stats.rejected ?? 0,
          averageRating: stats.averageRating ?? stats.avgRating ?? 0,
          featuredCount: stats.featuredCount ?? stats.featured ?? 0,
        }
      : undefined,
  };
}

function normalizeStatsResponse(data: Record<string, unknown>): ExperienceStats {
  const raw = (data.stats ?? data) as Record<string, number>;
  return {
    total: raw.total ?? 0,
    pending: raw.pending ?? 0,
    approved: raw.approved ?? 0,
    rejected: raw.rejected ?? 0,
    averageRating: raw.averageRating ?? raw.avgRating ?? 0,
    featuredCount: raw.featuredCount ?? raw.featured ?? 0,
  };
}

class ExperienceApiService {
  async getExperiences(options?: {
    page?: number;
    limit?: number;
    search?: string;
    minRating?: number;
    serviceId?: string;
    providerId?: string;
  }): Promise<ExperiencesResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    if (options?.minRating) params.append('minRating', options.minRating.toString());
    if (options?.serviceId) params.append('serviceId', options.serviceId);
    if (options?.providerId) params.append('providerId', options.providerId);

    const queryString = params.toString();
    const url = queryString ? `/experiences?${queryString}` : '/experiences';

    const response = await api.get(url);
    const body = response.data;
    return {
      success: body.success,
      data: normalizeExperiencesResponse(body.data),
    };
  }

  async getFeaturedExperiences(): Promise<ExperiencesResponse> {
    const response = await api.get('/experiences/featured');
    const body = response.data;
    return {
      success: body.success,
      data: normalizeExperiencesResponse(body.data),
    };
  }

  async getExperience(experienceId: string): Promise<ExperienceResponse> {
    const response = await api.get(`/experiences/${experienceId}`);
    return response.data;
  }

  async getMyExperiences(options?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ExperiencesResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);

    const queryString = params.toString();
    const url = queryString ? `/experiences/my?${queryString}` : '/experiences/my';

    const response = await api.get(url);
    const body = response.data;
    return {
      success: body.success,
      data: normalizeExperiencesResponse(body.data),
    };
  }

  async getAvailableBookings() {
    const response = await api.get('/experiences/available-bookings');
    return response.data;
  }

  async checkExperienceExists(bookingId: string): Promise<CheckExperienceResponse> {
    try {
      const response = await api.get(`/experiences/check/${bookingId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking experience existence:', error);
      return { success: true, data: { exists: false } };
    }
  }

  async submitExperience(data: ExperienceSubmission): Promise<ExperienceResponse> {
    const formData = this.buildFormData(data);
    const response = await api.post('/experiences', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async updateExperience(
    experienceId: string,
    updates: Partial<ExperienceSubmission>
  ): Promise<ExperienceResponse> {
    const formData = this.buildFormData(updates as ExperienceSubmission, true);
    const response = await api.put(`/experiences/${experienceId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteExperience(experienceId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/experiences/${experienceId}`);
    return response.data;
  }

  async getAllExperiences(filters?: ExperienceFilters): Promise<ExperiencesResponse> {
    const params = this.buildFilterParams(filters);
    const queryString = params.toString();
    const url = queryString ? `/admin/experiences?${queryString}` : '/admin/experiences';

    const response = await authService.get<{ success: boolean; data: Record<string, unknown> }>(url);
    return {
      success: response.success,
      data: normalizeExperiencesResponse(response.data),
    };
  }

  async getStats(): Promise<ExperienceStatsResponse> {
    try {
      const response = await authService.get<{ success: boolean; data: Record<string, unknown> }>(
        '/admin/experiences/stats'
      );
      return {
        success: response.success,
        data: { stats: normalizeStatsResponse(response.data) },
      };
    } catch (error) {
      console.error('Error fetching experience stats:', error);
      return {
        success: true,
        data: {
          stats: {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            averageRating: 0,
            featuredCount: 0,
          },
        },
      };
    }
  }

  async getExperienceAdmin(experienceId: string): Promise<ExperienceResponse> {
    const response = await authService.get<ExperienceResponse>(`/admin/experiences/${experienceId}`);
    return response;
  }

  async approveExperience(experienceId: string, notes?: string): Promise<ExperienceResponse> {
    return authService.post<ExperienceResponse>(
      `/admin/experiences/${experienceId}/approve`,
      { notes }
    );
  }

  async rejectExperience(experienceId: string, reason: string, notes?: string): Promise<ExperienceResponse> {
    return authService.post<ExperienceResponse>(
      `/admin/experiences/${experienceId}/reject`,
      { reason, notes }
    );
  }

  async toggleFeatured(experienceId: string): Promise<ExperienceResponse> {
    return authService.patch<ExperienceResponse>(
      `/admin/experiences/${experienceId}/featured`,
      {}
    );
  }

  async bulkApprove(experienceIds: string[]): Promise<BulkActionResponse> {
    return authService.post<BulkActionResponse>('/admin/experiences/batch-action', {
      experienceIds,
      action: 'approve',
    });
  }

  async bulkReject(experienceIds: string[], reason: string): Promise<BulkActionResponse> {
    return authService.post<BulkActionResponse>('/admin/experiences/batch-action', {
      experienceIds,
      action: 'reject',
      reason,
    });
  }

  async deleteExperienceAdmin(experienceId: string): Promise<{ success: boolean; message: string }> {
    return authService.delete<{ success: boolean; message: string }>(
      `/admin/experiences/${experienceId}`
    );
  }

  private buildFormData(data: ExperienceSubmission, isUpdate = false): FormData {
    const formData = new FormData();

    if (data.bookingId) {
      formData.append('bookingId', data.bookingId);
    }

    if (data.title !== undefined) formData.append('title', data.title);
    if (data.description !== undefined) formData.append('description', data.description);
    if (data.rating !== undefined) formData.append('rating', data.rating.toString());

    if (data.images && data.images.length > 0) {
      data.images.forEach((image, index) => {
        if (image instanceof File) {
          formData.append('images', image);
        } else if (typeof image === 'string' && image.startsWith('data:')) {
          formData.append('images', this.base64ToFile(image, `image-${index}.jpg`));
        } else if (typeof image === 'string') {
          formData.append('existingImages', image);
        }
      });
    }

    if (data.videoUrl) {
      formData.append('videoUrl', data.videoUrl);
    }

    if (isUpdate && !data.bookingId) {
      // no-op: bookingId not required on update
    }

    return formData;
  }

  private base64ToFile(base64: string, filename: string): File {
    const base64Data = base64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    return new File([blob], filename, { type: 'image/jpeg' });
  }

  private buildFilterParams(filters?: ExperienceFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    return params;
  }

  isValidVideoUrl(url: string): boolean {
    const videoPatterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i,
      /^(https?:\/\/)?(www\.)?vimeo\.com\/.+/i,
    ];
    return videoPatterns.some((pattern) => pattern.test(url));
  }

  isValidImageFile(file: File): { valid: boolean; error?: string } {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Please upload JPEG, PNG, GIF, or WebP images.' };
    }
    if (file.size > maxSize) {
      return { valid: false, error: 'File too large. Maximum size is 10MB.' };
    }
    return { valid: true };
  }
}

export const experienceApi = new ExperienceApiService();
export default experienceApi;
