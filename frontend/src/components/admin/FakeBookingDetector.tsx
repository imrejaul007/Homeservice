import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Clock,
  AlertTriangle,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Users,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Bell,
  Zap,
  Target,
  BarChart3,
  Phone,
  Mail,
  MessageSquare,
  Fingerprint,
  Clock3,
  AlertCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

/** Mutation endpoints are not implemented for this widget — actions are read-only. */
const WIDGET_MUTATIONS_READ_ONLY = true;

interface SuspiciousBooking {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  providerId?: string;
  providerName?: string;
  type: 'ring_detection' | 'velocity' | 'pattern' | 'geolocation' | 'behavioral';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'investigating' | 'confirmed_fake' | 'legitimate' | 'pending_review';
  detectedAt: string;
  evidence: {
    bookingCount: number;
    timeframeHours: number;
    ipAddresses: string[];
    deviceFingerprints: string[];
    locations: Array<{ lat: number; lng: number; address: string }>;
    amount: number;
    serviceCategory: string;
  };
  investigation: {
    assignedTo?: string;
    notes: Array<{ text: string; author: string; createdAt: string }>;
    actions: Array<{ type: string; by: string; at: string }>;
  };
}

interface FakeBookingStats {
  totalDetected: number;
  investigating: number;
  confirmedFake: number;
  legitimate: number;
  detectionRate: number;
  falsePositiveRate: number;
  avgInvestigationTime: number;
  byType: Array<{ type: string; count: number; confirmed: number; color: string }>;
  bySeverity: { low: number; medium: number; high: number; critical: number };
  trend: Array<{ date: string; detected: number; confirmed: number; dismissed: number }>;
  ringSizes: Array<{ size: number; count: number }>;
  velocityAlerts: Array<{ threshold: string; triggered: number }>;
}

interface FakeBookingDetectorProps {
  embedded?: boolean;
  onClose?: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ring_detection: { label: 'Ring Detection', icon: Users, color: '#EF4444' },
  velocity: { label: 'Velocity Alert', icon: Zap, color: '#F59E0B' },
  pattern: { label: 'Pattern Match', icon: BarChart3, color: '#8B5CF6' },
  geolocation: { label: 'Geolocation', icon: MapPin, color: '#3B82F6' },
  behavioral: { label: 'Behavioral', icon: Fingerprint, color: '#EC4899' }
};

const SEVERITY_CONFIG = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' }
};

const STATUS_CONFIG = {
  investigating: { label: 'Investigating', color: 'bg-blue-100 text-blue-700', icon: Eye },
  confirmed_fake: { label: 'Confirmed Fake', color: 'bg-red-100 text-red-700', icon: Ban },
  legitimate: { label: 'Legitimate', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending_review: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock }
};

