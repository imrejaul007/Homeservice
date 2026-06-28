
import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Eye,
  Mail,
  Cookie,
  FileText,
  Download,
  Trash2,
  Check,
  X,
  ChevronRight,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Bell,
  User,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { gdprApi } from '../services/gdprApi';

interface Consent {
  type: 'terms' | 'privacy' | 'marketing' | 'cookies' | 'data_processing';
  granted: boolean;
  version: string;
  timestamp: string;
  withdrawalDate?: string;
}

interface DataRequest {
  _id: string;
  type: 'export' | 'deletion' | 'rectification' | 'portability';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  requestedAt: string;
  completedAt?: string;
  progress?: number;
  currentStep?: string;
  downloadUrl?: string;
  downloadExpiry?: string;
}

interface ExportProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  steps: Array<{
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  }>;
}

const PrivacySettings: React.FC = () => {
  const { user } = useAuthStore();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([
    'profile', 'bookings', 'payments', 'reviews', 'preferences'
  ]);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Consent types with descriptions
  const consentTypes = [
    {
      type: 'terms' as const,
      title: 'Terms of Service',
      description: 'I have read and agree to the Terms of Service',
      required: true,
      icon: FileText,
      version: '2.0.0'
    },
    {
      type: 'privacy' as const,
      title: 'Privacy Policy',
      description: 'I have read and agree to the Privacy Policy',
      required: true,
      icon: Shield,
      version: '3.0.0'
    },
    {
      type: 'data_processing' as const,
      title: 'Data Processing Agreement',
      description: 'I consent to the processing of my personal data as described in the Privacy Policy',
      required: true,
      icon: Lock,
      version: '1.0.0'
    },
    {
      type: 'marketing' as const,
      title: 'Marketing Communications',
      description: 'I would like to receive promotional emails, SMS messages, and push notifications about offers and updates',
      required: false,
      icon: Mail,
      version: '1.0.0'
    },
    {
      type: 'cookies' as const,
      title: 'Cookie Preferences',
      description: 'Allow cookies for analytics and personalized experiences',
      required: false,
      icon: Cookie,
      version: '2.0.0'
    }
  ];

  const dataTypeOptions = [
    { id: 'profile', label: 'Profile Information', description: 'Your account details and personal information' },
    { id: 'bookings', label: 'Booking History', description: 'All your service bookings and appointments' },
    { id: 'payments', label: 'Payment Records', description: 'Transaction history and payment methods' },
    { id: 'reviews', label: 'Reviews', description: 'Reviews you have written' },
    { id: 'preferences', label: 'Preferences', description: 'Communication and notification settings' },
    { id: 'loyalty', label: 'Loyalty & Rewards', description: 'Points, coins, and referral history' },
    { id: 'consents', label: 'Consent Records', description: 'Your consent history and preferences' },
    { id: 'sessions', label: 'Login History', description: 'Device and session information' },
    { id: 'ai_personalization', label: 'AI Preferences', description: 'Personalization settings and recommendations' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [consentsResult, requestsResult] = await Promise.all([
        gdprApi.getConsents(),
        gdprApi.getDataRequests(),
      ]);
      setConsents(
        consentsResult.map((c) => ({
          type: c.consentType as Consent['type'],
          granted: c.granted,
          version: c.version,
          timestamp: c.grantedAt,
          withdrawalDate: c.withdrawnAt,
        }))
      );
      setDataRequests(
        requestsResult.map((r) => ({
          _id: r.requestId,
          type: 'export' as const,
          status: r.status === 'ready' ? 'completed' : r.status === 'failed' ? 'failed' : 'processing',
          requestedAt: r.requestedAt,
          completedAt: r.completedAt,
        }))
      );
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to load privacy data' });
    } finally {
      setLoading(false);
    }
  };

  const getConsentStatus = (type: string): boolean => {
    const consent = consents.find(c => c.type === type);
    return consent?.granted || false;
  };

  const getConsentVersion = (type: string): string | undefined => {
    const consent = consents.find(c => c.type === type);
    return consent?.version;
  };

  const updateConsent = async (type: string, granted: boolean) => {
    setSaving(true);
    try {
      const consentType = consentTypes.find(c => c.type === type);
      const version = consentType?.version || '1.0.0';

      await gdprApi.recordConsentDetailed({
        type,
        granted,
        version,
        method: 'web',
      });

      // Update local state
      setConsents(prev => {
        const existing = prev.find(c => c.type === type);
        if (existing) {
          return prev.map(c => c.type === type ? {
            ...c,
            granted,
            version,
            timestamp: new Date().toISOString()
          } : c);
        } else {
          return [...prev, {
            type: type as Consent['type'],
            granted,
            version,
            timestamp: new Date().toISOString()
          }];
        }
      });

      setNotification({
        type: 'success',
        message: granted
          ? `${consentType?.title || type} consent granted`
          : `${consentType?.title || type} consent withdrawn`
      });
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update consent'
      });
    } finally {
      setSaving(false);
    }
  };

  const requestDataExport = async () => {
    setSaving(true);
    try {
      const request = await gdprApi.requestExportWithOptions({
        exportFormat,
        exportDataTypes: selectedDataTypes,
      });

      const newRequest: DataRequest = {
        _id: request.requestId,
        type: 'export',
        status: 'pending',
        requestedAt: request.requestedAt || new Date().toISOString(),
      };
      setDataRequests(prev => [newRequest, ...prev]);
      setShowExportModal(false);

      setNotification({
        type: 'success',
        message: 'Data export request submitted. You will receive an email when ready.',
      });

      pollExportProgress(request.requestId);
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to request data export'
      });
    } finally {
      setSaving(false);
    }
  };

  const pollExportProgress = async (requestId: string) => {
    const poll = async () => {
      try {
        const status = await gdprApi.getExportStatus(requestId);
        setExportProgress({
          status: status.status === 'ready' ? 'completed' : status.status,
          progress: status.status === 'ready' ? 100 : status.status === 'processing' ? 50 : 0,
          currentStep: status.status,
          steps: [],
        });

        if (status.status === 'ready') {
          setNotification({
            type: 'success',
            message: 'Your data export is ready for download!',
          });
          loadData();
          return;
        }

        if (status.status === 'failed') {
          setNotification({
            type: 'error',
            message: 'Data export failed. Please try again.',
          });
          return;
        }

        setTimeout(poll, 2000);
      } catch {
        // Stop polling on error
      }
    };

    poll();
  };

  const requestAccountDeletion = async () => {
    if (!deletionReason.trim()) {
      setNotification({
        type: 'error',
        message: 'Please provide a reason for account deletion'
      });
      return;
    }

    setSaving(true);
    try {
      await gdprApi.requestAccountDeletion({
        deletionReason,
        confirmation: true,
      });

      setShowDeleteModal(false);
      setNotification({
        type: 'info',
        message: 'Your account deletion has been scheduled. You have 14 days to cancel before permanent deletion.'
      });

      loadData();
    } catch (error) {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to request account deletion'
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelDataRequest = async (requestId: string) => {
    try {
      await gdprApi.cancelDataRequest(requestId);
      setDataRequests(prev => prev.filter(r => r._id !== requestId));
      setNotification({
        type: 'success',
        message: 'Data request cancelled'
      });
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Failed to cancel request'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'processing': return 'Processing';
      case 'cancelled': return 'Cancelled';
      default: return 'Pending';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-nilin-coral animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading privacy settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-nilin-coral" />
            Privacy & Data Settings
          </h1>
          <p className="text-gray-600 mt-1">Manage your consent preferences and data rights</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            notification.type === 'success' ? 'bg-green-50 text-green-800' :
            notification.type === 'error' ? 'bg-red-50 text-red-800' :
            'bg-blue-50 text-blue-800'
          }`}>
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5 flex-shrink-0" />}
            {notification.type === 'info' && <Bell className="w-5 h-5 flex-shrink-0" />}
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Consent Management Section */}
        <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Check className="w-5 h-5 text-nilin-coral" />
            <h2 className="text-xl font-semibold text-gray-900">Consent Management</h2>
          </div>

          <div className="space-y-4">
            {consentTypes.map((consent) => {
              const isGranted = getConsentStatus(consent.type);
              const currentVersion = getConsentVersion(consent.type);
              const Icon = consent.icon;

              return (
                <div
                  key={consent.type}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isGranted
                      ? 'border-green-200 bg-green-50'
                      : consent.required
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      isGranted ? 'bg-green-100' : consent.required ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        isGranted ? 'text-green-600' : consent.required ? 'text-red-600' : 'text-gray-600'
                      }`} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{consent.title}</h3>
                        {consent.required && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Required
                          </span>
                        )}
                        {currentVersion && (
                          <span className="text-xs text-gray-500">v{currentVersion}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{consent.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {isGranted ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-green-700">Granted</span>
                          <button
                            onClick={() => updateConsent(consent.type, false)}
                            disabled={saving || consent.required}
                            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                              consent.required
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {saving ? 'Saving...' : 'Withdraw'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {consent.required ? 'Required' : 'Not granted'}
                          </span>
                          <button
                            onClick={() => updateConsent(consent.type, true)}
                            disabled={saving}
                            className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                          >
                            {saving ? 'Saving...' : 'Accept'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Your Privacy Rights</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Under GDPR, you have the right to access, correct, delete, and port your personal data.
                  You can exercise these rights at any time through the options below.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Export Section */}
        <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-nilin-coral" />
              <h2 className="text-xl font-semibold text-gray-900">Data Export</h2>
            </div>
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Request Export
            </button>
          </div>

          {/* Export Progress */}
          {exportProgress && exportProgress.status === 'processing' && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="font-medium text-blue-900">
                  Export in progress: {exportProgress.currentStep}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${exportProgress.progress}%` }}
                />
              </div>
              <p className="text-sm text-blue-700 mt-2">
                {exportProgress.progress}% complete
              </p>
            </div>
          )}

          {/* Data Requests List */}
          {dataRequests.filter(r => r.type === 'export').length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-700">Export Requests</h3>
              {dataRequests
                .filter(r => r.type === 'export')
                .map((request) => (
                  <div
                    key={request._id}
                    className="p-4 bg-gray-50 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(request.status)}
                      <div>
                        <p className="font-medium text-gray-900">
                          Data Export Request
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(request.requestedAt).toLocaleDateString()} at{' '}
                          {new Date(request.requestedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm px-2 py-1 rounded ${
                        request.status === 'completed' ? 'bg-green-100 text-green-700' :
                        request.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        request.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {getStatusLabel(request.status)}
                      </span>
                      {request.status === 'completed' && request.downloadUrl && (
                        <a
                          href={request.downloadUrl}
                          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download
                        </a>
                      )}
                      {request.status === 'pending' && (
                        <button
                          onClick={() => cancelDataRequest(request._id)}
                          className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Account Deletion Section */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900">Account Deletion</h2>
            </div>
          </div>

          <div className="p-4 bg-red-50 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900">Warning: Permanent Action</h4>
                <p className="text-sm text-red-700 mt-1">
                  Deleting your account will permanently remove all your data from our systems.
                  This action cannot be undone. You have a 14-day grace period to cancel
                  the deletion request.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <p className="text-sm text-gray-600">
              The following will be deleted:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
              <li>Your profile and personal information</li>
              <li>All booking history and reviews</li>
              <li>Loyalty points and referral data</li>
              <li>Notification preferences</li>
              <li>Session and device history</li>
            </ul>
            <p className="text-sm text-gray-600 mt-3">
              <strong>Note:</strong> Some data may be retained for legal compliance purposes
              (e.g., financial records for tax purposes).
            </p>
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Request Account Deletion
          </button>
        </section>

        {/* Footer Links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm">
          <a
            href="/privacy"
            className="text-nilin-coral hover:text-nilin-rose flex items-center gap-1"
            target="_blank"
          >
            Privacy Policy <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-gray-400">|</span>
          <a
            href="/terms"
            className="text-nilin-coral hover:text-nilin-rose flex items-center gap-1"
            target="_blank"
          >
            Terms of Service <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-gray-400">|</span>
          <a
            href="/cookies"
            className="text-nilin-coral hover:text-nilin-rose flex items-center gap-1"
            target="_blank"
          >
            Cookie Policy <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Data Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Request Data Export
              </h3>
              <p className="text-gray-600 mb-6">
                Select the data you want to export. The export will be prepared and
                you'll receive an email when it's ready for download.
              </p>

              {/* Format Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="json"
                      checked={exportFormat === 'json'}
                      onChange={() => setExportFormat('json')}
                      className="w-4 h-4 text-nilin-coral"
                    />
                    <span>JSON</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={() => setExportFormat('csv')}
                      className="w-4 h-4 text-nilin-coral"
                    />
                    <span>CSV</span>
                  </label>
                </div>
              </div>

              {/* Data Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data to Export
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {dataTypeOptions.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDataTypes.includes(option.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDataTypes([...selectedDataTypes, option.id]);
                          } else {
                            setSelectedDataTypes(selectedDataTypes.filter(id => id !== option.id));
                          }
                        }}
                        className="w-4 h-4 text-nilin-coral mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {option.label}
                        </span>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={requestDataExport}
                  disabled={saving || selectedDataTypes.length === 0}
                  className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Request Export
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Delete Account
                </h3>
              </div>

              <p className="text-gray-600 mb-4">
                Are you sure you want to delete your account? This action will:
              </p>

              <ul className="text-sm text-gray-600 space-y-1 mb-4 list-disc ml-4">
                <li>Permanently remove all your personal data</li>
                <li>Cancel all active bookings</li>
                <li>Forfeit any loyalty points</li>
                <li>Be irreversible after 14 days</li>
              </ul>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Please tell us why you're leaving (required)
                </label>
                <textarea
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  placeholder="Your feedback helps us improve..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletionReason('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={requestAccountDeletion}
                  disabled={saving || !deletionReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete My Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacySettings;
