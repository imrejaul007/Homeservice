// Business Info for Provider Registration
export interface BusinessInfo {
  businessName: string;
  businessType: 'individual' | 'small_business' | 'company' | 'franchise';
  description: string;
  tagline?: string;
  website?: string;
  establishedDate?: string;
  serviceRadius?: number;
  yearsOfExperience?: number;
  certifications?: Array<{
    name: string;
    issuingOrganization: string;
    issueDate: string;
    expiryDate?: string;
  }>;
}

// Location Info for Provider Registration
export interface LocationInfo {
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  serviceAreas?: string[];
}

// Service Input for Provider Registration
export interface ServiceInput {
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  shortDescription?: string;
  duration: number;
  price: {
    amount: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
  };
  tags?: string[];
  images?: File[];
  equipment?: string[];
  prerequisites?: string[];
  isActive?: boolean;
}

// Verification Status - redesigned to match backend structure
export interface VerificationStatus {
  identity: {
    status: 'pending' | 'approved' | 'rejected';
    verifiedAt?: string;
    documents?: Array<{ type: string; url: string }>;
  };
  documents: {
    status: 'pending' | 'approved' | 'rejected';
    verifiedAt?: string;
    types?: string[];
  };
  backgroundCheck: {
    status: 'pending' | 'approved' | 'rejected';
    verifiedAt?: string;
    reportId?: string;
  };
  overall: 'pending' | 'approved' | 'rejected' | 'suspended';
  adminNotes?: string;
}

// Provider Verification Data
export interface ProviderVerificationData {
  userId: string;
  businessInfo: BusinessInfo;
  verificationStatus: VerificationStatus;
  completionPercentage: number;
  activeServicesCount: number;
  createdAt: string;
  services?: Array<{
    _id: string;
    name: string;
    category: string;
    status: string;
  }>;
}

// Dashboard Stats
export interface DashboardStats {
  totalUsers: number;
  totalCustomers: number;
  totalProviders: number;
  pendingVerifications: number;
  activeBookings: number;
  totalRevenue: number;
  monthlyGrowth: number;
  systemHealth: 'good' | 'warning' | 'critical';
}

// Service Stats
export interface ServiceStats {
  total: number;
  active: number;
  inactive: number;
  pendingReview: number;
  draft: number;
  approvalRate: number;
}

// User Stats
export interface UserStats {
  total: number;
  customers: number;
  providers: number;
  admins: number;
  active: number;
  suspended: number;
  verified: number;
}

// AI Insights
export interface AIInsight {
  type: 'positive' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation: string;
}

export interface AIInsightsData {
  stats: {
    completionRate: number;
    totalRevenue: number;
    totalBookings: number;
    averageRating: number;
  };
  topServices: Array<{
    service: string;
    bookings: number;
  }>;
  insights: AIInsight[];
}

// Admin Service Data
export interface AdminServiceData {
  _id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  shortDescription: string;
  duration: number;
  price: {
    amount: number;
    currency: string;
    type: string;
  };
  tags: string[];
  status: string;
  providerId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    businessInfo?: {
      businessName: string;
    };
  };
  images: string[];
  createdAt: string;
  updatedAt: string;
  rating: {
    average: number;
    count: number;
  };
  isActive: boolean;
}

// Admin User Data
export interface AdminUserData {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  accountStatus: string;
  createdAt: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  loyaltySystem: {
    totalCoins: number;
    tier: string;
  };
}
