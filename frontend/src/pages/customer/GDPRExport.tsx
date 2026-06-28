/**
 * GDPR Data Export Page
 * Allows customers to request, track, and download their personal data
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FileText,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Info,
  Calendar,
  HardDrive,
  ExternalLink,
  XCircle,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { gdprApi, type DataExportRequest, type ExportHistoryItem, type UserConsent } from '../../services/gdprApi';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getStatusConfig = (status: DataExportRequest['status']) => {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        color: 'bg-amber-100 text-amber-700',
        icon: Clock,
        description: 'Your export request is queued for processing',
      };
    case 'processing':
      return {
        label: 'Processing',
        color: 'bg-blue-100 text-blue-700',
        icon: Loader2,
        description: 'We are preparing your data for download',
      };
    case 'ready':
      return {
        label: 'Ready',
        color: 'bg-emerald-100 text-emerald-700',
        icon: CheckCircle,
        description: 'Your data is ready for download',
      };
    case 'expired':
      return {
        label: 'Expired',
        color: 'bg-gray-100 text-gray-600',
        icon: XCircle,
        description: 'This export has expired and is no longer available',
      };
    case 'failed':
      return {
        label: 'Failed',
        color: 'bg-red-100 text-red-700',
        icon: AlertCircle,
        description: 'Export failed. Please try again.',
      };
    default:
      return {
        label: 'Unknown',
        color: 'bg-gray-100 text-gray-600',
        icon: Info,
        description: 'Unknown status',
      };
  }
};

const GDPRExportPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  // Export state
  const [exportRequest, setExportRequest] = useState<DataExportRequest | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [consents, setConsents] = useState<UserConsent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [historyResult, consentsResult] = await Promise.all([
        gdprApi.getExportHistory().catch(() => []),
        gdprApi.getConsents().catch(() => []),
      ]);
      setExportHistory(historyResult);
      setConsents(consentsResult);

      // Find the latest pending/processing/ready export
      const latestActive = historyResult.find(
        (h) => h.status === 'pending' || h.status === 'processing' || h.status === 'ready'
      );
      if (latestActive) {
        const statusResult = await gdprApi.getExportStatus(latestActive.requestId).catch(() => null);
        if (statusResult) {
          setExportRequest(statusResult);
        }
      }
    } catch {
      toast.error('Failed to load GDPR data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?returnTo=/customer/gdpr');
      return;
    }
    loadData();
  }, [isAuthenticated, navigate, loadData]);

  // Poll for status updates when processing
  useEffect(() => {
    if (exportRequest?.status === 'pending' || exportRequest?.status === 'processing') {
      setIsPolling(true);
      pollingRef.current = setInterval(async () => {
        try {
          const status = await gdprApi.getExportStatus(exportRequest.requestId);
          setExportRequest(status);
          if (status.status !== 'pending' && status.status !== 'processing') {
            setIsPolling(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch {
          // Ignore polling errors
        }
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [exportRequest?.requestId, exportRequest?.status]);

  // Request new export
  const handleRequestExport = async () => {
    setIsRequesting(true);
    try {
      const request = await gdprApi.requestExport();
      setExportRequest(request);
      await loadData();
      toast.success('Export request submitted successfully');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Failed to request data export');
    } finally {
      setIsRequesting(false);
    }
  };

  // Download export
  const handleDownload = async () => {
    if (!exportRequest?.requestId) return;
    setIsDownloading(true);
    try {
      const blob = await gdprApi.downloadExport(exportRequest.requestId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homeservice-data-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download started');
    } catch {
      toast.error('Failed to download data');
    } finally {
      setIsDownloading(false);
    }
  };

  const activeConsents = consents.filter((c) => c.granted && !c.withdrawnAt);
  const withdrawnConsents = consents.filter((c) => !c.granted || c.withdrawnAt);

  return (
    <>
      <NavigationHeader />
      <main className="min-h-screen bg-nilin-blush/30 pb-20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Account', href: '/profile' },
              { label: 'Privacy & Data', current: true },
            ]}
          />

          {/* Header */}
          <div className="mt-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-nilin-coral/10 flex items-center justify-center">
                <Shield className="w-7 h-7 text-nilin-coral" />
              </div>
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal">Privacy & Data</h1>
                <p className="text-nilin-warmGray mt-1">
                  Manage your personal data, exports, and consent preferences
                </p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Your data, your rights</p>
              <p className="mt-1">
                Under GDPR and similar privacy regulations, you have the right to access, export,
                and delete your personal data. All data exports are processed securely and expire
                after 30 days.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Data Export Section */}
              <div className="bg-white rounded-2xl border border-nilin-border/50 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-nilin-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
                        <Download className="w-5 h-5 text-nilin-coral" />
                      </div>
                      <div>
                        <h2 className="text-lg font-serif text-nilin-charcoal">Data Export</h2>
                        <p className="text-sm text-nilin-warmGray">
                          Download a copy of all your personal data
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={loadData}
                      className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-nilin-blush/40 border border-nilin-border/30"
                      aria-label="Refresh export status"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Current Export Status */}
                  {exportRequest && (
                    <div className="mb-6 p-4 bg-nilin-muted/20 rounded-xl">
                      <div className="flex items-start gap-3">
                        {(() => {
                          const StatusIcon = getStatusConfig(exportRequest.status).icon;
                          return (
                            <StatusIcon
                              className={cn(
                                'w-5 h-5 flex-shrink-0 mt-0.5',
                                exportRequest.status === 'ready'
                                  ? 'text-emerald-600'
                                  : exportRequest.status === 'processing'
                                  ? 'text-blue-600 animate-spin'
                                  : 'text-amber-600'
                              )}
                            />
                          );
                        })()}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                getStatusConfig(exportRequest.status).color
                              )}
                            >
                              {getStatusConfig(exportRequest.status).label}
                            </span>
                            {isPolling && (
                              <span className="text-xs text-nilin-warmGray">Checking...</span>
                            )}
                          </div>
                          <p className="text-sm text-nilin-charcoal mt-1">
                            {getStatusConfig(exportRequest.status).description}
                          </p>
                          <div className="flex flex-wrap gap-4 mt-2 text-xs text-nilin-warmGray">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Requested: {formatDate(exportRequest.requestedAt)}
                            </span>
                            {exportRequest.completedAt && (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Completed: {formatDate(exportRequest.completedAt)}
                              </span>
                            )}
                            {exportRequest.expiresAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Expires: {formatDate(exportRequest.expiresAt)}
                              </span>
                            )}
                            {exportRequest.fileSize && (
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                {formatFileSize(exportRequest.fileSize)}
                              </span>
                            )}
                          </div>
                          {exportRequest.status === 'ready' && (
                            <button
                              type="button"
                              onClick={handleDownload}
                              disabled={isDownloading}
                              className="mt-4 btn-nilin flex items-center gap-2"
                            >
                              {isDownloading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              Download Data
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Request Export Button */}
                  {(!exportRequest || exportRequest.status === 'expired' || exportRequest.status === 'failed') && (
                    <div className="text-center py-4">
                      <p className="text-sm text-nilin-warmGray mb-4">
                        Your export will include all personal data we have about you, including:
                      </p>
                      <ul className="text-sm text-nilin-charcoal mb-6 space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          Profile and contact information
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          Booking history and transactions
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          Reviews and ratings you've given
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          Saved addresses and preferences
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          Chat history and support tickets
                        </li>
                      </ul>
                      <button
                        type="button"
                        onClick={handleRequestExport}
                        disabled={isRequesting}
                        className="btn-nilin flex items-center gap-2 mx-auto"
                      >
                        {isRequesting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                        Request Data Export
                      </button>
                      <p className="text-xs text-nilin-warmGray mt-3">
                        Exports are usually ready within a few minutes
                      </p>
                    </div>
                  )}

                  {/* Progress for pending/processing */}
                  {(exportRequest?.status === 'pending' || exportRequest?.status === 'processing') && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-nilin-warmGray mb-2">
                        <span>Preparing your data...</span>
                        <span>{exportRequest.status === 'processing' ? '50%' : '25%'}</span>
                      </div>
                      <div className="w-full h-2 bg-nilin-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            exportRequest.status === 'processing'
                              ? 'bg-blue-500 w-1/2'
                              : 'bg-amber-500 w-1/4'
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Export History */}
              {exportHistory.length > 0 && (
                <div className="bg-white rounded-2xl border border-nilin-border/50 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-nilin-border/30">
                    <h2 className="text-lg font-serif text-nilin-charcoal">Export History</h2>
                  </div>
                  <div className="divide-y divide-nilin-border/30">
                    {exportHistory.slice(0, 5).map((item) => {
                      const status = getStatusConfig(item.status);
                      const StatusIcon = status.icon;
                      return (
                        <div key={item.requestId} className="p-4 flex items-center gap-4">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center',
                              status.color
                            )}
                          >
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-nilin-charcoal">
                              Export Request
                            </p>
                            <p className="text-xs text-nilin-warmGray">
                              {formatDate(item.requestedAt)}
                              {item.completedAt && ` • Completed ${formatDate(item.completedAt)}`}
                              {item.expiresAt && ` • Expires ${formatDate(item.expiresAt)}`}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                              status.color
                            )}
                          >
                            {status.label}
                          </span>
                          {item.status === 'ready' && (
                            <button
                              type="button"
                              onClick={async () => {
                                setExportRequest({ ...item, status: 'ready' });
                                await handleDownload();
                              }}
                              disabled={isDownloading}
                              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-nilin-blush/40 border border-nilin-border/30"
                              aria-label="Download this export"
                            >
                              <Download className="w-4 h-4 text-nilin-coral" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Consent Overview */}
              <div className="bg-white rounded-2xl border border-nilin-border/50 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-nilin-border/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-serif text-nilin-charcoal">Consent Preferences</h2>
                      <p className="text-sm text-nilin-warmGray">
                        Your privacy consent choices
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-xl text-center">
                      <p className="text-2xl font-serif text-emerald-700">{activeConsents.length}</p>
                      <p className="text-sm text-emerald-600">Active Consents</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl text-center">
                      <p className="text-2xl font-serif text-gray-700">{withdrawnConsents.length}</p>
                      <p className="text-sm text-gray-600">Withdrawn</p>
                    </div>
                  </div>
                  {consents.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-nilin-warmGray mb-2">Recent consents:</p>
                      <ul className="space-y-1">
                        {consents.slice(0, 4).map((consent) => (
                          <li
                            key={consent.consentType}
                            className="flex items-center justify-between text-sm py-1"
                          >
                            <span className="text-nilin-charcoal capitalize">
                              {consent.consentType.replace(/-/g, ' ')}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                consent.granted && !consent.withdrawnAt
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-gray-100 text-gray-600'
                              )}
                            >
                              {consent.granted && !consent.withdrawnAt ? 'Granted' : 'Withdrawn'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <a
                    href="/customer/profile?tab=settings"
                    className="mt-4 inline-flex items-center gap-2 text-sm text-nilin-coral hover:underline"
                  >
                    Manage all preferences
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="bg-nilin-muted/30 rounded-2xl p-6 text-center">
                <p className="text-sm text-nilin-warmGray">
                  Your data is processed in accordance with our{' '}
                  <a href="/privacy" className="text-nilin-coral hover:underline">
                    Privacy Policy
                  </a>{' '}
                  and{' '}
                  <a href="/terms" className="text-nilin-coral hover:underline">
                    Terms of Service
                  </a>
                  .
                </p>
                <p className="text-xs text-nilin-warmGray mt-2">
                  For data deletion requests, please contact our support team or use the account
                  deletion feature in your profile settings.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default GDPRExportPage;
