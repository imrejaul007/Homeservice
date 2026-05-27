import { api } from './api';

export interface PortfolioImage {
  _id?: string;
  url: string;
  caption?: string;
  beforeAfter?: {
    before: string;
    after: string;
  };
}

export interface ClientTestimonial {
  text: string;
  clientName?: string;
  rating: number;
}

export interface PortfolioItem {
  _id: string;
  title: string;
  description?: string;
  category: string;
  images: PortfolioImage[];
  tags?: string[];
  clientTestimonial?: ClientTestimonial;
  isVisible?: boolean;
  createdAt: string | Date;
}

export interface CreatePortfolioItemData {
  title: string;
  description?: string;
  category?: string;
  images?: PortfolioImage[];
  tags?: string[];
  clientTestimonial?: ClientTestimonial;
  isVisible?: boolean;
}

export interface UpdatePortfolioItemData {
  title?: string;
  description?: string;
  category?: string;
  images?: PortfolioImage[];
  tags?: string[];
  clientTestimonial?: ClientTestimonial;
  isVisible?: boolean;
}

export const portfolioApi = {
  /**
   * Get all portfolio items for the current provider
   */
  getPortfolio: async (): Promise<PortfolioItem[]> => {
    const response = await api.get('/provider/portfolio');
    return response.data?.data || [];
  },

  /**
   * Create a new portfolio item
   */
  createPortfolioItem: async (data: CreatePortfolioItemData): Promise<PortfolioItem> => {
    const response = await api.post('/provider/portfolio', data);
    return response.data?.data;
  },

  /**
   * Update an existing portfolio item
   */
  updatePortfolioItem: async (itemId: string, data: UpdatePortfolioItemData): Promise<PortfolioItem> => {
    const response = await api.put(`/provider/portfolio/${itemId}`, data);
    return response.data?.data;
  },

  /**
   * Delete a portfolio item
   */
  deletePortfolioItem: async (itemId: string): Promise<void> => {
    await api.delete(`/provider/portfolio/${itemId}`);
  },

  /**
   * Upload an image to a portfolio item
   */
  uploadImage: async (itemId: string, file: File): Promise<PortfolioImage[]> => {
    const formData = new FormData();
    formData.append('images', file);

    const response = await api.patch(`/provider/portfolio/${itemId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data?.data || [];
  },

  /**
   * Upload multiple images when creating a new portfolio item
   */
  createWithImages: async (
    data: CreatePortfolioItemData,
    files: File[]
  ): Promise<PortfolioItem> => {
    const formData = new FormData();

    // Append text fields
    if (data.title) formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.category) formData.append('category', data.category);
    if (data.isVisible !== undefined) formData.append('isVisible', String(data.isVisible));
    if (data.tags) formData.append('tags', JSON.stringify(data.tags));
    if (data.clientTestimonial) {
      formData.append('clientTestimonial', JSON.stringify(data.clientTestimonial));
    }

    // Append images
    files.forEach((file) => {
      formData.append('images', file);
    });

    const response = await api.post('/provider/portfolio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data?.data;
  },

  /**
   * Remove an image from a portfolio item
   */
  removeImage: async (itemId: string, imageUrl: string): Promise<PortfolioImage[]> => {
    // URL encode the image URL for the request
    const encodedImageUrl = encodeURIComponent(imageUrl);
    const response = await api.delete(
      `/provider/portfolio/${itemId}/images/${encodedImageUrl}`
    );
    return response.data?.data || [];
  },
};

export default portfolioApi;
