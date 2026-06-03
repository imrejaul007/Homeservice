import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  User,
  Bell,
  Shield,
  Globe,
  Clock,
  Lock,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Save,
  Check,
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { serviceAreasToStrings } from '../../utils/providerProfile';
import { api } from '../../services/api';

interface NotificationSettings {
  email: {
    newBookings: boolean;
    bookingReminders: boolean;
    reviewRequests: boolean;
    marketingEmails: boolean;
  };
  sms: {
    newBookings: boolean;
    bookingReminders: boolean;
  };
  push: {
    newBookings: boolean;
    bookingReminders: boolean;
    newMessages: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

interface BusinessSettings {
  autoAcceptBookings: boolean;
  maxAdvanceBookingDays: number;
  minBookingNoticeHours: number;
  cancellationPolicyHours: number;
  serviceAreas: string[];
}

interface PrivacySettings {
  showEmail: boolean;
  showPhone: boolean;
  showReviewsPublicly: boolean;
}

interface ProviderProfileSettings {
  businessSettings?: {
    autoAcceptBookings?: boolean;
    maxAdvanceBookingDays?: number;
    minBookingNoticeHours?: number;
    cancellationPolicyHours?: number;
  };
  locationInfo?: {
    serviceAreas?: Array<{ city: string; state?: string; country?: string }>;
  };
  privacySettings?: {
    showEmail?: boolean;
    showPhone?: boolean;
    showReviewsPublicly?: boolean;
  };
}

const ProviderSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, providerProfile } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL param helpers
  const getInitialSection = (): string => {
    const section = searchParams.get('section');
    const validSections = ['notifications', 'business', 'privacy', 'security', 'profile'];
    if (section && validSections.includes(section)) {
      return section;
    }
    return 'notifications';
  };

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/provider/dashboard'); // FIX: Was '/dashboard'
    }
  }, [user, navigate]);

  // Active section state
  const [activeSection, setActiveSection] = useState(getInitialSection);

  // Section change handler
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setSearchParams({ section });
  };

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Notification settings state
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: {
      newBookings: true,
      bookingReminders: true,
      reviewRequests: true,
      marketingEmails: false,
    },
    sms: {
      newBookings: true,
      bookingReminders: false,
    },
    push: {
      newBookings: true,
      bookingReminders: true,
      newMessages: true,
    },
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
  });

  // Business settings state
  const [business, setBusiness] = useState<BusinessSettings>({
    autoAcceptBookings: false,
    maxAdvanceBookingDays: 30,
    minBookingNoticeHours: 2,
    cancellationPolicyHours: 24,
    serviceAreas: [],
  });

  // Privacy settings state
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    showEmail: false,
    showPhone: true,
    showReviewsPublicly: true,
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        // Load notification preferences
        const notifResponse = await api.get('/notifications/preferences');
        if (notifResponse.data?.success) {
          const prefs = notifResponse.data.data;
          setNotifications({
            email: {
              newBookings: prefs.email?.bookingUpdates ?? true,
              bookingReminders: prefs.email?.reminders ?? true,
              reviewRequests: true,
              marketingEmails: prefs.email?.marketing ?? false,
            },
            sms: {
              newBookings: prefs.sms?.bookingUpdates ?? true,
              bookingReminders: prefs.sms?.reminders ?? false,
            },
            push: {
              newBookings: prefs.push?.bookingUpdates ?? true,
              bookingReminders: prefs.push?.reminders ?? true,
              newMessages: prefs.push?.newMessages ?? true,
            },
            quietHours: {
              enabled: prefs.quietHours?.enabled ?? false,
              startTime: prefs.quietHours?.startTime ?? '22:00',
              endTime: prefs.quietHours?.endTime ?? '08:00',
            },
          });
        }

        // Load provider business settings
        const profileData = providerProfile as ProviderProfileSettings | null;
        if (profileData) {
          setBusiness({
            autoAcceptBookings: profileData.businessSettings?.autoAcceptBookings ?? false,
            maxAdvanceBookingDays: profileData.businessSettings?.maxAdvanceBookingDays ?? 30,
            minBookingNoticeHours: profileData.businessSettings?.minBookingNoticeHours ?? 2,
            cancellationPolicyHours: profileData.businessSettings?.cancellationPolicyHours ?? 24,
            serviceAreas: serviceAreasToStrings(profileData.locationInfo?.serviceAreas),
          });
          setPrivacy({
            showEmail: profileData.privacySettings?.showEmail ?? false,
            showPhone: profileData.privacySettings?.showPhone ?? true,
            showReviewsPublicly: profileData.privacySettings?.showReviewsPublicly ?? true,
          });
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [providerProfile]);

  // Toggle notification
  const toggleNotification = (
    channel: 'email' | 'sms' | 'push',
    key: string
  ) => {
    setNotifications(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [key]: !prev[channel][key as keyof typeof prev[typeof channel]],
      },
    }));
  };

  // Save notification settings
  const saveNotifications = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await api.patch('/notifications/preferences', {
        email: {
          bookingUpdates: notifications.email.newBookings,
          reminders: notifications.email.bookingReminders,
          marketing: notifications.email.marketingEmails,
        },
        sms: {
          bookingUpdates: notifications.sms.newBookings,
          reminders: notifications.sms.bookingReminders,
        },
        push: {
          bookingUpdates: notifications.push.newBookings,
          reminders: notifications.push.bookingReminders,
          newMessages: notifications.push.newMessages,
        },
        quietHours: notifications.quietHours,
      });
      setSaveMessage({ type: 'success', text: 'Notification settings saved!' });
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Save business settings
  const saveBusiness = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await api.patch('/provider/settings', {
        businessSettings: business,
        locationInfo: {
          serviceAreas: business.serviceAreas,
        },
      });
      setSaveMessage({ type: 'success', text: 'Business settings saved!' });
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Save privacy settings
  const savePrivacy = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await api.patch('/provider/settings', {
        privacySettings: privacy,
      });
      setSaveMessage({ type: 'success', text: 'Privacy settings saved!' });
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Change password
  const handlePasswordChange = async () => {
    setPasswordError('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/auth/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSaveMessage({ type: 'success', text: 'Password changed successfully!' });
    } catch (error: any) {
      setPasswordError(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // Toggle boolean settings
  const toggleBusiness = (key: keyof BusinessSettings) => {
    if (typeof business[key] === 'boolean') {
      setBusiness(prev => ({
        ...prev,
        [key]: !prev[key as keyof typeof prev],
      }));
    }
  };

  const togglePrivacy = (key: keyof PrivacySettings) => {
    setPrivacy(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const sections = [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'business', label: 'Business Settings', icon: Globe },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-nilin-coral animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-serif text-nilin-charcoal">Settings</h1>
            <p className="text-sm text-nilin-warmGray">Manage your account settings</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="lg:w-64 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-nilin-border/50 overflow-hidden">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => handleSectionChange(section.id)}
                    className={`w-full flex items-center px-4 py-3 text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-nilin-blush/50 text-nilin-coral border-l-4 border-nilin-coral'
                        : 'text-nilin-charcoal hover:bg-nilin-blush/30 border-l-4 border-transparent'
                    }`}
                  >
                    <section.icon className="h-5 w-5 mr-3" />
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              {saveMessage && (
                <div
                  className={`mb-4 p-4 rounded-lg flex items-center ${
                    saveMessage.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {saveMessage.type === 'success' ? (
                    <Check className="h-5 w-5 mr-2" />
                  ) : (
                    <AlertCircle className="h-5 w-5 mr-2" />
                  )}
                  {saveMessage.text}
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === 'notifications' && (
                <div className="bg-white rounded-xl shadow-sm border border-nilin-border/50 p-6">
                  <h2 className="text-lg font-semibold text-nilin-charcoal mb-4 flex items-center">
                    <Bell className="h-5 w-5 mr-2 text-nilin-coral" />
                    Notification Preferences
                  </h2>

                  {/* Email Notifications */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-3">Email Notifications</h3>
                    <div className="space-y-3">
                      {[
                        { key: 'newBookings', label: 'New booking requests' },
                        { key: 'bookingReminders', label: 'Booking reminders' },
                        { key: 'reviewRequests', label: 'Review requests' },
                        { key: 'marketingEmails', label: 'Marketing & promotions' },
                      ].map((item) => (
                        <label key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-nilin-charcoal">{item.label}</span>
                          <input
                            type="checkbox"
                            checked={notifications.email[item.key as keyof typeof notifications.email]}
                            onChange={() => toggleNotification('email', item.key)}
                            className="h-5 w-5 text-nilin-coral rounded focus:ring-nilin-coral"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* SMS Notifications */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-3">SMS Notifications</h3>
                    <div className="space-y-3">
                      {[
                        { key: 'newBookings', label: 'New booking requests' },
                        { key: 'bookingReminders', label: 'Booking reminders' },
                      ].map((item) => (
                        <label key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-nilin-charcoal">{item.label}</span>
                          <input
                            type="checkbox"
                            checked={notifications.sms[item.key as keyof typeof notifications.sms]}
                            onChange={() => toggleNotification('sms', item.key)}
                            className="h-5 w-5 text-nilin-coral rounded focus:ring-nilin-coral"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Push Notifications */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-3">Push Notifications</h3>
                    <div className="space-y-3">
                      {[
                        { key: 'newBookings', label: 'New booking requests' },
                        { key: 'bookingReminders', label: 'Booking reminders' },
                        { key: 'newMessages', label: 'New messages' },
                      ].map((item) => (
                        <label key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-nilin-charcoal">{item.label}</span>
                          <input
                            type="checkbox"
                            checked={notifications.push[item.key as keyof typeof notifications.push]}
                            onChange={() => toggleNotification('push', item.key)}
                            className="h-5 w-5 text-nilin-coral rounded focus:ring-nilin-coral"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Quiet Hours */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-nilin-charcoal mb-3 flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Quiet Hours
                    </h3>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <label className="flex items-center justify-between mb-4">
                        <span className="text-sm text-nilin-charcoal">Enable quiet hours</span>
                        <input
                          type="checkbox"
                          checked={notifications.quietHours.enabled}
                          onChange={() =>
                            setNotifications(prev => ({
                              ...prev,
                              quietHours: { ...prev.quietHours, enabled: !prev.quietHours.enabled },
                            }))
                          }
                          className="h-5 w-5 text-nilin-coral rounded focus:ring-nilin-coral"
                        />
                      </label>
                      {notifications.quietHours.enabled && (
                        <div className="flex items-center gap-4">
                          <div>
                            <label className="text-xs text-nilin-warmGray">From</label>
                            <input
                              type="time"
                              value={notifications.quietHours.startTime}
                              onChange={(e) =>
                                setNotifications(prev => ({
                                  ...prev,
                                  quietHours: { ...prev.quietHours, startTime: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-nilin-warmGray">To</label>
                            <input
                              type="time"
                              value={notifications.quietHours.endTime}
                              onChange={(e) =>
                                setNotifications(prev => ({
                                  ...prev,
                                  quietHours: { ...prev.quietHours, endTime: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={saveNotifications}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Save className="h-5 w-5 mr-2" />
                    )}
                    Save Notification Settings
                  </button>
                </div>
              )}

              {/* Business Settings Section */}
              {activeSection === 'business' && (
                <div className="bg-white rounded-xl shadow-sm border border-nilin-border/50 p-6">
                  <h2 className="text-lg font-semibold text-nilin-charcoal mb-4 flex items-center">
                    <Globe className="h-5 w-5 mr-2 text-nilin-coral" />
                    Business Settings
                  </h2>

                  <div className="space-y-6">
                    {/* Booking Settings */}
                    <div>
                      <h3 className="text-sm font-medium text-nilin-charcoal mb-3">Booking Settings</h3>
                      <div className="space-y-3">
                        <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <span className="text-sm text-nilin-charcoal block">Auto-accept bookings</span>
                            <span className="text-xs text-nilin-warmGray">Automatically accept new booking requests</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={business.autoAcceptBookings}
                            onChange={() => toggleBusiness('autoAcceptBookings')}
                            className="h-5 w-5 text-nilin-coral rounded focus:ring-nilin-coral"
                          />
                        </label>

                        <div className="p-3 bg-gray-50 rounded-lg">
                          <label className="text-sm text-nilin-charcoal block mb-2">
                            Maximum advance booking (days)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={business.maxAdvanceBookingDays}
                            onChange={(e) =>
                              setBusiness(prev => ({
                                ...prev,
                                maxAdvanceBookingDays: parseInt(e.target.value) || 30,
                              }))
                            }
                            className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm"
                          />
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg">
                          <label className="text-sm text-nilin-charcoal block mb-2">
                            Minimum notice before appointment (hours)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="72"
                            value={business.minBookingNoticeHours}
                            onChange={(e) =>
                              setBusiness(prev => ({
                                ...prev,
                                minBookingNoticeHours: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm"
                          />
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg">
                          <label className="text-sm text-nilin-charcoal block mb-2">
                            Cancellation policy (hours before)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="72"
                            value={business.cancellationPolicyHours}
                            onChange={(e) =>
                              setBusiness(prev => ({
                                ...prev,
                                cancellationPolicyHours: parseInt(e.target.value) || 24,
                              }))
                            }
                            className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={saveBusiness}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors disabled:opacity-50 mt-6"
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Save className="h-5 w-5 mr-2" />
                    )}
                    Save Business Settings
                  </button>
                </div>
              )}

              {/* Privacy Section */}
              {activeSection === 'privacy' && (
                <div className="bg-white rounded-xl shadow-sm border border-nilin-border/50 p-6">
                  <h2 className="text-lg font-semibold text-nilin-charcoal mb-4 flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-nilin-coral" />
                    Privacy Settings
                  </h2>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm text-nilin-charcoal block">Show email publicly</span>
                        <span className="text-xs text-nilin-warmGray">Display your email on your profile</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={privacy.showEmail}
                        onChange={() => togglePrivacy('showEmail')}
                        className="h-5 w-5 text-nilin-coral rounded focus:ring-nilin-coral"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm text-nilin-charcoal block">Show phone publicly</span>
                        <span className="text-xs text-nilin-warmGray">Display your phone on your profile</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={privacy.showPhone}
                        onChange={() => togglePrivacy('showPhone')}
                        className="h-5 w-5 text-nilin-coral rounded focus:ring-nilin-coral"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm text-nilin-charcoal block">Show reviews publicly</span>
                        <span className="text-xs text-nilin-warmGray">Display your reviews on your profile</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={privacy.showReviewsPublicly}
                        onChange={() => togglePrivacy('showReviewsPublicly')}
                        className="h-5 w-5 text-nilin-coral rounded focus:ring-nilin-coral"
                      />
                    </label>
                  </div>

                  <button
                    onClick={savePrivacy}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors disabled:opacity-50 mt-6"
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Save className="h-5 w-5 mr-2" />
                    )}
                    Save Privacy Settings
                  </button>
                </div>
              )}

              {/* Security Section */}
              {activeSection === 'security' && (
                <div className="bg-white rounded-xl shadow-sm border border-nilin-border/50 p-6">
                  <h2 className="text-lg font-semibold text-nilin-charcoal mb-4 flex items-center">
                    <Lock className="h-5 w-5 mr-2 text-nilin-coral" />
                    Security Settings
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-nilin-charcoal block mb-2">Current Password</label>
                      <div className="relative">
                        <input
                          type={showPasswords ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={(e) =>
                            setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm pr-10"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(!showPasswords)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-nilin-charcoal block mb-2">New Password</label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm"
                        placeholder="Enter new password (min 8 characters)"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-nilin-charcoal block mb-2">Confirm New Password</label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-nilin-border rounded-lg text-sm"
                        placeholder="Confirm new password"
                      />
                    </div>

                    {passwordError && (
                      <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {passwordError}
                      </div>
                    )}

                    <button
                      onClick={handlePasswordChange}
                      disabled={isSaving || !passwordData.currentPassword || !passwordData.newPassword}
                      className="w-full flex items-center justify-center px-4 py-2.5 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <Lock className="h-5 w-5 mr-2" />
                      )}
                      Change Password
                    </button>
                  </div>
                </div>
              )}

              {/* Profile Section */}
              {activeSection === 'profile' && (
                <div className="bg-white rounded-xl shadow-sm border border-nilin-border/50 p-6">
                  <h2 className="text-lg font-semibold text-nilin-charcoal mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2 text-nilin-coral" />
                    Profile Settings
                  </h2>

                  <div className="text-center py-8">
                    <User className="h-16 w-16 text-nilin-warmGray mx-auto mb-4" />
                    <p className="text-nilin-warmGray mb-4">
                      Manage your profile information, photos, and business details.
                    </p>
                    <Link
                      to="/provider/profile"
                      className="inline-flex items-center px-6 py-2.5 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors"
                    >
                      Go to Profile
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProviderSettingsPage;
