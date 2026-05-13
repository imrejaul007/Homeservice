import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Camera,
  Save,
  X,
  Check,
  AlertCircle,
  MapPin,
  Calendar,
  Shield,
  Briefcase,
  Star,
  Award,
  Clock,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

const ProviderProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, providerProfile } = useAuthStore();

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Profile state
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: (providerProfile as any)?.bio || '',
    serviceCategories: (providerProfile as any)?.serviceCategories || [],
    yearsExperience: (providerProfile as any)?.yearsExperience || 0,
    serviceAreas: (providerProfile as any)?.serviceAreas || [],
  });

  // UI state
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(user?.avatar || null);
  const [isUploading, setIsUploading] = useState(false);

  // Update profile data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: providerProfile?.bio || '',
        serviceCategories: providerProfile?.serviceCategories || [],
        yearsExperience: providerProfile?.yearsExperience || 0,
        serviceAreas: providerProfile?.serviceAreas || [],
      });
      if (user.avatar) {
        setProfileImage(user.avatar);
      }
    }
  }, [user, providerProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setIsUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.post('/auth/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setSaveMessage('Profile image updated!');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (error: any) {
      setProfileImage(user?.avatar || null);
      setErrorMessage(error.response?.data?.message || 'Failed to upload image');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const response = await api.patch('/auth/me', {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone || undefined,
        bio: profileData.bio || undefined,
        yearsExperience: profileData.yearsExperience || undefined,
      });

      if (response.data.success) {
        useAuthStore.setState({
          user: {
            ...user!,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            phone: profileData.phone,
          } as any,
        });

        setSaveMessage('Profile updated successfully!');
        setIsEditing(false);
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || 'Failed to update profile');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setProfileData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: providerProfile?.bio || '',
      serviceCategories: providerProfile?.serviceCategories || [],
      yearsExperience: providerProfile?.yearsExperience || 0,
      serviceAreas: providerProfile?.serviceAreas || [],
    });
  };

  // Mock stats for demonstration
  const stats = {
    totalBookings: 156,
    completedJobs: 142,
    rating: 4.8,
    responseTime: '~2 hours',
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">My Provider Profile</h1>
            <p className="text-nilin-warmGray">Manage your professional profile and service information</p>
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
                        `${user?.firstName?.[0] || 'P'}${user?.lastName?.[0] || ''}`
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <label
                      htmlFor="profile-upload"
                      className="absolute bottom-4 right-0 bg-nilin-coral rounded-full p-2 cursor-pointer hover:bg-nilin-rose transition-colors shadow-nilin-warm"
                    >
                      <Camera className="h-4 w-4 text-white" />
                      <input
                        id="profile-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                  <h2 className="text-xl font-serif text-nilin-charcoal mb-1">
                    {user?.firstName} {user?.lastName}
                  </h2>
                  <p className="text-sm text-nilin-warmGray mb-3">{user?.email}</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    <Award className="h-3 w-3" />
                    {providerProfile?.isVerified ? 'Verified Provider' : 'Pending Verification'}
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-6 pt-6 border-t border-nilin-border">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-nilin-muted rounded-nilin">
                      <Briefcase className="w-5 h-5 text-nilin-coral mx-auto mb-1" />
                      <p className="text-lg font-bold text-nilin-charcoal">{stats.completedJobs}</p>
                      <p className="text-xs text-nilin-warmGray">Jobs Done</p>
                    </div>
                    <div className="text-center p-3 bg-nilin-muted rounded-nilin">
                      <Star className="w-5 h-5 text-nilin-coral mx-auto mb-1" />
                      <p className="text-lg font-bold text-nilin-charcoal">{stats.rating}</p>
                      <p className="text-xs text-nilin-warmGray">Rating</p>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="mt-6 pt-6 border-t border-nilin-border">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-nilin-warmGray flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Years Experience
                      </span>
                      <span className="text-sm font-medium text-nilin-charcoal">{stats.totalBookings}+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-nilin-warmGray flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Response Time
                      </span>
                      <span className="text-sm font-medium text-nilin-charcoal">{stats.responseTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-nilin-warmGray">Account Status</span>
                      <span className="text-sm font-medium text-green-600 capitalize">{user?.accountStatus || 'active'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Profile Form */}
            <div className="lg:col-span-2">
              {/* Personal Information Section */}
              <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-serif text-nilin-charcoal flex items-center gap-2">
                      <User className="h-5 w-5 text-nilin-coral" />
                      Personal Information
                    </h3>
                    <p className="text-sm text-nilin-warmGray mt-1">Update your personal and professional details</p>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 text-sm font-medium text-nilin-coral hover:bg-nilin-coral/10 rounded-nilin transition-colors"
                    >
                      Edit Profile
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
                        value={profileData.firstName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-nilin-charcoal mb-2">Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        value={profileData.lastName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
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
                        value={profileData.email}
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
                        value={profileData.phone}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        placeholder="+971 XX XXX XXXX"
                        className="w-full pl-12 pr-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">Bio / About Me</label>
                    <textarea
                      name="bio"
                      value={profileData.bio}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      rows={4}
                      placeholder="Tell customers about yourself, your experience, and what makes your services special..."
                      className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-nilin-charcoal mb-2">Years of Experience</label>
                      <input
                        type="number"
                        name="yearsExperience"
                        value={profileData.yearsExperience}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        min="0"
                        className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-nilin-charcoal mb-2">Service Areas</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray" />
                        <input
                          type="text"
                          name="serviceAreas"
                          value={profileData.serviceAreas.join(', ')}
                          onChange={(e) => setProfileData((prev) => ({
                            ...prev,
                            serviceAreas: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                          }))}
                          disabled={!isEditing}
                          placeholder="Dubai Marina, JBR, Palm Jumeirah..."
                          className="w-full pl-12 pr-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none disabled:bg-nilin-muted text-nilin-charcoal transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSaveProfile}
                        className="flex-1 btn-nilin flex items-center justify-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save Changes
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                      >
                        <X className="h-4 w-4 inline mr-2" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Security Section */}
              <div className="glass-nilin rounded-nilin-lg p-6 hover-lift mt-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-serif text-nilin-charcoal flex items-center gap-2">
                      <Shield className="h-5 w-5 text-nilin-coral" />
                      Account Security
                    </h3>
                    <p className="text-sm text-nilin-warmGray mt-1">Manage your account security settings</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-nilin-muted rounded-nilin">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-nilin-warmGray" />
                      <div>
                        <p className="text-sm font-medium text-nilin-charcoal">Email Verification</p>
                        <p className="text-xs text-nilin-warmGray">{user?.email}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user?.isEmailVerified
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {user?.isEmailVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>

                  <button
                    onClick={() => navigate('/change-password')}
                    className="w-full py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors text-sm font-medium"
                  >
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProviderProfilePage;
