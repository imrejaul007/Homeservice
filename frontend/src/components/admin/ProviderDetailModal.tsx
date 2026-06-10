import React, { useState } from 'react';
import {
  X, Check, Building, Mail, Calendar, Phone, MapPin,
  Shield, FileText, Activity, ShieldAlert, Clock, CheckCircle,
  XCircle, Star, CheckSquare, ShieldCheck, AlertTriangle,
  CreditCard, Globe, Briefcase, Ban, RefreshCw, Layers, Zap,
} from 'lucide-react';
import type {
  ProviderWithUser,
  ProviderVerification,
  ProviderMetrics,
  SLAMetrics,
  FraudFlag,
} from '../../services/providerOpsApi';
import { ProviderStatusBadge, getProviderDisplayName, getProviderSecondaryLine } from './ProviderListPanel';

interface ProviderDetailModalProps {
  provider: ProviderWithUser;
  verification: ProviderVerification | null;
  metrics: ProviderMetrics | null;
  slaMetrics: SLAMetrics | null;
  fraudFlags: FraudFlag[];
  onClose: () => void;
  onApprove: (provider: ProviderWithUser) => void;
  onReject: (provider: ProviderWithUser, reason: string, notes: string) => void;
  onSuspend: (provider: ProviderWithUser, reason: string) => void;
  onReactivate: (provider: ProviderWithUser) => void;
  onVerifyDocument: (provider: ProviderWithUser, docId: string, verified: boolean, notes?: string) => void;
  onRunFraudCheck: (provider: ProviderWithUser) => void;
  onResolveFraudFlag: (provider: ProviderWithUser, flagId: string, resolution: string) => void;
  detailLoading?: boolean;
  fraudRiskLevel?: string;
  lastFraudReport?: { riskScore: number; riskLevel: string; activityCount: number } | null;
}

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
}> = ({ title, value, subtitle, icon, iconBg }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${iconBg}`}>{icon}</div>
    </div>
  </div>
);

const ProgressRing: React.FC<{ value: number; size?: number; strokeWidth?: number; color?: string }> = ({
  value, size = 60, strokeWidth = 6, color = '#10b981'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
          strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-500"
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

export const ProviderDetailModal: React.FC<ProviderDetailModalProps> = ({
  provider,
  verification,
  metrics,
  slaMetrics,
  fraudFlags,
  detailLoading = false,
  fraudRiskLevel,
  lastFraudReport,
  onClose,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
  onVerifyDocument,
  onRunFraudCheck,
  onResolveFraudFlag,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'sla' | 'fraud'>('overview');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showRejectDocModal, setShowRejectDocModal] = useState(false);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [suspendNotes, setSuspendNotes] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [resolveFlagId, setResolveFlagId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const accountStatus = typeof provider.userId === 'object' ? provider.userId?.accountStatus : undefined;
  const profileOverall = provider.verificationStatus?.overall || 'pending';
  const verificationStatus = verification?.status;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'sla', label: 'Performance', icon: <Activity className="w-4 h-4" /> },
    { id: 'fraud', label: 'Security', icon: <ShieldAlert className="w-4 h-4" />, badge: fraudFlags.length },
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
    if (slaMetrics.periodBookingCount !== undefined && slaMetrics.periodBookingCount > 0) return true;
    const acc = slaMetrics.bookingAcceptanceRate;
    const comp = slaMetrics.completionRate;
    const noAcceptanceActivity = (acc?.accepted ?? 0) + (acc?.rejected ?? 0) === 0;
    const noCompletionActivity = (comp?.completed ?? 0) + (comp?.cancelled ?? 0) + (comp?.noShow ?? 0) === 0;
    if (noAcceptanceActivity && noCompletionActivity && (acc?.rate ?? 0) >= 100) return false;
    return true;
  })();
  const totalBookings = metrics?.totalBookings ?? 0;
  const completionPct = totalBookings > 0 ? Math.round(((metrics?.completedBookings || 0) / totalBookings) * 100) : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-nilin-coral/5 via-nilin-rose/5 to-transparent p-6 border-b border-gray-100">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nilin-coral via-nilin-rose to-nilin-coral/50"></div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-nilin-coral to-nilin-rose p-0.5 shadow-lg">
                  <div className="w-full h-full rounded-xl bg-white flex items-center justify-center overflow-hidden">
                    {provider.instagramStyleProfile?.profilePhoto ? (
                      <img src={provider.instagramStyleProfile.profilePhoto} alt={displayName} className="w-full h-full object-cover" />
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
                    <><Mail className="w-4 h-4 shrink-0" />{providerEmail}</>
                  ) : <span>{secondaryLine}</span>}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <ProviderStatusBadge status={provider.verificationStatus?.overall || 'pending'} size="md" />
                  <span className="text-gray-300">|</span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Joined {new Date(provider.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-50 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all relative ${
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Quality Score" value={metrics?.qualityScore || 0} subtitle="out of 100" icon={<Zap className="w-5 h-5 text-amber-500" />} iconBg="bg-amber-50" />
                <MetricCard title="Reliability Score" value={metrics?.reliabilityScore || 0} subtitle="out of 100" icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />} iconBg="bg-emerald-50" />
                <MetricCard title="Avg Rating" value={metrics?.avgRating?.toFixed(1) || '0.0'} subtitle={`${metrics?.totalBookings || 0} total bookings`} icon={<Star className="w-5 h-5 text-amber-500" />} iconBg="bg-amber-50" />
                <MetricCard title="Completion Rate" value={completionPct !== null ? `${completionPct}%` : 'N/A'} subtitle={totalBookings > 0 ? `${metrics?.completedBookings || 0} completed` : 'No bookings yet'} icon={<CheckCircle className="w-5 h-5 text-emerald-500" />} iconBg="bg-emerald-50" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contact Info */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-nilin-coral" /> Contact Information
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
                        {[provider.locationInfo?.primaryAddress?.city, provider.locationInfo?.primaryAddress?.state].filter(Boolean).join(', ') || 'Not provided'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* KYC Status */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-nilin-coral" /> KYC Verification
                  </h3>
                  {!verification ? (
                    <div className="flex items-center gap-4 py-2">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center"><Shield className="w-9 h-9 text-gray-400" /></div>
                      <div><p className="text-lg font-semibold text-gray-900">No verification record</p><p className="text-sm text-gray-500">Provider has not started KYC submission</p></div>
                    </div>
                  ) : approvedWithoutDocs ? (
                    <div className="flex items-center gap-4 py-2">
                      <div className="w-20 h-20 rounded-full bg-sky-100 flex items-center justify-center"><ShieldCheck className="w-9 h-9 text-sky-600" /></div>
                      <div><p className="text-lg font-semibold text-gray-900">Approved by admin</p><p className="text-sm text-gray-500">Account active without uploaded KYC files</p></div>
                    </div>
                  ) : awaitingDocUpload ? (
                    <div className="flex items-center gap-4 py-2">
                      <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center"><Clock className="w-9 h-9 text-amber-600" /></div>
                      <div><p className="text-lg font-semibold text-gray-900">Awaiting document upload</p><p className="text-sm text-gray-500 capitalize">Level: {verification.kycLevel || 'basic'}</p></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-6 mb-6">
                        <ProgressRing value={verification.kycScore ?? 0} size={80} strokeWidth={8} />
                        <div><p className="text-2xl font-bold text-gray-900 capitalize">{verification.kycLevel || 'basic'}</p><p className="text-sm text-gray-500">Verification Level</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                        {kycLevels.map((level, idx) => (
                          <div key={level} className="flex items-center gap-2 flex-1">
                            <div className={`h-2 flex-1 rounded-full ${idx <= kycLevelIndex ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                            <span className={`text-xs font-medium ${idx <= kycLevelIndex ? 'text-emerald-600' : 'text-gray-400'} capitalize`}>{level}</span>
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
                    <Activity className="w-5 h-5 text-nilin-coral" /> Booking Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-100"><p className="text-3xl font-bold text-gray-900">{metrics?.totalBookings || 0}</p><p className="text-sm text-gray-500">Total Bookings</p></div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100"><p className="text-3xl font-bold text-emerald-600">{metrics?.completedBookings || 0}</p><p className="text-sm text-emerald-600">Completed</p></div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100"><p className="text-3xl font-bold text-red-600">{metrics?.cancelledBookings || 0}</p><p className="text-sm text-red-600">Cancelled</p></div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100"><p className="text-3xl font-bold text-amber-600">{metrics?.noShows || 0}</p><p className="text-sm text-amber-600">No Shows</p></div>
                  </div>
                </div>

                {/* Performance */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-nilin-coral" /> Performance
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Avg Response Time</span>
                        <span className="font-semibold text-gray-900">{metrics?.avgResponseTime || 0} min</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${(metrics?.avgResponseTime || 0) <= 30 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, (metrics?.avgResponseTime || 0) / 2)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Acceptance Rate</span>
                        <span className="font-semibold text-gray-900">{metrics?.acceptanceRate || 0}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${(metrics?.acceptanceRate || 0) >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${metrics?.acceptanceRate || 0}%` }} />
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
                <span className="text-sm text-gray-500">{verification?.documents?.filter(d => d.verified).length || 0} of {verification?.documents?.length || 0} verified</span>
              </div>
              {!verification ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl"><FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" /><p className="text-gray-500">No verification record submitted yet</p></div>
              ) : verification.documents && verification.documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {verification.documents.map((doc) => (
                    <div key={doc._id} className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${doc.verified ? 'bg-emerald-100 text-emerald-600' : doc.rejectionReason ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                            {documentTypes[doc.type]?.icon || <FileText className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{documentTypes[doc.type]?.label || doc.type}</p>
                            <p className="text-xs text-gray-500">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <ProviderStatusBadge status={doc.verified ? 'approved' : doc.rejectionReason ? 'rejected' : 'pending'} size="sm" />
                      </div>
                      {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-nilin-coral hover:underline mb-3 inline-block">View document</a>}
                      {doc.rejectionReason && <div className="p-3 bg-red-50 rounded-xl mb-4"><p className="text-sm text-red-700 font-medium">Rejection Reason:</p><p className="text-sm text-red-600">{doc.rejectionReason}</p></div>}
                      {!doc.verified && !doc.rejectionReason && ['pending', 'in_progress'].includes(verificationStatus || '') && (
                        <div className="flex gap-3">
                          <button onClick={() => onVerifyDocument(provider, doc._id, true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"><CheckCircle className="w-4 h-4" /> Verify</button>
                          <button onClick={() => { setRejectDocId(doc._id); setShowRejectDocModal(true); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors"><XCircle className="w-4 h-4" /> Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl"><FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" /><p className="text-gray-500">No documents submitted yet</p></div>
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
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${slaMetrics.responseTime.compliant ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          <Clock className={`w-6 h-6 ${slaMetrics.responseTime.compliant ? 'text-emerald-600' : 'text-red-600'}`} />
                        </div>
                        <div><p className="font-semibold text-gray-900">Response Time</p><p className="text-xs text-gray-500">Target: {slaMetrics.responseTime.targetMinutes} min</p></div>
                      </div>
                      {slaMetrics.responseTime.compliant ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <XCircle className="w-6 h-6 text-red-500" />}
                    </div>
                    <div className="text-center mb-4"><p className="text-4xl font-bold text-gray-900">{slaMetrics.responseTime.avgMinutes}</p><p className="text-sm text-gray-500">minutes average</p></div>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${slaMetrics.bookingAcceptanceRate?.compliant ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          <CheckSquare className={`w-6 h-6 ${slaMetrics.bookingAcceptanceRate?.compliant ? 'text-emerald-600' : 'text-red-600'}`} />
                        </div>
                        <div><p className="font-semibold text-gray-900">Acceptance Rate</p><p className="text-xs text-gray-500">Target: {slaMetrics.bookingAcceptanceRate?.targetPercentage}%</p></div>
                      </div>
                    </div>
                    <div className="text-center mb-4"><p className="text-4xl font-bold text-gray-900">{slaMetrics.bookingAcceptanceRate?.rate}%</p></div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
                      <div className={`h-full rounded-full ${slaMetrics.bookingAcceptanceRate?.compliant ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${slaMetrics.bookingAcceptanceRate?.rate || 0}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-center p-2 bg-emerald-50 rounded-lg"><p className="font-bold text-emerald-600">{slaMetrics.bookingAcceptanceRate?.accepted || 0}</p><p className="text-xs text-emerald-600">Accepted</p></div>
                      <div className="text-center p-2 bg-red-50 rounded-lg"><p className="font-bold text-red-600">{slaMetrics.bookingAcceptanceRate?.rejected || 0}</p><p className="text-xs text-red-600">Rejected</p></div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${slaMetrics.completionRate?.compliant ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          <Activity className={`w-6 h-6 ${slaMetrics.completionRate?.compliant ? 'text-emerald-600' : 'text-red-600'}`} />
                        </div>
                        <div><p className="font-semibold text-gray-900">Completion Rate</p><p className="text-xs text-gray-500">Target: {slaMetrics.completionRate?.targetPercentage}%</p></div>
                      </div>
                    </div>
                    <div className="text-center mb-4"><p className="text-4xl font-bold text-gray-900">{slaMetrics.completionRate?.rate}%</p></div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center p-2 bg-emerald-50 rounded-lg"><p className="font-bold text-emerald-600">{slaMetrics.completionRate?.completed || 0}</p><p className="text-xs text-emerald-600">Done</p></div>
                      <div className="text-center p-2 bg-amber-50 rounded-lg"><p className="font-bold text-amber-600">{slaMetrics.completionRate?.cancelled || 0}</p><p className="text-xs text-amber-600">Cancelled</p></div>
                      <div className="text-center p-2 bg-red-50 rounded-lg"><p className="font-bold text-red-600">{slaMetrics.completionRate?.noShow || 0}</p><p className="text-xs text-red-600">No Show</p></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl"><Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" /><p className="text-gray-900 font-medium">No bookings in the last 30 days</p></div>
              )}
            </div>
          )}

          {activeTab === 'fraud' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Fraud Detection & Security</h3>
                  {fraudRiskLevel && <p className="text-sm text-nilin-warmGray mt-1">Risk level: <span className="font-semibold text-nilin-charcoal capitalize">{fraudRiskLevel}</span></p>}
                  {lastFraudReport && <p className="text-xs text-nilin-warmGray mt-1">Last check: score {lastFraudReport.riskScore} ({lastFraudReport.riskLevel})</p>}
                </div>
                <button onClick={() => onRunFraudCheck(provider)} className="px-4 py-2.5 bg-nilin-coral text-white text-sm font-medium rounded-xl hover:bg-nilin-rose flex items-center gap-2 transition-colors shadow-sm">
                  <RefreshCw className="w-4 h-4" /> Run Check
                </button>
              </div>
              {fraudFlags.length > 0 ? (
                <div className="space-y-4">
                  {fraudFlags.map((flag) => (
                    <div key={flag._id} className={`rounded-2xl p-5 border ${flag.severity === 'critical' ? 'bg-red-50 border-red-200' : flag.severity === 'high' ? 'bg-orange-50 border-orange-200' : flag.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${flag.severity === 'critical' ? 'bg-red-100' : flag.severity === 'high' ? 'bg-orange-100' : flag.severity === 'medium' ? 'bg-amber-100' : 'bg-yellow-100'}`}>
                            <AlertTriangle className={`w-6 h-6 ${flag.severity === 'critical' ? 'text-red-600' : flag.severity === 'high' ? 'text-orange-600' : flag.severity === 'medium' ? 'text-amber-600' : 'text-yellow-600'}`} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 capitalize">{flag.type.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                            <p className="text-xs text-gray-500 mt-2">Detected: {new Date(flag.detectedAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <SeverityBadge severity={flag.severity} />
                          <button type="button" onClick={() => setResolveFlagId(flag._id)} className="text-xs font-medium text-nilin-coral hover:underline">Resolve</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center"><ShieldCheck className="w-10 h-10 text-emerald-600" /></div>
                  <p className="text-emerald-700 font-semibold">All Clear!</p>
                  <p className="text-emerald-600 text-sm mt-1">No fraud flags detected for this provider</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            {['pending', 'in_progress'].includes(profileOverall) && (
              <>
                <button onClick={() => onApprove(provider)} className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-colors shadow-sm"><CheckCircle className="w-5 h-5" /> Approve Provider</button>
                <button onClick={() => setShowRejectModal(true)} className="px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 flex items-center gap-2 transition-colors shadow-sm"><XCircle className="w-5 h-5" /> Reject</button>
              </>
            )}
            {(['approved', 'verified'].includes(profileOverall) || (accountStatus === 'active' && verificationStatus === 'verified')) && (
              <button onClick={() => { setSuspendNotes(''); setShowSuspendModal(true); }} className="px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 flex items-center gap-2 transition-colors shadow-sm"><Ban className="w-5 h-5" /> Suspend Provider</button>
            )}
            {(profileOverall === 'suspended' || (accountStatus === 'suspended' && verificationStatus === 'suspended')) && (
              <button onClick={() => onReactivate(provider)} className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-colors shadow-sm"><RefreshCw className="w-5 h-5" /> Reactivate Provider</button>
            )}
          </div>
          <button onClick={onClose} className="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors">Close</button>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center"><XCircle className="w-6 h-6 text-red-600" /></div>
                <div><h3 className="text-lg font-semibold text-gray-900">Reject Provider</h3><p className="text-sm text-gray-500">This action cannot be undone</p></div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <select value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                <textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent" placeholder="Additional notes for the provider..." />
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => { onReject(provider, rejectionReason, actionNotes); setShowRejectModal(false); }} disabled={!rejectionReason} className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Reject Provider</button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center"><Ban className="w-6 h-6 text-amber-600" /></div>
                <div><h3 className="text-lg font-semibold text-gray-900">Suspend Provider</h3><p className="text-sm text-gray-500">This will temporarily block their account</p></div>
              </div>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <textarea value={suspendNotes} onChange={(e) => setSuspendNotes(e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent" placeholder="Reason for suspension..." />
            </div>
            <div className="flex gap-3 p-6 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setShowSuspendModal(false)} className="flex-1 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => { onSuspend(provider, suspendNotes.trim()); setShowSuspendModal(false); setSuspendNotes(''); }} disabled={!suspendNotes.trim()} className="flex-1 px-4 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Suspend Provider</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Document Modal */}
      {showRejectDocModal && rejectDocId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Reject document</h3>
            <textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Rejection reason (required)" />
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowRejectDocModal(false); setRejectDocId(null); }} className="flex-1 px-4 py-2.5 border rounded-xl">Cancel</button>
              <button type="button" disabled={!actionNotes.trim()} onClick={() => { onVerifyDocument(provider, rejectDocId, false, actionNotes.trim()); setShowRejectDocModal(false); setRejectDocId(null); setActionNotes(''); }} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Flag Modal */}
      {resolveFlagId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Resolve fraud flag</h3>
            <textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Resolution notes" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setResolveFlagId(null)} className="flex-1 px-4 py-2.5 border rounded-xl">Cancel</button>
              <button type="button" disabled={!resolveNotes.trim()} onClick={() => { onResolveFraudFlag(provider, resolveFlagId, resolveNotes.trim()); setResolveFlagId(null); setResolveNotes(''); }} className="flex-1 px-4 py-2.5 bg-nilin-coral text-white rounded-xl disabled:opacity-50">Resolve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderDetailModal;
