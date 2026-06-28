import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { ExportDropdown } from '../../components/admin/ExportDropdown';
import {
  ProviderListPanel,
  ProviderKpiStrip,
  ProviderStatusBadge,
  getProviderDisplayName,
  getProviderSecondaryLine,
  type ProviderStatusCounts,
} from '../../components/admin/ProviderListPanel';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  TrendingUp,
  TrendingDown,
  FileText,
  Ban,
  RefreshCw,
  Star,
  MapPin,
  Phone,
  Mail,
  Building,
  Calendar,
  Check,
  X,
  CheckSquare,
  Square,
  Clock3,
  ShieldCheck,
  ShieldAlert,
  Activity,
  CreditCard,
  Briefcase,
  Globe,
  Zap,
  Layers,
  UserCheck,
  ChevronDown,
  Loader2,
  MessageSquare,
  Send,
  DollarSign,
  BarChart3,
  Package,
  Users,
  Eye,
  UserX,
} from 'lucide-react';
import {
  BulkActionToolbar,
  type BulkAction,
} from '../../components/admin/BulkActionToolbar';
import { withRetry } from '../../lib/errorHandler';
import { ActivityTimeline } from '../../components/admin/ActivityTimeline';
import type { Activity, ActivityType } from '../../types/activity';
import providerOpsApi from '../../services/providerOpsApi';
import type {
  ProviderWithUser,
  ProviderFilters,
  ProviderVerification,
  ProviderMetrics,
  FraudFlag,
  SLAMetrics,
  ProviderService,
  ProviderBooking,
  EarningsBreakdown,
} from '../../services/providerOpsApi';

// ============================================
// Types
// ============================================

const TAB_LABELS: Record<string, string> = {
  all: 'All',
  pending: 'Pending',
  in_progress: 'Under review',
  approved: 'Approved',
  suspended: 'Suspended',
  rejected: 'Rejected',
};

const VALID_TABS = new Set(Object.keys(TAB_LABELS));

function tabToApiStatus(tab: string): ProviderFilters['status'] | undefined {
  if (tab === 'all') return undefined;
  if (tab === 'in_progress') return 'under_review';
  return tab as ProviderFilters['status'];
}

