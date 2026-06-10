import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Camera,
  Save,
  X,
  Check,
  Settings,
  Shield,
  Gift,
  Bell,
  Calendar,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import ProfileSettings from '../../components/customer/ProfileSettings';
import ProfileSecurity from '../../components/customer/ProfileSecurity';
import ProfileReferrals from '../../components/customer/ProfileReferrals';
import ProfileNotifications from '../../components/customer/ProfileNotifications';
import { useAuthStore } from '../../stores/authStore';
import { useBookingStore } from '../../stores/bookingStore';
import { api } from '../../services/api';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import toast from 'react-hot-toast';

const VALID_TABS = ['profile', 'settings', 'security', 'referrals', 'notifications'] as const;
type ProfileTab = typeof VALID_TABS[number];

const TAB_ALIASES: Record<string, ProfileTab> = {
  referral: 'referrals',
  referrals: 'referrals',
};

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const ProfilePage: React.FC = () => {
  const { user, updateProfile, updateAvatar } = useAuthStore();
  const { customerBookings, getCustomerBookings, isLoading: isLoadingBookings } = useBookingStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookingError, setBookingError] = useState<string | null>(null);

  const activeTab = useMemo<ProfileTab>(() => {
    const tabParam = searchParams.get('tab');
    if (!tabParam) return 'profile';
    const normalized = TAB_ALIASES[tabParam] ?? tabParam;
    return VALID_TABS.includes(normalized as ProfileTab) ? (normalized as ProfileTab) : 'profile';
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    if (value === 'profile') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', value);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Fetch bookings on mount with error handling
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setBookingError(null);
        await getCustomerBookings({ limit: 100 });
      } catch (error) {
        console.error('Failed to fetch bookings:', error);
        setBookingError('Failed to load booking history. Please try again.');
        toast.error('Failed to load booking history');
      }
    };
    fetchBookings();
  }, [getCustomerBookings]);

  // Calculate real stats from booking data
  const completedBookings = customerBookings?.filter(b => b.status === 'completed').length || 0;
  const totalBookings = customerBookings?.length || 0;

  // Stats - using real data from booking store
  const stats = {
    bookingsCompleted: completedBookings,
    totalBookings: totalBookings,
  };

  // Personal Information State
  const [personalInfo, setPersonalInfo] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
    dateOfBirth: string;
  }>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    gender: user?.gender || '',
    dateOfBirth: user?.dateOfBirth || '',
  });

  // UI State
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(user?.avatar ?? null);
  const [isUploading, setIsUploading] = useState(false);

  // Update personal info when user changes
  useEffect(() => {
    if (user) {
      setPersonalInfo({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        gender: user.gender || '',
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
      });
      setProfileImage(user.avatar ?? null);
    }
  }, [user]);

  const handlePersonalInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPersonalInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setErrorMessage('Only JPEG, PNG, and WebP images are allowed');
      setTimeout(() => setErrorMessage(''), 3000);
      e.target.value = '';
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setErrorMessage('Image must be smaller than 5MB');
      setTimeout(() => setErrorMessage(''), 3000);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setProfileImage(reader.result as string);
      }
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.post('/auth/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        const avatarUrl = response.data.data?.avatar;
        if (avatarUrl) {
          setProfileImage(avatarUrl);
          updateAvatar(avatarUrl);
        }
        setSaveMessage('Profile image updated!');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (error: unknown) {
      setProfileImage(user?.avatar || null);
      const apiError = error as { response?: { data?: { message?: string } } };
      setErrorMessage(apiError.response?.data?.message || 'Failed to upload image');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSavePersonalInfo = async () => {
    try {
      const profileData: {
        firstName: string;
        lastName: string;
        phone?: string;
        gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
        dateOfBirth?: string;
      } = {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
      };

      if (personalInfo.phone) profileData.phone = personalInfo.phone;
      if (personalInfo.gender) profileData.gender = personalInfo.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say';
      if (personalInfo.dateOfBirth) profileData.dateOfBirth = personalInfo.dateOfBirth;

      await updateProfile(profileData);

      setSaveMessage('Personal information updated successfully!');
      setIsEditingPersonal(false);
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update personal information';
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleCancelPersonal = () => {
    setIsEditingPersonal(false);
    setPersonalInfo({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      gender: user?.gender || '',
      dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
    });
  };

  return (
    <PageErrorBoundary pageName="Profile">
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">My Profile</h1>
            <p className="text-nilin-warmGray">Manage your account information and preferences</p>
          </div>

          {/* Success/Error Messages */}
          {saveMessage && (
            <div className="mb-6 p-4 rounded-nilin bg-green-50 border border-green-200 flex items-center gap-3">
              <Check className="h-5 w-5 text-green-600" />
              <span className="text-green-800">{saveMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800">{errorMessage}</span>
            </div>
          )}

          <Tabs.Root value={activeTab} onValueChange={handleTabChange} className="w-full">
            <Tabs.List
              className="flex gap-2 mb-8 p-1 bg-white rounded-nilin shadow-nilin overflow-x-auto"
              aria-label="Profile sections"
            >
              <Tabs.Trigger
                value="profile"
                className="flex-1 px-4 py-3 rounded-nilin text-sm font-medium text-nilin-warmGray data-[state=active]:bg-nilin-coral data-[state=active]:text-white transition-all whitespace-nowrap"
              >
                <User className="w-4 h-4 inline mr-2" />
                My Profile
              </Tabs.Trigger>
              <Tabs.Trigger
                value="settings"
                className="flex-1 px-4 py-3 rounded-nilin text-sm font-medium text-nilin-warmGray data-[state=active]:bg-nilin-coral data-[state=active]:text-white transition-all whitespace-nowrap"
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Settings
              </Tabs.Trigger>
              <Tabs.Trigger
                value="security"
                className="flex-1 px-4 py-3 rounded-nilin text-sm font-medium text-nilin-warmGray data-[state=active]:bg-nilin-coral data-[state=active]:text-white transition-all whitespace-nowrap"
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Security
              </Tabs.Trigger>
              <Tabs.Trigger
                value="referrals"
                className="flex-1 px-4 py-3 rounded-nilin text-sm font-medium text-nilin-warmGray data-[state=active]:bg-nilin-coral data-[state=active]:text-white transition-all whitespace-nowrap"
              >
                <Gift className="w-4 h-4 inline mr-2" />
                Referrals
              </Tabs.Trigger>
              <Tabs.Trigger
                value="notifications"
                className="flex-1 px-4 py-3 rounded-nilin text-sm font-medium text-nilin-warmGray data-[state=active]:bg-nilin-coral data-[state=active]:text-white transition-all whitespace-nowrap"
              >
                <Bell className="w-4 h-4 inline mr-2" />
                Notifications
              </Tabs.Trigger>
            </Tabs.List>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Profile Picture & Stats */}
              <div className="lg:col-span-1">
                <div className="glass-nilin rounded-nilin-lg p-6 sticky top-8 hover-lift">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4 overflow-hidden shadow-nilin-warm">
                        {profileImage ? (
                          <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          `${user?.firstName?.[0] || 'U'}${user?.lastName?.[0] || ''}`
                        )}
                        {isUploading && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <label
                        htmlFor="profile-upload"
                        aria-label="Upload profile photo"
                        className={`absolute bottom-4 right-0 bg-nilin-coral rounded-full p-2 transition-colors shadow-nilin-warm ${
                          isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-nilin-rose'
                        }`}
                      >
                        <Camera className="h-4 w-4 text-white" aria-hidden="true" />
                        <input
                          id="profile-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={isUploading}
                          onChange={handleImageUpload}
                        />
                      </label>
                    </div>
                    <h2 className="text-xl font-serif text-nilin-charcoal mb-1">
                      {user?.firstName} {user?.lastName}
                    </h2>
                    <p className="text-sm text-nilin-warmGray mb-3">{user?.email}</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      <Check className="h-3 w-3" />
                      {user?.isEmailVerified ? 'Verified' : 'Unverified'}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-6 pt-6 border-t border-nilin-border">
                    {bookingError && (
                      <div className="mb-4 p-3 rounded-nilin bg-amber-50 border border-amber-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">{bookingError}</p>
                      </div>
                    )}
                    {isLoadingBookings ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-nilin-muted rounded-nilin animate-pulse">
                          <div className="w-5 h-5 bg-nilin-border rounded mx-auto mb-1" />
                          <div className="h-6 bg-nilin-border rounded w-12 mx-auto mb-1" />
                          <div className="h-3 bg-nilin-border rounded w-20 mx-auto" />
                        </div>
                        <div className="text-center p-3 bg-nilin-muted rounded-nilin animate-pulse">
                          <div className="w-5 h-5 bg-nilin-border rounded mx-auto mb-1" />
                          <div className="h-6 bg-nilin-border rounded w-12 mx-auto mb-1" />
                          <div className="h-3 bg-nilin-border rounded w-20 mx-auto" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-nilin-muted rounded-nilin">
                          <Calendar className="w-5 h-5 text-nilin-coral mx-auto mb-1" />
                          <p className="text-lg font-bold text-nilin-charcoal">{stats.bookingsCompleted}</p>
                          <p className="text-xs text-nilin-warmGray">Bookings Completed</p>
                        </div>
                        <div className="text-center p-3 bg-nilin-muted rounded-nilin">
                          <MapPin className="w-5 h-5 text-nilin-coral mx-auto mb-1" />
                          <p className="text-lg font-bold text-nilin-charcoal">{stats.totalBookings}</p>
                          <p className="text-xs text-nilin-warmGray">Total Bookings</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Account Info */}
                  <div className="mt-6 pt-6 border-t border-nilin-border">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-nilin-warmGray">Account Type</span>
                        <span className="text-sm font-medium text-nilin-charcoal capitalize">{user?.role}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-nilin-warmGray">Status</span>
                        <span className="text-sm font-medium text-nilin-charcoal capitalize">{user?.accountStatus || 'active'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Tab Content */}
              <div className="lg:col-span-2">
                <Tabs.Content value="profile" className="outline-none">
                  {/* Personal Information Section */}
                  <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-serif text-nilin-charcoal flex items-center gap-2">
                          <User className="h-5 w-5 text-nilin-coral" />
                          Personal Information
                        </h3>
                        <p className="text-sm text-nilin-warmGray mt-1">Update your personal details</p>
                      </div>
                      {!isEditingPersonal && (
                        <button
                          onClick={() => setIsEditingPersonal(true)}
                          className="px-4 py-2 text-sm font-medium text-nilin-coral hover:bg-nilin-coral/10 rounded-nilin transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-nilin-charcoal mb-2">First Name</label>
                          <input
                            type="text"
                            name="firstName"
                            value={personalInfo.firstName}
                            onChange={handlePersonalInfoChange}
                            disabled={!isEditingPersonal}
                            className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-nilin-charcoal mb-2">Last Name</label>
                          <input
                            type="text"
                            name="lastName"
                            value={personalInfo.lastName}
                            onChange={handlePersonalInfoChange}
                            disabled={!isEditingPersonal}
                            className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-nilin-charcoal mb-2">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray" />
                          <input
                            type="email"
                            name="email"
                            value={personalInfo.email}
                            disabled
                            className="w-full pl-12 pr-4 py-3 rounded-nilin bg-nilin-muted border border-nilin-border text-nilin-warmGray cursor-not-allowed"
                          />
                        </div>
                        <p className="text-xs text-nilin-warmGray mt-1">Email cannot be changed</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-nilin-charcoal mb-2">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray" />
                          <input
                            type="tel"
                            name="phone"
                            value={personalInfo.phone}
                            onChange={handlePersonalInfoChange}
                            disabled={!isEditingPersonal}
                            placeholder="+971 XX XXX XXXX"
                            className="w-full pl-12 pr-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-nilin-charcoal mb-2">Gender</label>
                          <select
                            name="gender"
                            value={personalInfo.gender}
                            onChange={handlePersonalInfoChange}
                            disabled={!isEditingPersonal}
                            className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
                          >
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer_not_to_say">Prefer not to say</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-nilin-charcoal mb-2">Date of Birth</label>
                          <input
                            type="date"
                            name="dateOfBirth"
                            value={personalInfo.dateOfBirth}
                            onChange={handlePersonalInfoChange}
                            disabled={!isEditingPersonal}
                            className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
                          />
                        </div>
                      </div>

                      {isEditingPersonal && (
                        <div className="flex gap-3 pt-4">
                          <button
                            onClick={handleSavePersonalInfo}
                            className="flex-1 btn-nilin flex items-center justify-center gap-2"
                          >
                            <Save className="h-4 w-4" />
                            Save Changes
                          </button>
                          <button
                            onClick={handleCancelPersonal}
                            className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                          >
                            <X className="h-4 w-4 inline mr-2" />
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Content>

                <Tabs.Content value="settings" className="outline-none">
                  <ProfileSettings />
                </Tabs.Content>

                <Tabs.Content value="security" className="outline-none">
                  <ProfileSecurity />
                </Tabs.Content>

                <Tabs.Content value="referrals" className="outline-none">
                  <ProfileReferrals />
                </Tabs.Content>

                <Tabs.Content value="notifications" className="outline-none">
                  <ProfileNotifications />
                </Tabs.Content>
              </div>
            </div>
          </Tabs.Root>
        </div>
      </div>

      <Footer />
    </div>
    </PageErrorBoundary>
  );
};

export default ProfilePage;
