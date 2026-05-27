
import React, { useState, useEffect } from 'react';
import {
  Download,
  FileJson,
  FileText,
  Check,
  X,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  HardDrive,
  Trash2,
  RefreshCw,
  ExternalLink,
  Shield,
  Info,
  Mail
} from 'lucide-react';
import { api } from '../services/api';

interface ExportRequest {
  _id: string;
  type: 'export' | 'deletion' | 'rectification' | 'portability';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  requestedAt: string;
  completedAt?: string;
  exportFormat?: 'json' | 'csv' | 'pdf';
  exportDataTypes?: string[];
  progress?: number;
  currentStep?: string;
  steps?: Array<{
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
  }>;
  downloadUrl?: string;
  downloadExpiry?: string;
  downloadCount?: number;
  errorMessage?: string;
}

interface ExportProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  steps: Array<{
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  }>;
  downloadUrl?: string;
  expiresAt?: string;
  errorMessage?: string;
}

const dataTypeOptions = [
  { id: 'profile', label: 'Profile Information', icon: '👤', description: 'Your account details, name, email, phone, and personal info' },
  { id: 'bookings', label: 'Booking History', icon: '📅', description: 'All service bookings, appointments, and related details' },
  { id: 'payments', label: 'Payment Records', icon: '💳', description: 'Transaction history, payment methods, and invoices' },
  { id: 'reviews', label: 'Reviews', icon: '⭐', description: 'Reviews you have written for services and providers' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️', description: 'Communication and notification settings' },
  { id: 'loyalty', label: 'Loyalty & Rewards', icon: '🎁', description: 'Points, coins, tier status, and referral history' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📦', description: 'Active and past subscription plans' },
  { id: 'disputes', label: 'Disputes', icon: '⚖️', description: 'Dispute records and resolutions' },
  { id: 'consents', label: 'Consent Records', icon: '✅', description: 'Your consent history and privacy preferences' },
  { id: 'sessions', label: 'Login History', icon: '🔐', description: 'Device and session information' },
  { id: 'ai_personalization', label: 'AI Preferences', icon: '🤖', description: 'Personalization settings and recommendations' },
  { id: 'support_tickets', label: 'Support Tickets', icon: '🎧', description: 'Help center requests and support history' }
];

const DataExport: React.FC = () => {
  const [requests, setRequests] = useState<ExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'csv'>('json');
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([
    'profile', 'bookings', 'payments', 'reviews', 'preferences'
  ]);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    // Poll for active requests
    const activeRequest = requests.find(r => r.status === 'pending' || r.status === 'processing');
    if (activeRequest && !pollingId) {
      setPollingId(activeRequest._id);
      pollProgress(activeRequest._id);
    }

    return () => {
      // Cleanup polling on unmount
    };
  }, [requests]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/gdpr/data-requests?type=export');
      if (response.data?.success) {
        setRequests(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load export requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const pollProgress = async (requestId: string) => {
    const poll = async () => {
      try {
        const response = await api.get(`/gdpr/export/${requestId}/progress`);
        if (response.data?.success) {
          const progress: ExportProgress = response.data.data;

          // Update local state with progress
          setRequests(prev => prev.map(r =>
            r._id === requestId ? {
              ...r,
              status: progress.status,
              progress: progress.progress,
              currentStep: progress.currentStep,
              steps: progress.steps,
              downloadUrl: progress.downloadUrl,
              errorMessage: progress.errorMessage
            } : r
          ));

          if (progress.status === 'completed' || progress.status === 'failed') {
            setPollingId(null);
            if (progress.status === 'completed') {
              setNotification({
                type: 'success',
                message: 'Your data export is ready for download!'
              });
            }
            loadRequests(); // Refresh full list
            return;
          }

          // Continue polling
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Failed to poll progress:', error);
        setPollingId(null);
      }
    };

    poll();
  };

  const submitExportRequest = async () => {
    if (selectedDataTypes.length === 0) {
      setNotification({
        type: 'error',
        message: 'Please select at least one data type to export'
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/gdpr/export', {
        exportFormat: selectedFormat,
        exportDataTypes: selectedDataTypes
      });

      if (response.data?.success) {
        const newRequest: ExportRequest = {
          _id: response.data.data.requestId,
          type: 'export',
          status: 'pending',
          requestedAt: new Date().toISOString(),
          exportFormat: selectedFormat,
          exportDataTypes: selectedDataTypes,
          progress: 0,
          steps: []
        };

        setRequests(prev => [newRequest, ...prev]);
        setShowNewRequestModal(false);
        setPollingId(newRequest._id);
        pollProgress(newRequest._id);

        setNotification({
          type: 'info',
          message: 'Your data export request has been submitted. Processing will begin shortly.'
        });
      }
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to submit export request'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      await api.delete(`/gdpr/data-requests/${requestId}`);
      setRequests(prev => prev.map(r =>
        r._id === requestId ? { ...r, status: 'cancelled' as const } : r
      ));
      setNotification({
        type: 'success',
        message: 'Export request cancelled'
      });
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Failed to cancel request'
      });
    }
  };

  const downloadExport = async (requestId: string) => {
    try {
      const response = await api.get(`/gdpr/export/${requestId}/download`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nilin-data-export-${new Date().toISOString().split('T')[0]}.${selectedFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setNotification({
        type: 'success',
        message: 'Download started successfully'
      });
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: 'Failed to download export. The link may have expired.'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatExpiry = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return 'Expired';
    } else if (diffDays === 1) {
      return 'Expires tomorrow';
    } else {
      return `Expires in ${diffDays} days`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-nilin-coral animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading export requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Download className="w-6 h-6 text-nilin-coral" />
                Data Export Center
              </h1>
              <p className="text-gray-600 mt-1">Download a copy of your data or manage export requests</p>
            </div>
            <button
              onClick={() => setShowNewRequestModal(true)}
              className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              New Export
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            notification.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5 flex-shrink-0" />}
            {notification.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
            <span className="flex-1">{notification.message}</span>
            <button onClick={() => setNotification(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* GDPR Info Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Your Right to Data Access
              </h2>
              <p className="text-gray-600 mb-4">
                Under GDPR Article 15, you have the right to obtain a copy of your personal data
                and information about how it is being processed. We provide this data in a
                machine-readable format for your convenience.
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Response within 30 days</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Download links expire in 7 days</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Compresses data automatically</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Export History */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Export History</h2>
          </div>

          {requests.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No export requests yet</h3>
              <p className="text-gray-500 mb-4">
                Request a copy of your data to download your personal information
              </p>
              <button
                onClick={() => setShowNewRequestModal(true)}
                className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Create Export Request
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {requests.map((request) => (
                <div key={request._id} className="p-6">
                  {/* Request Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {request.exportFormat === 'csv' ? (
                          <FileText className="w-5 h-5 text-gray-600" />
                        ) : (
                          <FileJson className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Data Export - {request.exportFormat?.toUpperCase()}
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {formatDate(request.requestedAt)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  {/* Progress Bar for Processing */}
                  {request.status === 'processing' && request.progress !== undefined && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">
                          {request.currentStep || 'Processing...'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {request.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${request.progress}%` }}
                        />
                      </div>
                      {request.steps && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                          {request.steps.map((step, index) => (
                            <div
                              key={index}
                              className={`text-xs px-2 py-1 rounded ${
                                step.status === 'completed' ? 'bg-green-100 text-green-700' :
                                step.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                step.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {step.status === 'completed' && <Check className="w-3 h-3 inline mr-1" />}
                              {step.status === 'processing' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                              {step.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Data Types */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-2">Data included:</p>
                    <div className="flex flex-wrap gap-2">
                      {request.exportDataTypes?.map((type) => {
                        const option = dataTypeOptions.find(o => o.id === type);
                        return (
                          <span
                            key={type}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            <span>{option?.icon}</span>
                            {option?.label || type}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Error Message */}
                  {request.status === 'failed' && request.errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                      <p className="text-sm text-red-700">{request.errorMessage}</p>
                    </div>
                  )}

                  {/* Download Info */}
                  {request.status === 'completed' && request.downloadUrl && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700">
                          Ready for download
                        </span>
                        {request.downloadExpiry && (
                          <span className="text-xs text-green-600">
                            ({formatExpiry(request.downloadExpiry)})
                          </span>
                        )}
                      </div>
                      {request.downloadCount !== undefined && request.downloadCount > 0 && (
                        <span className="text-xs text-green-600">
                          Downloaded {request.downloadCount} time{request.downloadCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {request.status === 'completed' && request.downloadUrl && (
                      <button
                        onClick={() => downloadExport(request._id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download Export
                      </button>
                    )}
                    {request.status === 'failed' && (
                      <button
                        onClick={() => {
                          setShowNewRequestModal(true);
                          if (request.exportDataTypes) {
                            setSelectedDataTypes(request.exportDataTypes);
                          }
                          if (request.exportFormat) {
                            setSelectedFormat(request.exportFormat as 'json' | 'csv');
                          }
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                      </button>
                    )}
                    {request.status === 'pending' && (
                      <button
                        onClick={() => cancelRequest(request._id)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 p-6 bg-gray-100 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Mail className="w-5 h-5 text-gray-600" />
            Need Help?
          </h3>
          <p className="text-gray-600 mb-4">
            If you have questions about your data or need assistance with a data export,
            please contact our privacy team.
          </p>
          <a
            href="mailto:privacy@nilin.com"
            className="text-nilin-coral hover:text-nilin-rose inline-flex items-center gap-1"
          >
            privacy@nilin.com <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* New Export Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Request Data Export
              </h3>
              <p className="text-gray-600 mb-6">
                Select the data you want to include in your export. We'll notify you when it's ready.
              </p>

              {/* Format Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedFormat('json')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedFormat === 'json'
                        ? 'border-nilin-coral bg-nilin-coral/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileJson className={`w-8 h-8 mb-2 ${
                      selectedFormat === 'json' ? 'text-nilin-coral' : 'text-gray-400'
                    }`} />
                    <p className="font-medium text-gray-900">JSON</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Machine-readable format, ideal for importing into other services
                    </p>
                  </button>
                  <button
                    onClick={() => setSelectedFormat('csv')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedFormat === 'csv'
                        ? 'border-nilin-coral bg-nilin-coral/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileText className={`w-8 h-8 mb-2 ${
                      selectedFormat === 'csv' ? 'text-nilin-coral' : 'text-gray-400'
                    }`} />
                    <p className="font-medium text-gray-900">CSV</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Spreadsheet format, opens in Excel and Google Sheets
                    </p>
                  </button>
                </div>
              </div>

              {/* Data Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Select Data to Export
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dataTypeOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (selectedDataTypes.includes(option.id)) {
                          setSelectedDataTypes(selectedDataTypes.filter(id => id !== option.id));
                        } else {
                          setSelectedDataTypes([...selectedDataTypes, option.id]);
                        }
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedDataTypes.includes(option.id)
                          ? 'border-nilin-coral bg-nilin-coral/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{option.icon}</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{option.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                        </div>
                        {selectedDataTypes.includes(option.id) && (
                          <Check className="w-5 h-5 text-nilin-coral flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Count */}
              <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{selectedDataTypes.length}</span> of{' '}
                  {dataTypeOptions.length} data types selected
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowNewRequestModal(false);
                    setSelectedDataTypes(['profile', 'bookings', 'payments', 'reviews', 'preferences']);
                    setSelectedFormat('json');
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitExportRequest}
                  disabled={submitting || selectedDataTypes.length === 0}
                  className="px-6 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Submitting...' : 'Submit Export Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataExport;