export const FakeBookingDetector: React.FC<FakeBookingDetectorProps> = ({
  embedded = false,
  onClose
}) => {
  const [bookings, setBookings] = useState<SuspiciousBooking[]>([]);
  const [stats, setStats] = useState<FakeBookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<SuspiciousBooking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [investigationNote, setInvestigationNote] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/fake-booking-detection');

      if (response.data?.success) {
        setBookings(response.data.data.bookings || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching fake booking detection data:', err);
      setError(getAdminFetchErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: SuspiciousBooking['status']) => {
    if (WIDGET_MUTATIONS_READ_ONLY) return;
    setActionLoading(bookingId);
    try {
      await api.patch(`/admin/fake-booking-detection/${bookingId}`, { status: newStatus });
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, status: newStatus } : b
      ));
    } catch (err) {
      console.error('Error updating booking status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddNote = async (bookingId: string) => {
    if (WIDGET_MUTATIONS_READ_ONLY || !investigationNote.trim()) return;

    setActionLoading(bookingId);
    try {
      await api.post(`/admin/fake-booking-detection/${bookingId}/notes`, {
        text: investigationNote,
        author: 'admin@nilin.com'
      });
      setBookings(prev => prev.map(b =>
        b.id === bookingId
          ? {
              ...b,
              investigation: {
                ...b.investigation,
                notes: [
                  ...b.investigation.notes,
                  { text: investigationNote, author: 'admin@nilin.com', createdAt: new Date().toISOString() }
                ]
              }
            }
          : b
      ));
      setInvestigationNote('');
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch =
      booking.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.bookingId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    const matchesType = typeFilter === 'all' || booking.type === typeFilter;
    const matchesSeverity = severityFilter === 'all' || booking.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesType && matchesSeverity;
  });

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-nilin-blush/30 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Fake Booking Detection</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Fake Booking Detection</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Identify & investigate suspicious booking patterns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <XCircle className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalDetected || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Detected</p>
        </div>
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <Eye className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{stats?.investigating || 0}</p>
          <p className="text-xs text-nilin-warmGray">Investigating</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <Ban className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.confirmedFake || 0}</p>
          <p className="text-xs text-nilin-warmGray">Confirmed Fake</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.legitimate || 0}</p>
          <p className="text-xs text-nilin-warmGray">Legitimate</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Target className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{stats?.detectionRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Detection Rate</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">False Positive Rate</span>
            <span className="text-lg font-serif text-nilin-charcoal">{stats?.falsePositiveRate || 0}%</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Avg. Investigation Time</span>
            <span className="text-lg font-serif text-nilin-charcoal">{stats?.avgInvestigationTime || 0}h</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Critical Alerts</span>
            <span className="text-lg font-serif text-red-600">{stats?.bySeverity.critical || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-orange-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">High Alerts</span>
            <span className="text-lg font-serif text-orange-600">{stats?.bySeverity.high || 0}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Detection Trend */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Detection Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Line type="monotone" dataKey="detected" stroke="#EF4444" strokeWidth={2} name="Detected" />
                <Line type="monotone" dataKey="confirmed" stroke="#DC2626" strokeWidth={2} name="Confirmed" />
                <Line type="monotone" dataKey="dismissed" stroke="#10B981" strokeWidth={2} name="Dismissed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Type */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Detection Type</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.byType || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" stroke="#6B7280" fontSize={11} />
                <YAxis dataKey="type" type="category" stroke="#6B7280" fontSize={11} width={100} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="count" fill="#8B5CF6" name="Detected" radius={[0, 4, 4, 0]} />
                <Bar dataKey="confirmed" fill="#EF4444" name="Confirmed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, booking ID..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="investigating">Investigating</option>
          <option value="pending_review">Pending Review</option>
          <option value="confirmed_fake">Confirmed Fake</option>
          <option value="legitimate">Legitimate</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          <option value="ring_detection">Ring Detection</option>
          <option value="velocity">Velocity</option>
          <option value="pattern">Pattern</option>
          <option value="geolocation">Geolocation</option>
          <option value="behavioral">Behavioral</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Bookings List */}
      <div className="space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No suspicious bookings match your filters</p>
          </div>
        ) : (
          filteredBookings.map(booking => {
            const typeConfig = TYPE_CONFIG[booking.type];
            const severityConfig = SEVERITY_CONFIG[booking.severity];
            const statusConfig = STATUS_CONFIG[booking.status];
            const StatusIcon = statusConfig.icon;
            const isSelected = selectedBooking?.id === booking.id;

            return (
              <div
                key={booking.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  booking.severity === 'critical' ? 'border-red-200 bg-red-50/30' :
                  booking.severity === 'high' ? 'border-orange-200 bg-orange-50/30' :
                  booking.status === 'confirmed_fake' ? 'border-red-100 bg-red-50/20' :
                  booking.status === 'legitimate' ? 'border-green-100/50' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('p-2 rounded-lg', booking.severity === 'critical' ? 'bg-red-100' : 'bg-nilin-blush/30')}>
                    <typeConfig.icon className="w-5 h-5" style={{ color: typeConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-nilin-charcoal">{booking.customerName}</span>
                      <span className="font-mono text-xs text-nilin-warmGray">{booking.bookingId}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', severityConfig.color)}>
                        {severityConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig.label}
                      </span>
                      <span className="px-2 py-0.5 bg-nilin-blush text-nilin-charcoal rounded text-xs font-medium">
                        {typeConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {booking.customerEmail}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(booking.detectedAt).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {booking.evidence.bookingCount} bookings / {booking.evidence.timeframeHours}h
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(booking.status === 'investigating' || booking.status === 'pending_review') && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'confirmed_fake')}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === booking.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Mark as confirmed fake'}
                          className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'legitimate')}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === booking.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Mark as legitimate'}
                          className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedBooking(isSelected ? null : booking)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    {/* Evidence */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Evidence</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/50 rounded-lg p-3">
                          <p className="text-xs text-nilin-warmGray">Bookings</p>
                          <p className="text-xl font-serif text-nilin-charcoal">{booking.evidence.bookingCount}</p>
                        </div>
                        <div className="bg-white/50 rounded-lg p-3">
                          <p className="text-xs text-nilin-warmGray">Timeframe</p>
                          <p className="text-xl font-serif text-nilin-charcoal">{booking.evidence.timeframeHours}h</p>
                        </div>
                        <div className="bg-white/50 rounded-lg p-3">
                          <p className="text-xs text-nilin-warmGray">Amount</p>
                          <p className="text-xl font-serif text-nilin-charcoal">AED {booking.evidence.amount}</p>
                        </div>
                        <div className="bg-white/50 rounded-lg p-3">
                          <p className="text-xs text-nilin-warmGray">Service</p>
                          <p className="text-xl font-serif text-nilin-charcoal">{booking.evidence.serviceCategory}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-nilin-warmGray mb-2">IP Addresses ({booking.evidence.ipAddresses.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {booking.evidence.ipAddresses.map((ip, idx) => (
                              <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                                {ip}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-nilin-warmGray mb-2">Devices ({booking.evidence.deviceFingerprints.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {booking.evidence.deviceFingerprints.map((fp, idx) => (
                              <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                                {fp}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {booking.evidence.locations.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-nilin-warmGray mb-2">Locations</p>
                          <div className="space-y-1">
                            {booking.evidence.locations.map((loc, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <MapPin className="w-3 h-3 text-nilin-coral" />
                                <span className="text-nilin-charcoal">{loc.address}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Investigation Notes */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Investigation</h4>
                      {booking.investigation.notes.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {booking.investigation.notes.map((note, idx) => (
                            <div key={idx} className="p-3 bg-blue-50/50 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-blue-700">{note.author}</span>
                                <span className="text-xs text-nilin-warmGray">
                                  {new Date(note.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-nilin-charcoal">{note.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={investigationNote}
                          onChange={(e) => setInvestigationNote(e.target.value)}
                          placeholder="Add investigation note..."
                          className="flex-1 px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddNote(booking.id)}
                        />
                        <button
                          onClick={() => handleAddNote(booking.id)}
                          disabled={WIDGET_MUTATIONS_READ_ONLY || !investigationNote.trim() || actionLoading === booking.id}
                          title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Add note'}
                          className="px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    {booking.investigation.actions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Actions Taken</h4>
                        <div className="space-y-1">
                          {booking.investigation.actions.map((action, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-nilin-warmGray">
                              <span className="w-2 h-2 rounded-full bg-nilin-coral" />
                              <span className="text-nilin-charcoal">{action.type}</span>
                              <span>by {action.by}</span>
                              <span className="ml-auto">{new Date(action.at).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FakeBookingDetector;
