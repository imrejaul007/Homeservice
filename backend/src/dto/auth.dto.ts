// ============================================
// Auth DTOs - Data Transfer Objects
// ============================================

export interface AddressDTO {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface CommunicationPrefsDTO {
  email?: {
    marketing?: boolean;
    bookingUpdates?: boolean;
    reminders?: boolean;
    newsletters?: boolean;
    promotions?: boolean;
  };
  sms?: {
    bookingUpdates?: boolean;
    reminders?: boolean;
    promotions?: boolean;
  };
  push?: {
    bookingUpdates?: boolean;
    reminders?: boolean;
    newMessages?: boolean;
    promotions?: boolean;
  };
  language?: string;
  timezone?: string;
  currency?: string;
}

// ============================================
// Registration DTOs
// ============================================

export interface CustomerRegistrationDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: AddressDTO;
  communicationPreferences?: CommunicationPrefsDTO;
  referralCode?: string;
}

export interface BusinessInfoDTO {
  businessName: string;
  businessType?: string;
  description?: string;
  tagline?: string;
  website?: string;
  establishedDate?: string;
  serviceRadius?: number;
}

export interface LocationAddressDTO {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface LocationInfoDTO {
  primaryAddress: LocationAddressDTO;
  mobileService?: boolean;
  hasFixedLocation?: boolean;
}

export interface ServiceInputDTO {
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  duration: number;
  price: {
    amount: number;
    currency?: string;
    type?: string;
  };
  tags?: string[];
}

export interface ProviderRegistrationDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  businessInfo: BusinessInfoDTO;
  locationInfo: LocationInfoDTO;
  services: ServiceInputDTO[];
}

export interface AdminRegistrationDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

// ============================================
// Login DTOs
// ============================================

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RefreshTokenDTO {
  refreshToken?: string;
}

// ============================================
// Password Management DTOs
// ============================================

export interface ForgotPasswordDTO {
  email: string;
}

export interface ResetPasswordDTO {
  token: string;
  password: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

// ============================================
// Email Verification DTOs
// ============================================

export interface VerifyEmailDTO {
  token: string;
}

export interface ResendVerificationDTO {
  email: string;
}

// ============================================
// Profile DTOs
// ============================================

export interface ProfileUpdatesDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: string;
  avatar?: string;
  address?: AddressDTO;
  socialMediaLinks?: Record<string, string>;
  communicationPreferences?: CommunicationPrefsDTO;
}

// ============================================
// Response Types
// ============================================

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  accountStatus: string;
  loyaltyCoins?: number;
  tier?: string;
  referralCode?: string;
  avatar?: string;
  phone?: string;
  bio?: string;
  lastLogin?: Date;
}

export interface CustomerProfileData {
  id: string;
  addresses: any[];
  favoriteProvidersCount: number;
  preferences: any;
  loyaltyData: any;
  bookingHistory: any;
}

export interface ProviderProfileData {
  id: string;
  businessInfo: any;
  completionPercentage: number;
  verificationStatus: any;
  services: any[];
  averageRating?: number;
  totalEarnings?: number;
}

export interface AuthResult {
  user: UserResponse;
  tokens: TokenPair;
  requiresEmailVerification: boolean;
}

export interface LoginResult extends AuthResult {
  redirectUrl: string;
  roleSpecificData?: {
    customerProfile?: Partial<CustomerProfileData>;
    providerProfile?: Partial<ProviderProfileData>;
  };
}

export interface PasswordResetResult {
  user: UserResponse;
  accessToken: string;
}

export interface EmailVerificationResult {
  user: UserResponse;
}

export interface ProfileResult {
  user: UserResponse;
  customerProfile?: Partial<CustomerProfileData>;
  providerProfile?: Partial<ProviderProfileData>;
}