function exportProvidersCsv(providers: ProviderWithUser[]) {
  const headers = ['Business Name', 'Email', 'Status', 'City', 'Quality', 'Reliability', 'Rating', 'Reviews'];
  const rows = providers.map((p) => [
    p.businessInfo?.businessName || '',
    typeof p.userId === 'object' ? p.userId?.email || '' : '',
    p.verificationStatus?.overall || '',
    p.locationInfo?.primaryAddress?.city || '',
    String(p.analytics?.performanceMetrics?.qualityScore ?? ''),
    String(p.analytics?.performanceMetrics?.punctualityScore ?? ''),
    String(p.reviewsData?.averageRating ?? ''),
    String(p.reviewsData?.totalReviews ?? 0),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `providers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// Helper Components (detail modal)
// ============================================

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  iconBg: string;
  iconColor: string;
}> = ({ title, value, subtitle, icon, trend, trendValue, iconBg, iconColor }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        {trendValue && (
          <div className={`flex items-center mt-2 text-sm font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
            {trend === 'up' && <TrendingUp className="w-4 h-4 mr-1" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4 mr-1" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${iconBg}`}>{icon}</div>
    </div>
  </div>
);

const ProgressRing: React.FC<{ value: number; size?: number; strokeWidth?: number; color?: string }> = ({
  value,
  size = 60,
  strokeWidth = 6,
  color = '#10b981'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-gray-700">{value}</span>
      </div>
    </div>
  );
};

const SeverityBadge: React.FC<{ severity: 'low' | 'medium' | 'high' | 'critical' }> = ({ severity }) => {
  const config = {
    low: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
    medium: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    high: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    critical: { bg: 'bg-red-600', text: 'text-white', border: 'border-red-600' },
  };
  const c = config[severity];
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-semibold capitalize ${c.bg} ${c.text} ${c.border} border`}>
      {severity}
    </span>
  );
};

// ============================================
// Provider Detail Component
// ============================================

const ProviderDetail: React.FC<{
  provider: ProviderWithUser;
  verification: ProviderVerification | null;
  metrics: ProviderMetrics | null;
  slaMetrics: SLAMetrics | null;
  fraudFlags: FraudFlag[];
  onClose: () => void;
  onApprove: (provider: any) => void;
  onReject: (provider: any, reason: string, notes: string) => void;
  onSuspend: (provider: ProviderWithUser, reason: string) => void;
  detailLoading?: boolean;
  lastUpdated?: Date | null;
  fraudRiskLevel?: string;
  lastFraudReport?: { riskScore: number; riskLevel: string; activityCount: number } | null;
  onResolveFraudFlag: (provider: ProviderWithUser, flagId: string, resolution: string) => void;
  onReactivate: (provider: any) => void;
  onVerifyDocument: (provider: ProviderWithUser, docId: string, verified: boolean, notes?: string) => void;
  onRunFraudCheck: (provider: ProviderWithUser) => void;
  onSendMessage?: (providerId: string, message: string, subject?: string) => Promise<void>;
  services?: ProviderService[];
  bookings?: ProviderBooking[];
  earnings?: EarningsBreakdown | null;
  onLoadServices?: (providerId: string) => void;
  onLoadBookings?: (providerId: string, filters?: any) => void;
  onLoadEarnings?: (providerId: string) => void;
  servicesLoading?: boolean;
  bookingsLoading?: boolean;
  earningsLoading?: boolean;
}> = ({
  provider,
  verification,
  metrics,
  slaMetrics,
  fraudFlags,
  detailLoading = false,
  lastUpdated,
  fraudRiskLevel,
  lastFraudReport,
  onClose,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
  onVerifyDocument,
  onRunFraudCheck,
  onSendMessage,
  services,
  bookings,
  earnings,
  onLoadServices,
  onLoadBookings,
  onLoadEarnings,
  servicesLoading = false,
  bookingsLoading = false,
  earningsLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'sla' | 'fraud' | 'services' | 'bookings' | 'earnings' | 'activity'>('overview');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showRejectDocModal, setShowRejectDocModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [suspendNotes, setSuspendNotes] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [resolveFlagId, setResolveFlagId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedService, setSelectedService] = useState<ProviderService | null>(null);
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');
  const [bookingPage, setBookingPage] = useState(1);

  // Get provider user ID helper
  const getProviderUserId = (): string => {
    const uid = provider.userId;
    if (typeof uid === 'string') return uid;
    return uid?._id ?? '';
  };

  // Load data when tabs change
  useEffect(() => {
    const providerId = getProviderUserId();
    if (!providerId) return;

    if (activeTab === 'services' && onLoadServices && !services?.length) {
      onLoadServices(providerId);
    }
    if (activeTab === 'bookings' && onLoadBookings && !bookings?.length) {
      onLoadBookings(providerId);
    }
    if (activeTab === 'earnings' && onLoadEarnings && !earnings) {
      onLoadEarnings(providerId);
    }
  }, [activeTab, onLoadServices, onLoadBookings, onLoadEarnings, services?.length, bookings?.length, earnings, provider]);

  const accountStatus =
    typeof provider.userId === 'object' ? provider.userId?.accountStatus : undefined;
  const profileOverall = provider.verificationStatus?.overall || 'pending';
  const verificationStatus = verification?.status;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'services', label: 'Services', icon: <Package className="w-4 h-4" /> },
    { id: 'bookings', label: 'Bookings', icon: <Calendar className="w-4 h-4" /> },
    { id: 'earnings', label: 'Earnings', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'sla', label: 'Performance', icon: <Activity className="w-4 h-4" /> },
    { id: 'fraud', label: 'Security', icon: <ShieldAlert className="w-4 h-4" />, badge: fraudFlags.length },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
  ];

  const documentTypes: Record<string, { label: string; icon: React.ReactNode }> = {
    id_card: { label: 'ID Card', icon: <CreditCard className="w-5 h-5" /> },
    passport: { label: 'Passport', icon: <Globe className="w-5 h-5" /> },
    business_license: { label: 'Business License', icon: <Briefcase className="w-5 h-5" /> },
    address_proof: { label: 'Address Proof', icon: <MapPin className="w-5 h-5" /> },
    tax_certificate: { label: 'Tax Certificate', icon: <FileText className="w-5 h-5" /> },
    insurance: { label: 'Insurance', icon: <Shield className="w-5 h-5" /> },
  };

  const kycLevels = ['basic', 'standard', 'enhanced'];
  const currentKycLevel = verification?.kycLevel || 'basic';
  const kycLevelIndex = kycLevels.indexOf(currentKycLevel);
  const docCount = verification?.documents?.length ?? 0;
  const verifiedDocCount = verification?.documents?.filter((d) => d.verified).length ?? 0;
  const approvedWithoutDocs = profileOverall === 'approved' && !!verification && docCount === 0;
  const awaitingDocUpload = !!verification && docCount === 0 && !approvedWithoutDocs;
  const displayName = getProviderDisplayName(provider);
  const secondaryLine = getProviderSecondaryLine(provider);
  const providerEmail = typeof provider.userId === 'object' ? provider.userId?.email : '';
  const slaHasData = (() => {
    if (!slaMetrics?.responseTime) return false;
    if (slaMetrics.hasInsufficientData === true) return false;
    if (slaMetrics.periodBookingCount === 0) return false;
    if (slaMetrics.periodBookingCount !== undefined && slaMetrics.periodBookingCount > 0) {
      return true;
    }
    const acc = slaMetrics.bookingAcceptanceRate;
    const comp = slaMetrics.completionRate;
    const noAcceptanceActivity = (acc?.accepted ?? 0) + (acc?.rejected ?? 0) === 0;
    const noCompletionActivity =
      (comp?.completed ?? 0) + (comp?.cancelled ?? 0) + (comp?.noShow ?? 0) === 0;
    if (noAcceptanceActivity && noCompletionActivity && (acc?.rate ?? 0) >= 100) {
      return false;
    }
    return true;
  })();
  const totalBookings = metrics?.totalBookings ?? 0;
  const completionPct =
    totalBookings > 0
      ? Math.round(((metrics?.completedBookings || 0) / totalBookings) * 100)
      : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Enhanced Header */}
        <div className="relative bg-gradient-to-r from-nilin-coral/5 via-nilin-rose/5 to-transparent p-6 border-b border-gray-100">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nilin-coral via-nilin-rose to-nilin-coral/50"></div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-nilin-coral to-nilin-rose p-0.5 shadow-lg">
                  <div className="w-full h-full rounded-xl bg-white flex items-center justify-center overflow-hidden">
                    {provider.instagramStyleProfile?.profilePhoto ? (
                      <img
                        src={provider.instagramStyleProfile.profilePhoto}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building className="w-10 h-10 text-nilin-coral" />
                    )}
                  </div>
                </div>
                {provider.instagramStyleProfile?.isVerified && (
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center ring-4 ring-white shadow-lg">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{displayName}</h2>
                <p className="text-gray-500 flex items-center gap-2 mt-1">
                  {providerEmail && secondaryLine === providerEmail ? (
                    <>
                      <Mail className="w-4 h-4 shrink-0" />
                      {providerEmail}
                    </>
                  ) : (
                    <span>{secondaryLine}</span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <ProviderStatusBadge status={provider.verificationStatus?.overall || 'pending'} size="md" />
                  <span className="text-gray-300">|</span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Joined {new Date(provider.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                  {lastUpdated && (
                    <span className="text-gray-300">|</span>
                  )}
                  {lastUpdated && (
                    <span className="text-xs text-gray-400">
                      Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close provider details"
              className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Enhanced Tabs */}
        <div role="tablist" aria-label="Provider details tabs" className="flex bg-gray-50 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`provider-tab-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                activeTab === tab.id
                  ? 'border-nilin-coral text-nilin-coral bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          {detailLoading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <div className="w-10 h-10 rounded-full border-4 border-nilin-border border-t-nilin-coral animate-spin" />
            </div>
          )}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  title="Quality Score"
                  value={metrics?.qualityScore || 0}
                  subtitle="out of 100"
                  icon={<Zap className="w-5 h-5 text-amber-500" />}
                  iconBg="bg-amber-50"
                  iconColor="text-amber-500"
                />
                <MetricCard
                  title="Reliability Score"
                  value={metrics?.reliabilityScore || 0}
                  subtitle="out of 100"
                  icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-500"
                />
                <MetricCard
                  title="Avg Rating"
                  value={metrics?.avgRating?.toFixed(1) || '0.0'}
                  subtitle={`${metrics?.totalBookings || 0} total bookings`}
                  icon={<Star className="w-5 h-5 text-amber-500" />}
                  iconBg="bg-amber-50"
                  iconColor="text-amber-500"
                />
                <MetricCard
                  title="Completion Rate"
                  value={completionPct !== null ? `${completionPct}%` : 'N/A'}
                  subtitle={
                    totalBookings > 0
                      ? `${metrics?.completedBookings || 0} completed`
                      : 'No bookings yet'
                  }
                  icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contact Info */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-nilin-coral" />
                    Contact Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                      <span className="text-gray-500 text-sm">Email</span>
                      <span className="font-medium text-gray-900">{provider.userId?.email}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                      <span className="text-gray-500 text-sm">Phone</span>
                      <span className="font-medium text-gray-900">{provider.userId?.phone || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                      <span className="text-gray-500 text-sm">Location</span>
                      <span className="font-medium text-gray-900">
                        {[provider.locationInfo?.primaryAddress?.city, provider.locationInfo?.primaryAddress?.state]
                          .filter(Boolean)
                          .join(', ') || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl">
                      <span className="text-gray-500 text-sm">Member Since</span>
                      <span className="font-medium text-gray-900">
                        {new Date(provider.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Enhanced KYC Status */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-nilin-coral" />
                    KYC Verification
                  </h3>
                  {!verification ? (
                    <div className="flex items-center gap-4 py-2">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                        <Shield className="w-9 h-9 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-900">No verification record</p>
                        <p className="text-sm text-gray-500">Provider has not started KYC submission</p>
                      </div>
                    </div>
                  ) : approvedWithoutDocs ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-sky-100 flex items-center justify-center">
                          <ShieldCheck className="w-9 h-9 text-sky-600" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-gray-900">Approved by admin</p>
                          <p className="text-sm text-gray-500">Account active without uploaded KYC files</p>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-sky-50 border border-sky-100 text-sm text-sky-800">
                        Verification record exists with no documents on file. Review the Documents tab before
                        changing status.
                      </div>
                    </div>
                  ) : awaitingDocUpload ? (
                    <div className="flex items-center gap-4 py-2">
                      <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center">
                        <Clock3 className="w-9 h-9 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-900">Awaiting document upload</p>
                        <p className="text-sm text-gray-500 capitalize">
                          Level: {verification.kycLevel || 'basic'} · Score not calculated until files are submitted
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-6 mb-6">
                        <ProgressRing value={verification.kycScore ?? 0} size={80} strokeWidth={8} />
                        <div>
                          <p className="text-2xl font-bold text-gray-900 capitalize">{verification.kycLevel || 'basic'}</p>
                          <p className="text-sm text-gray-500">Verification Level</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {kycLevels.map((level, idx) => (
                          <div key={level} className="flex items-center gap-2 flex-1">
                            <div
                              className={`h-2 flex-1 rounded-full ${
                                idx <= kycLevelIndex ? 'bg-emerald-500' : 'bg-gray-200'
                              }`}
                            />
                            <span
                              className={`text-xs font-medium ${
                                idx <= kycLevelIndex ? 'text-emerald-600' : 'text-gray-400'
                              } capitalize`}
                            >
                              {level}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {verification && docCount > 0 && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                      {verifiedDocCount} of {docCount} documents verified
                    </div>
                  )}
                </div>

                {/* Booking Stats */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-nilin-coral" />
                    Booking Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-100">
                      <p className="text-3xl font-bold text-gray-900">{metrics?.totalBookings || 0}</p>
                      <p className="text-sm text-gray-500">Total Bookings</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <p className="text-3xl font-bold text-emerald-600">{metrics?.completedBookings || 0}</p>
                      <p className="text-sm text-emerald-600">Completed</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="text-3xl font-bold text-red-600">{metrics?.cancelledBookings || 0}</p>
                      <p className="text-sm text-red-600">Cancelled</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <p className="text-3xl font-bold text-amber-600">{metrics?.noShows || 0}</p>
                      <p className="text-sm text-amber-600">No Shows</p>
                    </div>
                  </div>
                </div>

                {/* Response Time */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-nilin-coral" />
                    Performance
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Avg Response Time</span>
                        <span className="font-semibold text-gray-900">{metrics?.avgResponseTime || 0} min</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${(metrics?.avgResponseTime || 0) <= 30 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, (metrics?.avgResponseTime || 0) / 2)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Acceptance Rate</span>
                        <span className="font-semibold text-gray-900">{metrics?.acceptanceRate || 0}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${(metrics?.acceptanceRate || 0) >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${metrics?.acceptanceRate || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Submitted Documents</h3>
                <span className="text-sm text-gray-500">
                  {verification?.documents?.filter(d => d.verified).length || 0} of {verification?.documents?.length || 0} verified
                </span>
              </div>
              {!verification ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No verification record submitted yet</p>
                </div>
              ) : verification.documents && verification.documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {verification.documents.map((doc) => (
                    <div key={doc._id} className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            doc.verified ? 'bg-emerald-100 text-emerald-600' :
                            doc.rejectionReason ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {documentTypes[doc.type]?.icon || <FileText className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{documentTypes[doc.type]?.label || doc.type}</p>
                            <p className="text-xs text-gray-500">
                              Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <ProviderStatusBadge
                          status={doc.verified ? 'approved' : doc.rejectionReason ? 'rejected' : 'pending'}
                          size="sm"
                        />
                      </div>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-nilin-coral hover:underline mb-3 inline-block"
                        >
                          View document
                        </a>
                      )}
                      {doc.rejectionReason && (
                        <div className="p-3 bg-red-50 rounded-xl mb-4">
                          <p className="text-sm text-red-700 font-medium">Rejection Reason:</p>
                          <p className="text-sm text-red-600">{doc.rejectionReason}</p>
                        </div>
                      )}
                      {!doc.verified &&
                        !doc.rejectionReason &&
                        ['pending', 'in_progress'].includes(verificationStatus || '') && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => onVerifyDocument(provider, doc._id, true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Verify
                          </button>
                          <button
                            onClick={() => {
                              setRejectDocId(doc._id);
                              setShowRejectDocModal(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : approvedWithoutDocs ? (
                <div className="text-center py-12 bg-sky-50 rounded-2xl border border-sky-100">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-sky-500" />
                  <p className="text-gray-900 font-medium">Approved without uploaded documents</p>
                  <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                    A verification record exists, but no files were submitted. This provider was approved through
                    admin review.
                  </p>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No documents submitted yet</p>
                  <p className="text-sm text-gray-400 mt-1">Uploads will appear here once the provider submits KYC files</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sla' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-900">SLA Compliance Metrics</h3>
              <p className="text-sm text-gray-500 -mt-4">Last 30 days</p>
              {slaHasData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          slaMetrics.responseTime.compliant ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                          <Clock className={`w-6 h-6 ${slaMetrics.responseTime.compliant ? 'text-emerald-600' : 'text-red-600'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Response Time</p>
                          <p className="text-xs text-gray-500">SLA Target: {slaMetrics.responseTime.targetMinutes} min</p>
                        </div>
                      </div>
                      {slaMetrics.responseTime.compliant ? (
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <div className="text-center mb-4">
                      <p className="text-4xl font-bold text-gray-900">{slaMetrics.responseTime.avgMinutes}</p>
                      <p className="text-sm text-gray-500">minutes average</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">P95 Response</span>
                        <span className="font-medium">{slaMetrics.responseTime.p95Minutes} min</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          slaMetrics.bookingAcceptanceRate?.compliant ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                          <CheckSquare className={`w-6 h-6 ${slaMetrics.bookingAcceptanceRate?.compliant ? 'text-emerald-600' : 'text-red-600'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Acceptance Rate</p>
                          <p className="text-xs text-gray-500">Target: {slaMetrics.bookingAcceptanceRate?.targetPercentage}%</p>
                        </div>
                      </div>
                      {slaMetrics.bookingAcceptanceRate?.compliant ? (
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <div className="text-center mb-4">
                      <p className="text-4xl font-bold text-gray-900">{slaMetrics.bookingAcceptanceRate?.rate}%</p>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full ${slaMetrics.bookingAcceptanceRate?.compliant ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${slaMetrics.bookingAcceptanceRate?.rate || 0}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-center p-2 bg-emerald-50 rounded-lg">
                        <p className="font-bold text-emerald-600">{slaMetrics.bookingAcceptanceRate?.accepted || 0}</p>
                        <p className="text-xs text-emerald-600">Accepted</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded-lg">
                        <p className="font-bold text-red-600">{slaMetrics.bookingAcceptanceRate?.rejected || 0}</p>
                        <p className="text-xs text-red-600">Rejected</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          slaMetrics.completionRate?.compliant ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                          <Activity className={`w-6 h-6 ${slaMetrics.completionRate?.compliant ? 'text-emerald-600' : 'text-red-600'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Completion Rate</p>
                          <p className="text-xs text-gray-500">Target: {slaMetrics.completionRate?.targetPercentage}%</p>
                        </div>
                      </div>
                      {slaMetrics.completionRate?.compliant ? (
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <div className="text-center mb-4">
                      <p className="text-4xl font-bold text-gray-900">{slaMetrics.completionRate?.rate}%</p>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full ${slaMetrics.completionRate?.compliant ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${slaMetrics.completionRate?.rate || 0}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center p-2 bg-emerald-50 rounded-lg">
                        <p className="font-bold text-emerald-600">{slaMetrics.completionRate?.completed || 0}</p>
                        <p className="text-xs text-emerald-600">Done</p>
                      </div>
                      <div className="text-center p-2 bg-amber-50 rounded-lg">
                        <p className="font-bold text-amber-600">{slaMetrics.completionRate?.cancelled || 0}</p>
                        <p className="text-xs text-amber-600">Cancelled</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded-lg">
                        <p className="font-bold text-red-600">{slaMetrics.completionRate?.noShow || 0}</p>
                        <p className="text-xs text-red-600">No Show</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-900 font-medium">No bookings in the last 30 days</p>
                  <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                    SLA compliance (response time, acceptance, and completion) is calculated from booking activity in
                    this window. Metrics will appear once the provider receives bookings.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'fraud' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Fraud Detection & Security</h3>
                  {fraudRiskLevel && (
                    <p className="text-sm text-nilin-warmGray mt-1">
                      Risk level: <span className="font-semibold text-nilin-charcoal capitalize">{fraudRiskLevel}</span>
                    </p>
                  )}
                  {lastFraudReport && (
                    <p className="text-xs text-nilin-warmGray mt-1">
                      Last check: score {lastFraudReport.riskScore} ({lastFraudReport.riskLevel}) ·{' '}
                      {lastFraudReport.activityCount} finding(s)
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRunFraudCheck(provider)}
                  className="px-4 py-2.5 bg-nilin-coral text-white text-sm font-medium rounded-xl hover:bg-nilin-rose flex items-center gap-2 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Run Check
                </button>
              </div>
              {fraudFlags.length > 0 ? (
                <div className="space-y-4">
                  {fraudFlags.map((flag) => (
                    <div
                      key={flag._id}
                      className={`rounded-2xl p-5 border ${
                        flag.severity === 'critical'
                          ? 'bg-red-50 border-red-200'
                          : flag.severity === 'high'
                          ? 'bg-orange-50 border-orange-200'
                          : flag.severity === 'medium'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            flag.severity === 'critical' ? 'bg-red-100' :
                            flag.severity === 'high' ? 'bg-orange-100' :
                            flag.severity === 'medium' ? 'bg-amber-100' : 'bg-yellow-100'
                          }`}>
                            <AlertTriangle className={`w-6 h-6 ${
                              flag.severity === 'critical' ? 'text-red-600' :
                              flag.severity === 'high' ? 'text-orange-600' :
                              flag.severity === 'medium' ? 'text-amber-600' : 'text-yellow-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 capitalize">
                              {flag.type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              Detected: {new Date(flag.detectedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <SeverityBadge severity={flag.severity} />
                          <button
                            type="button"
                            onClick={() => setResolveFlagId(flag._id)}
                            className="text-xs font-medium text-nilin-coral hover:underline"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-emerald-600" />
                  </div>
                  <p className="text-emerald-700 font-semibold">All Clear!</p>
                  <p className="text-emerald-600 text-sm mt-1">No fraud flags detected for this provider</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Activity History</h3>
              </div>
              <ActivityTimeline
                activities={[]}
                loading={false}
                emptyMessage="No activity recorded for this provider"
              />
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Provider Services</h3>
                <span className="text-sm text-gray-500">
                  {services?.length || 0} services
                </span>
              </div>
              {servicesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-nilin-coral" />
                </div>
              ) : services && services.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {services.map((service) => (
                    <div
                      key={service._id}
                      className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedService(service)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
                            <Package className="w-6 h-6 text-nilin-coral" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{service.name}</p>
                            <p className="text-xs text-gray-500">{service.category}</p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          service.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          service.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                          service.status === 'inactive' ? 'bg-amber-100 text-amber-700' :
                          service.status === 'pending_review' ? 'bg-sky-100 text-sky-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {service.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-900 font-semibold">
                          {service.price.currency} {service.price.amount.toFixed(2)}
                        </span>
                        <span className="text-gray-500">
                          {service.duration} {service.durationUnit}
                        </span>
                        {service.rating && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Star className="w-4 h-4" />
                            {service.rating.average.toFixed(1)} ({service.rating.count})
                          </span>
                        )}
                      </div>
                      {service.tags && service.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {service.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                          {service.tags.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              +{service.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No services found for this provider</p>
                </div>
              )}

              {/* Service Detail Modal */}
              {selectedService && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">{selectedService.name}</h3>
                        <button
                          onClick={() => setSelectedService(null)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-xl">
                          <p className="text-xs text-gray-500">Category</p>
                          <p className="font-medium text-gray-900">{selectedService.category}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl">
                          <p className="text-xs text-gray-500">Status</p>
                          <p className="font-medium capitalize">{selectedService.status.replace('_', ' ')}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl">
                          <p className="text-xs text-gray-500">Price</p>
                          <p className="font-medium text-gray-900">
                            {selectedService.price.currency} {selectedService.price.amount.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl">
                          <p className="text-xs text-gray-500">Duration</p>
                          <p className="font-medium text-gray-900">
                            {selectedService.duration} {selectedService.durationUnit}
                          </p>
                        </div>
                      </div>
                      {selectedService.shortDescription && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Short Description</p>
                          <p className="text-sm text-gray-700">{selectedService.shortDescription}</p>
                        </div>
                      )}
                      {selectedService.description && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Full Description</p>
                          <p className="text-sm text-gray-700">{selectedService.description}</p>
                        </div>
                      )}
                      {selectedService.rating && (
                        <div className="flex items-center gap-2">
                          <Star className="w-5 h-5 text-amber-500" />
                          <span className="font-medium">{selectedService.rating.average.toFixed(1)}</span>
                          <span className="text-gray-500">({selectedService.rating.count} reviews)</span>
                        </div>
                      )}
                      {selectedService.tags && selectedService.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedService.tags.map((tag, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        Created: {new Date(selectedService.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-semibold text-gray-900">Booking History</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={bookingStatusFilter}
                    onChange={(e) => {
                      setBookingStatusFilter(e.target.value);
                      setBookingPage(1);
                      if (onLoadBookings) {
                        onLoadBookings(getProviderUserId(), {
                          status: e.target.value === 'all' ? undefined : e.target.value,
                          page: 1,
                        });
                      }
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/25"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No Show</option>
                  </select>
                </div>
              </div>
              {bookingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-nilin-coral" />
                </div>
              ) : bookings && bookings.length > 0 ? (
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <div
                      key={booking._id}
                      className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 border border-gray-100 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            booking.status === 'completed' ? 'bg-emerald-100' :
                            booking.status === 'cancelled' ? 'bg-red-100' :
                            booking.status === 'no_show' ? 'bg-amber-100' :
                            booking.status === 'in_progress' ? 'bg-sky-100' :
                            'bg-gray-100'
                          }`}>
                            <Calendar className={`w-5 h-5 ${
                              booking.status === 'completed' ? 'text-emerald-600' :
                              booking.status === 'cancelled' ? 'text-red-600' :
                              booking.status === 'no_show' ? 'text-amber-600' :
                              booking.status === 'in_progress' ? 'text-sky-600' :
                              'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {typeof booking.serviceId === 'object' ? booking.serviceId.name : 'Service'}
                            </p>
                            <p className="text-sm text-gray-500">
                              Customer: {typeof booking.customerId === 'object' ?
                                `${booking.customerId.firstName} ${booking.customerId.lastName}` : 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            booking.status === 'no_show' ? 'bg-amber-100 text-amber-700' :
                            booking.status === 'in_progress' ? 'bg-sky-100 text-sky-700' :
                            booking.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {booking.status.replace('_', ' ')}
                          </span>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {booking.totalAmount.currency} {booking.totalAmount.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(booking.scheduledDate).toLocaleDateString()}
                        </span>
                        <span>{booking.scheduledTime}</span>
                        {booking.completedAt && (
                          <span className="text-emerald-600">
                            Completed: {new Date(booking.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {booking.cancellationReason && (
                        <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                          Reason: {booking.cancellationReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No bookings found for this provider</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'earnings' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Earnings Overview</h3>
              </div>
              {earningsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-nilin-coral" />
                </div>
              ) : earnings ? (
                <div className="space-y-6">
                  {/* Total Earnings Card */}
                  <div className="bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10 rounded-2xl p-6 border border-nilin-coral/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Total Earnings</p>
                        <p className="text-4xl font-bold text-gray-900 mt-1">
                          {earnings.currency} {earnings.totalEarnings.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(earnings.period.start).toLocaleDateString()} - {new Date(earnings.period.end).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                        <DollarSign className="w-8 h-8 text-nilin-coral" />
                      </div>
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                      <p className="text-sm text-emerald-600 font-medium">Completed</p>
                      <p className="text-2xl font-bold text-emerald-700 mt-1">
                        {earnings.currency} {earnings.byStatus.completed.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <p className="text-sm text-amber-600 font-medium">Pending</p>
                      <p className="text-2xl font-bold text-amber-700 mt-1">
                        {earnings.currency} {earnings.byStatus.pending.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <p className="text-sm text-blue-600 font-medium">Withdrawn</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {earnings.currency} {earnings.byStatus.withdrawn.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Earnings by Service */}
                  {earnings.byService && earnings.byService.length > 0 && (
                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-nilin-coral" />
                        Earnings by Service
                      </h4>
                      <div className="space-y-3">
                        {earnings.byService.map((service, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-nilin-coral/10 flex items-center justify-center">
                                <Package className="w-4 h-4 text-nilin-coral" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{service.serviceName}</p>
                                <p className="text-xs text-gray-500">{service.bookingsCount} bookings</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                {earnings.currency} {service.amount.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">{service.percentage.toFixed(1)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Platform Fees */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Platform Fees</p>
                        <p className="font-semibold text-gray-900 mt-1">
                          {earnings.currency} {earnings.platformFees.total.toFixed(2)}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm">
                        {earnings.platformFees.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Period Chart (simplified table) */}
                  {earnings.byPeriod && earnings.byPeriod.length > 0 && (
                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                      <h4 className="font-semibold text-gray-900 mb-4">Earnings Over Time</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                              <th className="pb-2">Period</th>
                              <th className="pb-2 text-right">Amount</th>
                              <th className="pb-2 text-right">Bookings</th>
                            </tr>
                          </thead>
                          <tbody>
                            {earnings.byPeriod.map((period, idx) => (
                              <tr key={idx} className="border-b border-gray-100 last:border-0">
                                <td className="py-2 text-sm text-gray-700">{period.period}</td>
                                <td className="py-2 text-sm text-right font-medium text-gray-900">
                                  {earnings.currency} {period.amount.toFixed(2)}
                                </td>
                                <td className="py-2 text-sm text-right text-gray-500">{period.bookingsCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No earnings data available</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Enhanced Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            {['pending', 'in_progress'].includes(profileOverall) && (
              <>
                <button
                  onClick={() => onApprove(provider)}
                  className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <CheckCircle className="w-5 h-5" />
                  Approve Provider
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <XCircle className="w-5 h-5" />
                  Reject
                </button>
              </>
            )}
            {(['approved', 'verified'].includes(profileOverall) ||
              (accountStatus === 'active' && verificationStatus === 'verified')) && (
              <button
                onClick={() => {
                  setSuspendNotes('');
                  setShowSuspendModal(true);
                }}
                className="px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 flex items-center gap-2 transition-colors shadow-sm"
              >
                <Ban className="w-5 h-5" />
                Suspend Provider
              </button>
            )}
            {(profileOverall === 'suspended' ||
              (accountStatus === 'suspended' && verificationStatus === 'suspended')) && (
              <button
                onClick={() => onReactivate(provider)}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-colors shadow-sm"
              >
                <RefreshCw className="w-5 h-5" />
                Reactivate Provider
              </button>
            )}
            {onSendMessage && (
              <button
                onClick={() => setShowMessageModal(true)}
                className="px-5 py-2.5 bg-nilin-coral text-white text-sm font-medium rounded-xl hover:bg-nilin-rose flex items-center gap-2 transition-colors shadow-sm"
              >
                <MessageSquare className="w-5 h-5" />
                Send Message
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-nilin-coral" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Send Message</h3>
                    <p className="text-sm text-gray-500">To: {getProviderDisplayName(provider)}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMessageModal(false);
                    setMessageContent('');
                    setMessageSubject('');
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject (optional)</label>
                <input
                  type="text"
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  placeholder="Message subject..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-nilin-coral/25 focus:border-nilin-coral/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={5}
                  placeholder="Type your message to the provider..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-nilin-coral/25 focus:border-nilin-coral/40 transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setMessageContent('');
                  setMessageSubject('');
                }}
                className="flex-1 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!messageContent.trim()) return;
                  setSendingMessage(true);
                  try {
                    await onSendMessage(getProviderUserId(), messageContent, messageSubject);
                    toast.success('Message sent successfully');
                    setShowMessageModal(false);
                    setMessageContent('');
                    setMessageSubject('');
                  } catch (error) {
                    toast.error('Failed to send message');
                  } finally {
                    setSendingMessage(false);
                  }
                }}
                disabled={!messageContent.trim() || sendingMessage}
                className="flex-1 px-4 py-2.5 bg-nilin-coral text-white text-sm font-medium rounded-xl hover:bg-nilin-rose disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {sendingMessage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Reject Provider</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Select a reason</option>
                  <option value="incomplete-documentation">Incomplete Documentation</option>
                  <option value="invalid-credentials">Invalid Credentials</option>
                  <option value="business-verification-failed">Business Verification Failed</option>
                  <option value="background-check-failed">Background Check Failed</option>
                  <option value="non-compliance">Non-Compliance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes <span className="text-red-500">*</span></label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Provide detailed feedback (minimum 20 characters)..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  {actionNotes.length}/20 characters minimum required
                  {actionNotes.length < 20 && actionNotes.length > 0 && (
                    <span className="text-red-500 ml-1">({20 - actionNotes.length} more needed)</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onReject(provider, rejectionReason, actionNotes);
                  setShowRejectModal(false);
                }}
                disabled={!rejectionReason || actionNotes.trim().length < 20}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Reject Provider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Ban className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Suspend Provider</h3>
                  <p className="text-sm text-gray-500">This will temporarily block their account</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={suspendNotes}
                  onChange={(e) => setSuspendNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Reason for suspension..."
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setShowSuspendModal(false)}
                className="flex-1 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSuspend(provider, suspendNotes.trim());
                  setShowSuspendModal(false);
                  setSuspendNotes('');
                }}
                disabled={!suspendNotes.trim()}
                className="flex-1 px-4 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Suspend Provider
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectDocModal && rejectDocId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Reject document</h3>
            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl"
              placeholder="Rejection reason (required)"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectDocModal(false);
                  setRejectDocId(null);
                }}
                className="flex-1 px-4 py-2.5 border rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!actionNotes.trim()}
                onClick={() => {
                  onVerifyDocument(provider, rejectDocId, false, actionNotes.trim());
                  setShowRejectDocModal(false);
                  setRejectDocId(null);
                  setActionNotes('');
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {resolveFlagId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Resolve fraud flag</h3>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl"
              placeholder="Resolution notes"
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setResolveFlagId(null)} className="flex-1 px-4 py-2.5 border rounded-xl">
                Cancel
              </button>
              <button
                type="button"
                disabled={!resolveNotes.trim()}
                onClick={() => {
                  onResolveFraudFlag(provider, resolveFlagId, resolveNotes.trim());
                  setResolveFlagId(null);
                  setResolveNotes('');
                }}
                className="flex-1 px-4 py-2.5 bg-nilin-coral text-white rounded-xl disabled:opacity-50"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Main Provider Management Page
// ============================================

const ProviderManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const detailFetchId = useRef(0);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const initialTab = searchParams.get('tab') || 'all';
  const [providers, setProviders] = useState<ProviderWithUser[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderWithUser | null>(null);
  const [verification, setVerification] = useState<ProviderVerification | null>(null);
  const [metrics, setMetrics] = useState<ProviderMetrics | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [fraudRiskLevel, setFraudRiskLevel] = useState<string>('');
  const [lastFraudReport, setLastFraudReport] = useState<{
    riskScore: number;
    riskLevel: string;
    activityCount: number;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLastUpdated, setDetailLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });

  // Filters
  const [filters, setFilters] = useState<ProviderFilters>({
    status: undefined,
    search: '',
    page: 1,
    limit: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [statusCounts, setStatusCounts] = useState<ProviderStatusCounts>({
    total: 0,
    pending: 0,
    inProgress: 0,
    approved: 0,
    suspended: 0,
    rejected: 0,
  });

  // Provider detail data
  const [providerServices, setProviderServices] = useState<ProviderService[]>([]);
  const [providerBookings, setProviderBookings] = useState<ProviderBooking[]>([]);
  const [providerEarnings, setProviderEarnings] = useState<EarningsBreakdown | null>(null);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [bookingPagination, setBookingPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  // Bulk selection state
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified' | 'pending'>('all');

  // Bulk action handlers
  const getSelectedProviderIds = (): string[] => {
    return Array.from(selectedProviders).map(id => {
      const provider = providers.find(p => (typeof p.userId === 'object' ? p.userId?._id : p.userId) === id);
      return provider ? (typeof provider.userId === 'object' ? provider.userId?._id : provider.userId) : id;
    }).filter(Boolean);
  };

  const toggleProviderSelection = (provider: ProviderWithUser) => {
    const userId = typeof provider.userId === 'object' ? provider.userId?._id : provider.userId;
    if (!userId) return;

    const newSelected = new Set(selectedProviders);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedProviders(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedProviders.size === providers.length) {
      setSelectedProviders(new Set());
    } else {
      const allIds = providers.map(p => typeof p.userId === 'object' ? p.userId?._id : p.userId).filter(Boolean);
      setSelectedProviders(new Set(allIds));
    }
  };

  const clearSelection = () => {
    setSelectedProviders(new Set());
  };

  // Define bulk actions
  const bulkActions: BulkAction[] = [
    {
      id: 'verify',
      label: 'Verify',
      icon: <UserCheck className="w-4 h-4" />,
      variant: 'success',
    },
    {
      id: 'activate',
      label: 'Activate',
      icon: <CheckCircle className="w-4 h-4" />,
      variant: 'success',
    },
    {
      id: 'suspend',
      label: 'Suspend',
      icon: <Ban className="w-4 h-4" />,
      variant: 'warning',
      requiresConfirm: true,
      confirmTitle: 'Confirm Suspension',
      confirmDescription: 'Suspended providers will not be able to access their accounts.',
    },
  ];

  // Handle bulk action
  const handleBulkAction = async (actionId: string) => {
    const providerIds = getSelectedProviderIds();
    if (providerIds.length === 0) return;

    setBulkActionLoading(true);
    try {
      const getActionLabel = (id: string) => {
        switch (id) {
          case 'verify': return 'verify';
          case 'activate': return 'activate';
          case 'suspend': return 'suspend';
          default: return id;
        }
      };

      let results: PromiseSettledResult<void>[] = [];

      // Helper to create a retryable API call
      const createRetryableCall = async (apiCall: () => Promise<unknown>) => {
        try {
          await withRetry(apiCall, {
            maxRetries: 2,
            retryableStatuses: [429, 500, 502, 503, 504]
          });
          return { status: 'fulfilled' as const };
        } catch (error) {
          return { status: 'rejected' as const, reason: error };
        }
      };

      switch (actionId) {
        case 'verify':
          results = await Promise.allSettled(
            providerIds.map(id => createRetryableCall(() =>
              providerOpsApi.approveProvider(id, 'Bulk verification by admin')
            ))
          );
          break;
        case 'activate':
          results = await Promise.allSettled(
            providerIds.map(id => createRetryableCall(() =>
              providerOpsApi.reactivateProvider(id, 'Bulk activation by admin')
            ))
          );
          break;
        case 'suspend':
          results = await Promise.allSettled(
            providerIds.map(id => createRetryableCall(() =>
              providerOpsApi.suspendProvider(id, 'Bulk suspension by admin', 'temporary')
            ))
          );
          break;
      }

      // Count successes and failures
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const actionLabel = getActionLabel(actionId);

      if (failed === 0) {
        toast.success(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)}d ${succeeded} provider(s) successfully`);
      } else if (succeeded === 0) {
        toast.error(`Failed to ${actionLabel} all ${failed} selected provider(s)`);
      } else {
        toast.error(`${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)}d ${succeeded} provider(s), ${failed} failed`);
      }

      setSelectedProviders(new Set());
      fetchProviders();
      fetchDashboardStats();
    } catch (error) {
      toast.error('An unexpected error occurred during bulk operation');
    } finally {
      setBulkActionLoading(false);
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_TABS.has(tab) && tab !== 'all') {
      setActiveTab(tab);
    } else if (!tab) {
      setActiveTab('all');
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput, page: 1 }
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const res = await providerOpsApi.getDashboardStats();
      const p = res.data.providers;
      setStatusCounts({
        total: p.total,
        pending: p.pending,
        inProgress: p.inProgress ?? 0,
        approved: p.approved,
        suspended: p.suspended,
        rejected: p.rejected,
      });
    } catch (error) {
      toast.error('Failed to load provider statistics');
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryFilters: ProviderFilters = {
        ...filters,
        status: tabToApiStatus(activeTab),
      };
      const response = await providerOpsApi.getProviders(queryFilters);
      setProviders(response.data.providers);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch providers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeTab]);

  const fetchProviderDetails = useCallback(async (providerId: string) => {
    const fetchId = ++detailFetchId.current;
    setDetailLoading(true);
    setVerification(null);
    setMetrics(null);
    setSlaMetrics(null);
    setFraudFlags([]);

    try {
      const detailsRes = await providerOpsApi.getProviderDetails(providerId).catch(() => null);
      if (fetchId !== detailFetchId.current) return;
      if (detailsRes?.data?.provider) {
        setSelectedProvider(detailsRes.data.provider);
      }

      const [verificationRes, metricsRes, slaRes, fraudRes] = await Promise.all([
        providerOpsApi.getVerification(providerId).catch(() => ({ data: { verification: null } })),
        providerOpsApi.getProviderMetrics(providerId).catch(() => ({ data: { metrics: null } })),
        providerOpsApi.getSlaMetrics(providerId).catch(() => ({ data: { slaMetrics: null } })),
        providerOpsApi.getFraudStatus(providerId).catch(() => ({
          data: { flags: [], riskLevel: 'unknown', hasFlags: false },
        })),
      ]);

      if (fetchId !== detailFetchId.current) return;

      setVerification(verificationRes.data.verification ?? null);
      setMetrics(metricsRes.data.metrics ?? null);
      setSlaMetrics(slaRes.data.slaMetrics ?? null);
      setFraudFlags(fraudRes.data.flags ?? []);
      setFraudRiskLevel(fraudRes.data.riskLevel ?? 'unknown');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fetch provider details. Please try again.');
    } finally {
      if (fetchId === detailFetchId.current) {
        setDetailLoading(false);
        setDetailLastUpdated(new Date());
      }
    }
  }, []);

  // Load provider services
  const loadProviderServices = useCallback(async (providerId: string) => {
    setServicesLoading(true);
    try {
      const response = await providerOpsApi.getProviderServices(providerId);
      setProviderServices(response.data.services);
    } catch (error) {
      toast.error('Failed to load provider services');
      setProviderServices([]);
    } finally {
      setServicesLoading(false);
    }
  }, []);

  // Load provider bookings
  const loadProviderBookings = useCallback(async (providerId: string, filters?: { status?: string; page?: number; limit?: number }) => {
    setBookingsLoading(true);
    try {
      const response = await providerOpsApi.getProviderBookings(providerId, {
        page: filters?.page || 1,
        limit: filters?.limit || 20,
        status: filters?.status as ProviderBooking['status'] | undefined,
      });
      setProviderBookings(response.data.bookings);
      setBookingPagination({
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
        pages: response.data.pagination.pages,
      });
    } catch (error) {
      toast.error('Failed to load provider bookings');
      setProviderBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  // Load provider earnings
  const loadProviderEarnings = useCallback(async (providerId: string) => {
    setEarningsLoading(true);
    try {
      const response = await providerOpsApi.getProviderEarnings(providerId);
      setProviderEarnings(response.data);
    } catch (error) {
      toast.error('Failed to load provider earnings');
      setProviderEarnings(null);
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  // Send message to provider
  const handleSendMessage = useCallback(async (providerId: string, message: string, subject?: string) => {
    await providerOpsApi.sendProviderMessage(providerId, message, subject);
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setFilters((prev) => ({ ...prev, page: 1, status: undefined }));
    if (tabId === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  const handleSort = (column: 'createdAt' | 'qualityScore' | 'reliabilityScore' | 'name') => {
    setFilters((prev) => ({
      ...prev,
      page: 1,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (providers.length === 0) {
      toast.error('No providers to export on this page');
      return;
    }
    exportProvidersCsv(providers);
    toast.success(`Exported ${providers.length} provider(s) from this page to ${format.toUpperCase()}`);
  };

  // Handlers
  const getUserId = (provider: ProviderWithUser): string => {
    const uid = provider.userId;
    if (typeof uid === 'string') return uid;
    return uid?._id ?? '';
  };

  const handleSelectProvider = (provider: ProviderWithUser) => {
    setSelectedProvider(provider);
    fetchProviderDetails(getUserId(provider));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleApprove = async (provider: ProviderWithUser) => {
    try {
      const userId = getUserId(provider);
      await providerOpsApi.approveProvider(userId);
      toast.success('Provider approved successfully');
      fetchProviders();
      fetchDashboardStats();
      setSelectedProvider(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve provider. Please try again.');
    }
  };

  const handleReject = async (provider: ProviderWithUser, reason: string, notes: string) => {
    try {
      const userId = getUserId(provider);
      await providerOpsApi.rejectProvider(userId, reason, notes);
      toast.success('Provider rejected successfully');
      fetchProviders();
      fetchDashboardStats();
      setSelectedProvider(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject provider. Please try again.');
    }
  };

  const handleSuspend = async (provider: ProviderWithUser, reason: string) => {
    try {
      const userId = getUserId(provider);
      await providerOpsApi.suspendProvider(userId, reason, 'temporary');
      toast.success('Provider suspended successfully');
      fetchProviders();
      fetchDashboardStats();
      setSelectedProvider(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to suspend provider. Please try again.');
    }
  };

  const handleReactivate = async (provider: ProviderWithUser) => {
    try {
      const userId = getUserId(provider);
      await providerOpsApi.reactivateProvider(userId);
      toast.success('Provider reactivated successfully');
      fetchProviders();
      fetchDashboardStats();
      setSelectedProvider(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate provider. Please try again.');
    }
  };

  const handleVerifyDocument = async (
    provider: ProviderWithUser,
    docId: string,
    verified: boolean,
    notes?: string
  ) => {
    try {
      const userId = getUserId(provider);
      await providerOpsApi.verifyDocument(userId, docId, verified, notes);
      toast.success(`Document ${verified ? 'verified' : 'rejected'} successfully`);
      fetchProviderDetails(userId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to verify document. Please try again.');
    }
  };

  const handleRunFraudCheck = async (provider: ProviderWithUser) => {
    try {
      const userId = getUserId(provider);
      const res = await providerOpsApi.runFraudCheck(userId);
      const { report, flagsPersisted } = res.data;
      setLastFraudReport({
        riskScore: report.riskScore,
        riskLevel: report.riskLevel,
        activityCount: report.suspiciousActivities?.length ?? 0,
      });
      toast.success(
        `Fraud check complete — ${flagsPersisted} flag(s) recorded, risk: ${report.riskLevel}`
      );
      fetchProviderDetails(userId);
      fetchProviders();
      fetchDashboardStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run fraud check. Please try again.');
    }
  };

  const handleResolveFraudFlag = async (
    provider: ProviderWithUser,
    flagId: string,
    resolution: string
  ) => {
    try {
      const userId = getUserId(provider);
      await providerOpsApi.resolveFraudFlag(userId, flagId, resolution);
      toast.success('Fraud flag resolved');
      fetchProviderDetails(userId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resolve fraud flag.');
    }
  };

  return (
    <ErrorBoundary>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      <AdminPageShell
        wideLayout
        title="Provider Management"
        subtitle={
          searchInput.trim() || filters.city || filters.qualityScoreMin != null
            ? `${statusCounts.total} providers · ${pagination.total} matching filters`
            : `${statusCounts.total} providers · ${statusCounts.pending} pending verification`
        }
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Providers', current: true },
        ]}
        pendingVerifications={statusCounts.pending}
        headerActions={
          <ExportDropdown
            onExport={handleExport}
            formats={['csv', 'excel', 'pdf']}
            loading={isExporting}
          />
        }
      >
        <main id="main-content" className="space-y-3 w-full">
          <ProviderKpiStrip counts={statusCounts} activeTab={activeTab} onTabSelect={handleTabChange} />

          <div className="glass rounded-2xl border border-nilin-border/50 bg-white/95 overflow-hidden w-full">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-nilin-border/60 bg-nilin-cream/30">
              <p className="text-sm text-nilin-warmGray">
                <span className="font-semibold text-nilin-charcoal">{TAB_LABELS[activeTab] || 'All'}</span>
                {pagination.total > 0 ? (
                  <>
                    {' '}
                    · <span className="font-medium text-nilin-charcoal">{pagination.total}</span> in list
                    {searchInput.trim() ? ` (search: "${searchInput.trim()}")` : ''}
                  </>
                ) : (
                  ' · no matches'
                )}
              </p>
            </div>

            <div className="p-3 border-b border-nilin-border/60">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray pointer-events-none" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search by name, email, or business…"
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-nilin-border rounded-xl bg-white focus:ring-2 focus:ring-nilin-coral/25 focus:border-nilin-coral/40 transition-all"
                    aria-label="Search providers"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors shrink-0',
                    showFilters
                      ? 'bg-nilin-blush/50 border-nilin-coral/40 text-nilin-charcoal'
                      : 'bg-white border-nilin-border text-nilin-charcoal hover:bg-nilin-blush/30'
                  )}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-nilin-border/50">
                  <div>
                    <label className="block text-xs font-medium text-nilin-warmGray mb-1">City</label>
                    <input
                      type="text"
                      value={filters.city || ''}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, city: e.target.value || undefined, page: 1 }))
                      }
                      placeholder="All cities"
                      className="w-full px-3 py-2 text-sm border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral/25"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-nilin-warmGray mb-1">Min quality score</label>
                    <input
                      type="number"
                      value={filters.qualityScoreMin ?? ''}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          qualityScoreMin: e.target.value ? Number(e.target.value) : undefined,
                          page: 1,
                        }))
                      }
                      placeholder="0–100"
                      min={0}
                      max={100}
                      className="w-full px-3 py-2 text-sm border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral/25"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-nilin-warmGray mb-1">Sort by</label>
                    <select
                      value={filters.sortBy || 'createdAt'}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          sortBy: e.target.value as ProviderFilters['sortBy'],
                          page: 1,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral/25"
                    >
                      <option value="createdAt">Newest first</option>
                      <option value="qualityScore">Quality score</option>
                      <option value="reliabilityScore">Reliability score</option>
                      <option value="name">Name</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-nilin-warmGray mb-1">Verification status</label>
                    <select
                      value={verificationFilter}
                      onChange={(e) => setVerificationFilter(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-nilin-border rounded-lg focus:ring-2 focus:ring-nilin-coral/25"
                    >
                      <option value="all">All</option>
                      <option value="verified">Verified</option>
                      <option value="unverified">Unverified</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Actions Bar */}
            {selectedProviders.size > 0 && (
              <BulkActionToolbar
                selectedItems={providers.filter(p => {
                  const userId = typeof p.userId === 'object' ? p.userId?._id : p.userId;
                  return userId && selectedProviders.has(userId);
                })}
                totalCount={pagination.total}
                entityName="providers"
                actions={bulkActions}
                onAction={handleBulkAction}
                onClear={clearSelection}
                getItemId={(p) => {
                  const userId = typeof p.userId === 'object' ? p.userId?._id : p.userId;
                  return userId || '';
                }}
              />
            )}

            {/* Select All Row */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedProviders.size === providers.length && providers.length > 0}
                  onChange={toggleAllSelection}
                  className="w-4 h-4 text-nilin-coral rounded border-gray-300 focus:ring-nilin-coral"
                />
                <span className="text-sm text-gray-600">Select all on this page</span>
              </label>
              <span className="text-xs text-gray-400">
                {selectedProviders.size > 0 && `(${selectedProviders.size} of ${providers.length} selected)`}
              </span>
            </div>

            <ProviderListPanel
              providers={providers}
              isLoading={isLoading}
              currentPage={pagination.page}
              totalPages={pagination.pages}
              totalCount={pagination.total}
              pageSize={pagination.limit}
              sortBy={filters.sortBy || 'createdAt'}
              sortOrder={filters.sortOrder || 'desc'}
              onSort={handleSort}
              onSelectProvider={handleSelectProvider}
              onPageChange={handlePageChange}
            />
          </div>
        </main>

        {/* Provider Detail Modal */}
        {selectedProvider && (
          <ProviderDetail
            provider={selectedProvider}
            verification={verification}
            metrics={metrics}
            slaMetrics={slaMetrics}
            fraudFlags={fraudFlags}
            detailLoading={detailLoading}
            lastUpdated={detailLastUpdated}
            fraudRiskLevel={fraudRiskLevel}
            lastFraudReport={lastFraudReport}
            onClose={() => setSelectedProvider(null)}
            onApprove={handleApprove}
            onReject={handleReject}
            onSuspend={handleSuspend}
            onReactivate={handleReactivate}
            onVerifyDocument={handleVerifyDocument}
            onRunFraudCheck={handleRunFraudCheck}
            onResolveFraudFlag={handleResolveFraudFlag}
            onSendMessage={handleSendMessage}
            services={providerServices}
            bookings={providerBookings}
            earnings={providerEarnings}
            onLoadServices={loadProviderServices}
            onLoadBookings={loadProviderBookings}
            onLoadEarnings={loadProviderEarnings}
            servicesLoading={servicesLoading}
            bookingsLoading={bookingsLoading}
            earningsLoading={earningsLoading}
          />
        )}
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default ProviderManagement;
