import { api } from './api';
import authService from './AuthService';
import type {
  Experience,
  ExperienceSubmission,
  AvailableBooking,
  ExperienceStats,
  ExperienceFilters,
  ExperiencesResponse,
  ExperienceResponse,
  AvailableBookingsResponse,
  CheckExperienceResponse,
  ExperienceStatsResponse,
  BulkActionResponse
} from '../types/experience';

class ExperienceApiService {
  // ==========================================
  // PUBLIC API METHODS
  // ==========================================

  /**
   * Get all approved experiences (public endpoint)
   */
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
    return response.data;
  }

  /**
   * Get featured experiences only
   */
  async getFeaturedExperiences(): Promise<ExperiencesResponse> {
    const response = await api.get('/experiences/featured');
    return response.data;
  }

  /**
   * Get a single experience by ID (public)
   */
  async getExperience(experienceId: string): Promise<ExperienceResponse> {
    const response = await api.get(`/experiences/${experienceId}`);
    return response.data;
  }

  // ==========================================
  // CUSTOMER API METHODS
  // ==========================================

  /**
   * Get experiences created by the current user
   */
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
    return response.data;
  }

  /**
   * Get user's completed bookings that can have experiences submitted
   */
  async getAvailableBookings(): Promise<AvailableBookingsResponse> {
    const response = await api.get('/experiences/available-bookings');
    return response.data;
  }

  /**
   * Check if user has submitted an experience for a specific booking
   */
  async checkExperienceExists(bookingId: string): Promise<CheckExperienceResponse> {
    try {
      const response = await api.get(`/experiences/check/${bookingId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking experience existence:', error);
      return { success: true, data: { exists: false } };
    }
  }

  /**
   * Submit a new experience
   */
  async submitExperience(data: ExperienceSubmission): Promise<ExperienceResponse> {
    const formData = this.buildFormData(data);

    const response = await api.post('/experiences', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Update an existing experience
   */
  async updateExperience(
    experienceId: string,
    updates: Partial<ExperienceSubmission>
  ): Promise<ExperienceResponse> {
    const formData = this.buildFormData(updates as ExperienceSubmission);

    const response = await api.put(`/experiences/${experienceId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Delete an experience
   */
  async deleteExperience(experienceId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/experiences/${experienceId}`);
    return response.data;
  }

  // ==========================================
  // ADMIN API METHODS
  // ==========================================

  /**
   * Get all experiences for admin management
   */
  async getAllExperiences(filters?: ExperienceFilters): Promise<ExperiencesResponse> {
    const params = this.buildFilterParams(filters);
    const queryString = params.toString();
    const url = queryString ? `/admin/experiences?${queryString}` : '/admin/experiences';

    const response = await authService.get<ExperiencesResponse>(url);
    return response;
  }

  /**
   * Get experience statistics for admin dashboard
   */
  async getStats(): Promise<ExperienceStatsResponse> {
    try {
      const response = await authService.get<ExperienceStatsResponse>('/admin/experiences/stats');
      return response;
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
            featuredCount: 0
          }
        }
      };
    }
  }

  /**
   * Get single experience details for admin
   */
  async getExperienceAdmin(experienceId: string): Promise<ExperienceResponse> {
    const response = await authService.get<ExperienceResponse>(`/admin/experiences/${experienceId}`);
    return response;
  }

  /**
   * Approve an experience
   */
  async approveExperience(experienceId: string, notes?: string): Promise<ExperienceResponse> {
    const response = await authService.post<ExperienceResponse>(
      `/admin/experiences/${experienceId}/approve`,
      { notes }
    );
    return response;
  }

  /**
   * Reject an experience
   */
  async rejectExperience(experienceId: string, notes?: string): Promise<ExperienceResponse> {
    const response = await authService.post<ExperienceResponse>(
      `/admin/experiences/${experienceId}/reject`,
      { notes }
    );
    return response;
  }

  /**
   * Toggle featured status
   */
  async toggleFeatured(experienceId: string): Promise<ExperienceResponse> {
    const response = await authService.post<ExperienceResponse>(
      `/admin/experiences/${experienceId}/toggle-featured`,
      {}
    );
    return response;
  }

  /**
   * Bulk approve experiences
   */
  async bulkApprove(experienceIds: string[]): Promise<BulkActionResponse> {
    const response = await authService.post<BulkActionResponse>(
      '/admin/experiences/bulk-approve',
      { experienceIds }
    );
    return response;
  }

  /**
   * Bulk reject experiences
   */
  async bulkReject(experienceIds: string[], notes?: string): Promise<BulkActionResponse> {
    const response = await authService.post<BulkActionResponse>(
      '/admin/experiences/bulk-reject',
      { experienceIds, notes }
    );
    return response;
  }

  /**
   * Delete an experience (admin)
   */
  async deleteExperienceAdmin(experienceId: string): Promise<{ success: boolean; message: string }> {
    const response = await authService.delete<{ success: boolean; message: string }>(
      `/admin/experiences/${experienceId}`
    );
    return response;
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Build FormData from experience submission
   */
  private buildFormData(data: ExperienceSubmission): FormData {
    const formData = new FormData();
    formData.append('bookingId', data.bookingId);
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('rating', data.rating.toString());

    // Append images
    if (data.images && data.images.length > 0) {
      data.images.forEach((image, index) => {
        if (image instanceof File) {
          formData.append('images', image);
        } else if (typeof image === 'string' && image.startsWith('data:')) {
          const file = this.base64ToFile(image, `image-${index}.jpg`);
          formData.append('images', file);
        } else if (typeof image === 'string') {
          // URL string - pass as existing image
          formData.append('existingImages', image);
        }
      });
    }

    if (data.videoUrl) {
      formData.append('videoUrl', data.videoUrl);
    }

    return formData;
  }

  /**
   * Convert base64 string to File object
   */
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

  /**
   * Build query params from filters
   */
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

  /**
   * Validate video URL format
   */
  isValidVideoUrl(url: string): boolean {
    const videoPatterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i,
      /^(https?:\/\/)?(www\.)?vimeo\.com\/.+/i,
    ];
    return videoPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Validate image file
   */
  isValidImageFile(file: File): { valid: boolean; error?: string } {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

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
