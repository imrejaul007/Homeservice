
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
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
  Eye,
  MoreVertical,
  Star,
  MapPin,
  Phone,
  Mail,
  Building,
  Calendar,
  Award,
  AlertCircle,
  Check,
  X,
  ArrowUpDown,
  Download,
} from 'lucide-react';
import providerOpsApi from '../../services/providerOpsApi';
import type {
  ProviderWithUser,
  ProviderFilters,
  ProviderVerification,
  ProviderMetrics,
  FraudFlag,
  SLAMetrics,
} from '../../services/providerOpsApi';

// ============================================
// Types
// ============================================

interface DocumentStatus {
  type: string;
  status: 'pending' | 'verified' | 'rejected';
  label: string;
}

interface ProviderTab {
  id: string;
  label: string;
  count: number;
  color: string;
}

// ============================================
// Helper Components
// ============================================

const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Under Review' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
    verified: { bg: 'bg-green-100', text: 'text-green-700', label: 'Verified' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
    suspended: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Suspended' },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClass}`}>
      {status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
      {['approved', 'verified'].includes(status) && <CheckCircle className="w-3 h-3 mr-1" />}
      {['rejected', 'suspended'].includes(status) && <XCircle className="w-3 h-3 mr-1" />}
      {status === 'in_progress' && <RefreshCw className="w-3 h-3 mr-1" />}
      {config.label}
    </span>
  );
};

