export interface Experience {
  _id: string;
  userId: { _id: string; firstName: string; lastName: string; avatar?: string };
  bookingId?: string;
  serviceId?: { _id: string; name: string };
  providerId?: { _id: string; firstName: string; lastName: string };
  images: string[];
  videoUrl?: string;
  title: string;
  description: string;
  rating: number;
  status: 'pending' | 'approved' | 'rejected';
  isFeatured: boolean;
  isVisible: boolean;
  adminNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceSubmission {
  bookingId?: string;
  title: string;
  description: string;
  rating: number;
  images: (string | File)[];
  videoUrl?: string;
}

export interface AvailableBooking {
  _id: string;
  bookingNumber: string;
  service: { _id: string; name: string };
  provider: { _id: string; firstName: string; lastName: string };
  completedAt: string;
  hasExperience: boolean;
}

export interface ExperienceStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  averageRating: number;
  featuredCount: number;
}

export interface ExperienceFilters {
  status?: 'pending' | 'approved' | 'rejected';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'rating' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ExperiencesResponse {
  success: boolean;
  data: {
    experiences: Experience[];
    total: number;
    page: number;
    pages: number;
    stats?: ExperienceStats;
  };
}

export interface ExperienceResponse {
  success: boolean;
  data: {
    experience: Experience;
  };
  message?: string;
}

export interface AvailableBookingsResponse {
  success: boolean;
  data: {
    bookings: AvailableBooking[];
  };
}

export interface CheckExperienceResponse {
  success: boolean;
  data: {
    exists: boolean;
    experience?: Experience;
  };
}

export interface ExperienceStatsResponse {
  success: boolean;
  data: {
    stats: ExperienceStats;
  };
}

export interface BulkActionResponse {
  success: boolean;
  data: {
    modified: number;
  };
  message?: string;
}