const ScoreBadge: React.FC<{ score: number; label: string; size?: 'sm' | 'md' }> = ({ score, label, size = 'md' }) => {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-green-600 bg-green-50';
    if (s >= 60) return 'text-amber-600 bg-amber-50';
    if (s >= 40) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const sizeClass = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';

  return (
    <div className={`flex flex-col items-center justify-center ${sizeClass} rounded-full ${getColor(score)}`}>
      <span className="font-bold">{score}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: string;
}> = ({ title, value, icon, trend, trendValue, color }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trendValue && (
          <div className={`flex items-center mt-1 text-sm ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
            {trend === 'up' && <TrendingUp className="w-4 h-4 mr-1" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4 mr-1" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
    </div>
  </div>
);

// ============================================
// Provider List Component
// ============================================

const ProviderList: React.FC<{
  providers: ProviderWithUser[];
  onSelectProvider: (provider: ProviderWithUser) => void;
  onPageChange: (page: number) => void;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
}> = ({ providers, onSelectProvider, onPageChange, currentPage, totalPages, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No providers found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Provider</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Location</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Quality</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Reliability</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Bookings</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Rating</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => (
            <tr
              key={provider._id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onSelectProvider(provider)}
            >
              <td className="py-3 px-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3">
                    {provider.instagramStyleProfile?.profilePhoto ? (
                      <img
                        src={provider.instagramStyleProfile.profilePhoto}
                        alt={provider.businessInfo.businessName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{provider.businessInfo.businessName}</p>
                    <p className="text-sm text-gray-500">{provider.userId?.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={provider.verificationStatus?.overall || 'pending'} size="sm" />
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span className="text-sm">
                    {provider.locationInfo?.primaryAddress?.city || 'N/A'}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">
                <ScoreBadge
                  score={provider.analytics?.performanceMetrics?.qualityScore || 0}
                  label="Q"
                  size="sm"
                />
              </td>
              <td className="py-3 px-4">
                <ScoreBadge
                  score={provider.analytics?.performanceMetrics?.punctualityScore || 0}
                  label="R"
                  size="sm"
                />
              </td>
              <td className="py-3 px-4">
                <span className="text-gray-900">
                  {provider.analytics?.bookingStats?.completedBookings || 0}
                </span>
                <span className="text-gray-400 text-sm ml-1">
                  / {provider.analytics?.bookingStats?.totalBookings || 0}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-amber-400 mr-1" />
                  <span className="font-medium">
                    {provider.reviewsData?.averageRating?.toFixed(1) || '0.0'}
                  </span>
                  <span className="text-gray-400 text-sm ml-1">
                    ({provider.reviewsData?.totalReviews || 0})
                  </span>
                </div>
              </td>
              <td className="py-3 px-4 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProvider(provider);
                  }}
                  className="p-2 text-gray-500 hover:text-nilin-coral hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4 px-4 border-t border-gray-200">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </button>

        <div className="flex items-center space-x-2">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-10 h-10 rounded-lg text-sm font-medium ${
                  currentPage === pageNum
                    ? 'bg-nilin-coral text-white'
                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
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
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string, notes: string) => void;
  onSuspend: (id: string) => void;
  onReactivate: (id: string) => void;
  onVerifyDocument: (providerId: string, docId: string, verified: boolean) => void;
  onRunFraudCheck: (id: string) => void;
}> = ({
  provider,
  verification,
  metrics,
  slaMetrics,
  fraudFlags,
  onClose,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
  onVerifyDocument,
  onRunFraudCheck,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'sla' | 'fraud'>('overview');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Eye className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'sla', label: 'SLA Metrics', icon: <Shield className="w-4 h-4" /> },
    { id: 'fraud', label: 'Fraud', icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  const documentTypes: Record<string, string> = {
    id_card: 'ID Card',
    passport: 'Passport',
    business_license: 'Business License',
    address_proof: 'Address Proof',
    tax_certificate: 'Tax Certificate',
    insurance: 'Insurance',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-4">
              {provider.instagramStyleProfile?.profilePhoto ? (
                <img
                  src={provider.instagramStyleProfile.profilePhoto}
                  alt={provider.businessInfo.businessName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{provider.businessInfo.businessName}</h2>
              <p className="text-gray-500">{provider.userId?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={provider.verificationStatus?.overall || 'pending'} />
                {provider.instagramStyleProfile?.isVerified && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    <Check className="w-3 h-3 mr-1" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-nilin-coral text-nilin-coral'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
              {tab.id === 'fraud' && fraudFlags.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                  {fraudFlags.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center text-gray-600">
                    <Mail className="w-4 h-4 mr-2" />
                    <span>{provider.userId?.email}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Phone className="w-4 h-4 mr-2" />
                    <span>{provider.userId?.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span>
                      {[provider.locationInfo?.primaryAddress?.city, provider.locationInfo?.primaryAddress?.state]
                        .filter(Boolean)
                        .join(', ') || 'Not provided'}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Joined {new Date(provider.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-3">Performance Metrics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <ScoreBadge score={metrics?.qualityScore || 0} label="Quality" />
                    <p className="text-xs text-gray-500 mt-1">Quality Score</p>
                  </div>
                  <div className="text-center">
                    <ScoreBadge score={metrics?.reliabilityScore || 0} label="Reliability" />
                    <p className="text-xs text-gray-500 mt-1">Reliability</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                      <Star className="w-5 h-5" />
                    </div>
                    <p className="text-lg font-bold text-gray-900 mt-1">{metrics?.avgRating?.toFixed(1) || '0.0'}</p>
                    <p className="text-xs text-gray-500">Rating</p>
                  </div>
                </div>
              </div>

              {/* Booking Stats */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-3">Booking Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{metrics?.totalBookings || 0}</p>
                    <p className="text-sm text-gray-500">Total Bookings</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{metrics?.completedBookings || 0}</p>
                    <p className="text-sm text-gray-500">Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{metrics?.cancelledBookings || 0}</p>
                    <p className="text-sm text-gray-500">Cancelled</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{metrics?.noShows || 0}</p>
                    <p className="text-sm text-gray-500">No Shows</p>
                  </div>
                </div>
              </div>

              {/* KYC Score */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-medium text-gray-900 mb-3">KYC Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">KYC Level</span>
                    <span className="font-medium capitalize">{verification?.kycLevel || 'Basic'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${verification?.kycScore || 0}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    Score: {verification?.kycScore || 0}/100
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Submitted Documents</h3>
              {verification?.documents && verification.documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {verification.documents.map((doc) => (
                    <div key={doc._id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{documentTypes[doc.type] || doc.type}</p>
                          <p className="text-sm text-gray-500">
                            Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <StatusBadge
                          status={doc.verified ? 'approved' : doc.rejectionReason ? 'rejected' : 'pending'}
                          size="sm"
                        />
                      </div>
                      {doc.rejectionReason && (
                        <p className="text-sm text-red-600 mt-2">Reason: {doc.rejectionReason}</p>
                      )}
                      {!doc.verified && provider.verificationStatus?.overall === 'in_progress' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => onVerifyDocument(provider._id, doc._id, true)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 inline mr-1" />
                            Verify
                          </button>
                          <button
                            onClick={() => onVerifyDocument(provider._id, doc._id, false)}
                            className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                          >
                            <X className="w-4 h-4 inline mr-1" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No documents submitted yet.</p>
              )}
            </div>
          )}

          {activeTab === 'sla' && (
            <div className="space-y-6">
              <h3 className="font-medium text-gray-900">SLA Compliance Metrics</h3>
              {slaMetrics ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Response Time</h4>
                      {slaMetrics.responseTime.compliant ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {slaMetrics.responseTime.avgMinutes} min
                    </p>
                    <p className="text-sm text-gray-500">Average (Target: {slaMetrics.responseTime.targetMinutes} min)</p>
                    <p className="text-sm text-gray-500 mt-2">P95: {slaMetrics.responseTime.p95Minutes} min</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Acceptance Rate</h4>
                      {slaMetrics.bookingAcceptanceRate.compliant ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {slaMetrics.bookingAcceptanceRate.rate}%
                    </p>
                    <p className="text-sm text-gray-500">
                      Accepted: {slaMetrics.bookingAcceptanceRate.accepted}, Rejected: {slaMetrics.bookingAcceptanceRate.rejected}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">Target: {slaMetrics.bookingAcceptanceRate.targetPercentage}%</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Completion Rate</h4>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {slaMetrics.completionRate.rate}%
                    </p>
                    <p className="text-sm text-gray-500">
                      Completed: {slaMetrics.completionRate.completed}, Cancelled: {slaMetrics.completionRate.cancelled}, No-show: {slaMetrics.completionRate.noShow}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">Target: {slaMetrics.completionRate.targetPercentage}%</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No SLA data available yet.</p>
              )}
            </div>
          )}

          {activeTab === 'fraud' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Fraud Detection</h3>
                <button
                  onClick={() => onRunFraudCheck(provider._id)}
                  className="px-4 py-2 bg-nilin-coral text-white text-sm rounded-lg hover:bg-nilin-rose flex items-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run Check
                </button>
              </div>
              {fraudFlags.length > 0 ? (
                <div className="space-y-3">
                  {fraudFlags.map((flag) => (
                    <div
                      key={flag._id}
                      className={`rounded-xl p-4 border ${
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
                        <div>
                          <p className="font-medium text-gray-900 capitalize">
                            {flag.type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            Detected: {new Date(flag.detectedAt).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            flag.severity === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : flag.severity === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {flag.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No fraud flags detected for this provider.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            {['pending', 'in_progress'].includes(provider.verificationStatus?.overall) && (
              <>
                <button
                  onClick={() => onApprove(provider._id)}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 flex items-center"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </button>
              </>
            )}
            {['approved', 'verified'].includes(provider.verificationStatus?.overall) && (
              <button
                onClick={() => setShowSuspendModal(true)}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 flex items-center"
              >
                <Ban className="w-4 h-4 mr-2" />
                Suspend
              </button>
            )}
            {provider.verificationStatus?.overall === 'suspended' && (
              <button
                onClick={() => onReactivate(provider._id)}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reactivate
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Provider</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  placeholder="Additional notes for the provider..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onReject(provider._id, rejectionReason, actionNotes);
                  setShowRejectModal(false);
                }}
                disabled={!rejectionReason}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject Provider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Suspend Provider</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  placeholder="Reason for suspension..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSuspendModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSuspend(provider._id);
                  setShowSuspendModal(false);
                }}
                disabled={!actionNotes}
                className="flex-1 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suspend Provider
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
  // State
  const [providers, setProviders] = useState<ProviderWithUser[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderWithUser | null>(null);
  const [verification, setVerification] = useState<ProviderVerification | null>(null);
  const [metrics, setMetrics] = useState<ProviderMetrics | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  // Filters
  const [filters, setFilters] = useState<ProviderFilters>({
    status: undefined,
    search: '',
    page: 1,
    limit: 20,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Status tabs
  const [activeTab, setActiveTab] = useState<string>('all');

  const tabs: ProviderTab[] = [
    { id: 'all', label: 'All', count: 0, color: 'bg-gray-100 text-gray-700' },
    { id: 'pending', label: 'Pending', count: 0, color: 'bg-amber-100 text-amber-700' },
    { id: 'in_progress', label: 'Under Review', count: 0, color: 'bg-blue-100 text-blue-700' },
    { id: 'approved', label: 'Approved', count: 0, color: 'bg-green-100 text-green-700' },
    { id: 'suspended', label: 'Suspended', count: 0, color: 'bg-gray-100 text-gray-700' },
    { id: 'rejected', label: 'Rejected', count: 0, color: 'bg-red-100 text-red-700' },
  ];

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryFilters = { ...filters };
      if (activeTab !== 'all') {
        queryFilters.status = activeTab as ProviderFilters['status'];
      }
      const response = await providerOpsApi.getProviders(queryFilters);
      setProviders(response.data.providers);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeTab]);

  // Fetch provider details when selected
  const fetchProviderDetails = useCallback(async (providerId: string) => {
    try {
      const [verificationRes, metricsRes, slaRes, fraudRes] = await Promise.all([
        providerOpsApi.getVerification(providerId).catch(() => ({ data: { verification: null } })),
        providerOpsApi.getProviderMetrics(providerId).catch(() => ({ data: null as unknown as ProviderMetrics })),
        providerOpsApi.getSlaMetrics(providerId).catch(() => ({ data: null as unknown as SLAMetrics })),
        providerOpsApi.getFraudStatus(providerId).catch(() => ({ data: { flags: [] } })),
      ]);

      setVerification(verificationRes.data.verification);
      setMetrics(metricsRes.data);
      setSlaMetrics(slaRes.data);
      setFraudFlags(fraudRes.data.flags);
    } catch (error) {
      console.error('Failed to fetch provider details:', error);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Handlers
  const handleSelectProvider = (provider: ProviderWithUser) => {
    setSelectedProvider(provider);
    fetchProviderDetails(provider._id);
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleApprove = async (providerId: string) => {
    try {
      await providerOpsApi.approveProvider(providerId);
      fetchProviders();
      setSelectedProvider(null);
    } catch (error) {
      console.error('Failed to approve provider:', error);
    }
  };

  const handleReject = async (providerId: string, reason: string, notes: string) => {
    try {
      await providerOpsApi.rejectProvider(providerId, reason, notes);
      fetchProviders();
      setSelectedProvider(null);
    } catch (error) {
      console.error('Failed to reject provider:', error);
    }
  };

  const handleSuspend = async (providerId: string) => {
    try {
      const notes = (document.querySelector('textarea') as HTMLTextAreaElement)?.value;
      await providerOpsApi.suspendProvider(providerId, notes || 'Policy violation', 'temporary');
      fetchProviders();
      setSelectedProvider(null);
    } catch (error) {
      console.error('Failed to suspend provider:', error);
    }
  };

  const handleReactivate = async (providerId: string) => {
    try {
      await providerOpsApi.reactivateProvider(providerId);
      fetchProviders();
      setSelectedProvider(null);
    } catch (error) {
      console.error('Failed to reactivate provider:', error);
    }
  };

  const handleVerifyDocument = async (providerId: string, docId: string, verified: boolean) => {
    try {
      await providerOpsApi.verifyDocument(providerId, docId, verified);
      fetchProviderDetails(providerId);
    } catch (error) {
      console.error('Failed to verify document:', error);
    }
  };

  const handleRunFraudCheck = async (providerId: string) => {
    try {
      await providerOpsApi.runFraudCheck(providerId);
      fetchProviderDetails(providerId);
    } catch (error) {
      console.error('Failed to run fraud check:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Provider Management</h1>
            <p className="text-gray-500 mt-1">Manage provider verification, quality, and compliance</p>
          </div>
          <button className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-nilin-coral text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="p-4 flex items-center gap-4">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Search by name, email, or business..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose"
              >
                Search
              </button>
            </form>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-4 py-2 border rounded-lg transition-colors ${
                showFilters ? 'bg-nilin-coral text-white border-nilin-coral' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status || ''}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as any || undefined }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={filters.city || ''}
                    onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value || undefined }))}
                    placeholder="Filter by city"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Quality Score</label>
                  <input
                    type="number"
                    value={filters.qualityScoreMin || ''}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, qualityScoreMin: e.target.value ? Number(e.target.value) : undefined }))
                    }
                    placeholder="0"
                    min={0}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                  <select
                    value={filters.sortBy || 'createdAt'}
                    onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
                  >
                    <option value="createdAt">Date Created</option>
                    <option value="qualityScore">Quality Score</option>
                    <option value="reliabilityScore">Reliability Score</option>
                    <option value="name">Name</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Provider List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <ProviderList
            providers={providers}
            onSelectProvider={handleSelectProvider}
            onPageChange={handlePageChange}
            currentPage={pagination.page}
            totalPages={pagination.pages}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Provider Detail Modal */}
      {selectedProvider && (
        <ProviderDetail
          provider={selectedProvider}
          verification={verification}
          metrics={metrics}
          slaMetrics={slaMetrics}
          fraudFlags={fraudFlags}
          onClose={() => setSelectedProvider(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onSuspend={handleSuspend}
          onReactivate={handleReactivate}
          onVerifyDocument={handleVerifyDocument}
          onRunFraudCheck={handleRunFraudCheck}
        />
      )}
    </div>
  );
};

export default ProviderManagement;
