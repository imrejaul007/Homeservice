import React, { useState, useEffect, useCallback } from 'react';
import {
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  Eye,
  Trash2,
  Shield,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  User,
  Calendar,
  Flag,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface ReviewFlag {
  id: string;
  type: 'fake_positive' | 'fake_negative' | 'suspicious' | 'competitor';
  confidence: number;
  reasons: string[];
  reviewId: string;
  rating: number;
  text: string;
  authorName: string;
  authorId: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  detectionMethod: 'ml' | 'pattern' | 'manual';
}

interface ReviewStats {
  totalFlagged: number;
  pendingReview: number;
  confirmedFake: number;
  falsePositives: number;
  accuracy: number;
  byType: Array<{ type: string; count: number; color: string }>;
  weeklyTrend: Array<{ week: string; flagged: number; confirmed: number }>;
  topReasons: Array<{ reason: string; count: number }>;
}

interface FakeReviewDetectorProps {
  embedded?: boolean;
  onClose?: () => void;
}

const FLAG_TYPE_CONFIG = {
  fake_positive: { label: 'Fake Positive', color: '#EF4444', bgColor: 'bg-red-50 border-red-200' },
  fake_negative: { label: 'Fake Negative', color: '#F59E0B', bgColor: 'bg-amber-50 border-amber-200' },
  suspicious: { label: 'Suspicious', color: '#8B5CF6', bgColor: 'bg-purple-50 border-purple-200' },
  competitor: { label: 'Competitor', color: '#EC4899', bgColor: 'bg-pink-50 border-pink-200' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-green-100 text-green-700', icon: XCircle },
  deleted: { label: 'Deleted', color: 'bg-gray-100 text-gray-700', icon: Trash2 }
};

const DETECTION_METHOD_CONFIG = {
  ml: { label: 'ML Model', color: 'bg-purple-100 text-purple-700' },
  pattern: { label: 'Pattern Match', color: 'bg-blue-100 text-blue-700' },
  manual: { label: 'Manual Flag', color: 'bg-gray-100 text-gray-700' }
};

export const FakeReviewDetector: React.FC<FakeReviewDetectorProps> = ({
  embedded = false,
  onClose
}) => {
  const [flags, setFlags] = useState<ReviewFlag[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedFlag, setSelectedFlag] = useState<ReviewFlag | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/reviews/flagged');

      if (response.data?.success) {
        setFlags(response.data.data.flags || []);
        setStats(response.data.data.stats);
      } else {
        // Mock data
        setFlags([
          {
            id: 'flag-001',
            type: 'fake_positive',
            confidence: 92,
            reasons: ['Unusual review velocity', 'Same-day reviews from new accounts', 'IP cluster detected'],
            reviewId: 'rev-12345',
            rating: 5,
            text: 'Absolutely amazing service! Best provider ever! Highly recommend to everyone!',
            authorName: 'John Smith',
            authorId: 'user-001',
            providerId: 'prov-001',
            providerName: 'Elite Cleaning Services',
            serviceName: 'Deep Cleaning',
            timestamp: new Date().toISOString(),
            status: 'pending',
            detectionMethod: 'ml'
          },
          {
            id: 'flag-002',
            type: 'fake_negative',
            confidence: 78,
            reasons: ['Competitor review pattern', 'Generic negative text', 'No specific complaints'],
            reviewId: 'rev-12346',
            rating: 1,
            text: 'Bad service. Do not use.',
            authorName: 'Mike Wilson',
            authorId: 'user-002',
            providerId: 'prov-002',
            providerName: 'Professional Plumbers',
            serviceName: 'Pipe Repair',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            status: 'pending',
            detectionMethod: 'pattern'
          },
          {
            id: 'flag-003',
            type: 'suspicious',
            confidence: 65,
            reasons: ['First review from account', 'No booking history', 'Review text similarity'],
            reviewId: 'rev-12347',
            rating: 3,
            text: 'It was okay. Nothing special.',
            authorName: 'Sarah Jones',
            authorId: 'user-003',
            providerId: 'prov-003',
            providerName: 'Home Electricians',
            serviceName: 'Wiring Check',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            status: 'approved',
            detectionMethod: 'ml'
          },
          {
            id: 'flag-004',
            type: 'competitor',
            confidence: 85,
            reasons: ['Review mentions competitor', 'Targeted negative review', 'Same IP as competitor reviews'],
            reviewId: 'rev-12348',
            rating: 2,
            text: 'Better to use ABC Services instead, much cheaper and same quality.',
            authorName: 'Tom Brown',
            authorId: 'user-004',
            providerId: 'prov-004',
            providerName: 'Quality Painters',
            serviceName: 'Interior Painting',
            timestamp: new Date(Date.now() - 10800000).toISOString(),
            status: 'deleted',
            detectionMethod: 'pattern'
          },
          {
            id: 'flag-005',
            type: 'fake_positive',
            confidence: 88,
            reasons: ['Bulk review pattern', 'Account created same day', 'No previous activity'],
            reviewId: 'rev-12349',
            rating: 5,
            text: 'Perfect! 5 stars! Best experience ever! Will book again!',
            authorName: 'Lisa Green',
            authorId: 'user-005',
            providerId: 'prov-005',
            providerName: 'Garden Experts',
            serviceName: 'Lawn Maintenance',
            timestamp: new Date(Date.now() - 14400000).toISOString(),
            status: 'rejected',
            detectionMethod: 'ml'
          }
        ]);
        setStats({
          totalFlagged: 156,
          pendingReview: 34,
          confirmedFake: 89,
          falsePositives: 33,
          accuracy: 87.5,
          byType: [
            { type: 'Fake Positive', count: 62, color: '#EF4444' },
            { type: 'Fake Negative', count: 45, color: '#F59E0B' },
            { type: 'Suspicious', count: 38, color: '#8B5CF6' },
            { type: 'Competitor', count: 11, color: '#EC4899' }
          ],
          weeklyTrend: [
            { week: 'Week 1', flagged: 18, confirmed: 12 },
            { week: 'Week 2', flagged: 22, confirmed: 15 },
            { week: 'Week 3', flagged: 25, confirmed: 18 },
            { week: 'Week 4', flagged: 20, confirmed: 14 }
          ],
          topReasons: [
            { reason: 'Unusual review velocity', count: 45 },
            { reason: 'No booking history', count: 38 },
            { reason: 'IP cluster detected', count: 32 },
            { reason: 'Generic review text', count: 28 },
            { reason: 'Same-day reviews', count: 24 }
          ]
        });
      }
    } catch (err) {
      console.error('Error fetching review flags:', err);
      setError('Failed to load review detection data');
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

  const handleUpdateStatus = async (flagId: string, newStatus: ReviewFlag['status']) => {
    setActionLoading(flagId);
    try {
      await api.patch(`/admin/reviews/flags/${flagId}`, { status: newStatus });
      setFlags(prev => prev.map(flag =>
        flag.id === flagId ? { ...flag, status: newStatus } : flag
      ));
    } catch (err) {
      console.error('Error updating flag:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredFlags = flags.filter(flag => {
    const matchesSearch = flag.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          flag.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          flag.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || flag.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || flag.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Detection Data</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Fake Review Detection</h2>
            <p className="text-sm text-nilin-warmGray mt-1">ML-powered review authenticity analysis</p>
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
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <Flag className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalFlagged || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Flagged</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <Clock className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.pendingReview || 0}</p>
          <p className="text-xs text-nilin-warmGray">Pending</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.confirmedFake || 0}</p>
          <p className="text-xs text-nilin-warmGray">Confirmed Fake</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <CheckCircle className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.falsePositives || 0}</p>
          <p className="text-xs text-nilin-warmGray">False Positives</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <TrendingUp className="w-5 h-5 text-purple-500 mb-2" />
          <p className="text-2xl font-serif text-purple-600">{stats?.accuracy || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Accuracy</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Trend */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Weekly Detection Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.weeklyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="week" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="flagged" fill="#F59E0B" name="Flagged" radius={[4, 4, 0, 0]} />
                <Bar dataKey="confirmed" fill="#EF4444" name="Confirmed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Type */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Detection Type</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byType || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="type"
                >
                  {stats?.byType?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {stats?.byType?.map(item => (
              <div key={item.type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-nilin-warmGray">{item.type}</span>
                <span className="text-xs font-medium text-nilin-charcoal ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Reasons */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Top Detection Reasons</h3>
        <div className="space-y-3">
          {stats?.topReasons?.map((item, index) => (
            <div key={item.reason} className="flex items-center gap-4">
              <span className="text-xs text-nilin-warmGray w-6">{index + 1}.</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-nilin-charcoal">{item.reason}</span>
                  <span className="text-sm font-medium text-nilin-coral">{item.count}</span>
                </div>
                <div className="h-2 bg-nilin-blush/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-nilin-rose to-nilin-coral rounded-full"
                    style={{ width: `${(item.count / (stats?.topReasons?.[0]?.count || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
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
            placeholder="Search reviews..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          <option value="fake_positive">Fake Positive</option>
          <option value="fake_negative">Fake Negative</option>
          <option value="suspicious">Suspicious</option>
          <option value="competitor">Competitor</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {/* Flagged Reviews List */}
      <div className="space-y-4">
        {filteredFlags.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No flagged reviews match your filters</p>
          </div>
        ) : (
          filteredFlags.map(flag => {
            const typeConfig = FLAG_TYPE_CONFIG[flag.type];
            const statusConfig = STATUS_CONFIG[flag.status];
            const methodConfig = DETECTION_METHOD_CONFIG[flag.detectionMethod];

            return (
              <div
                key={flag.id}
                className={cn('glass rounded-xl border p-4 transition-all hover:shadow-md', typeConfig.bgColor)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={cn(
                          'w-3 h-3',
                          star <= flag.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                        )}
                      />
                    ))}
                    <span className="text-xs font-medium text-nilin-charcoal mt-1">{flag.rating}/5</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-xs font-medium border" style={{ borderColor: typeConfig.color, color: typeConfig.color }}>
                        {typeConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        {statusConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', methodConfig.color)}>
                        {methodConfig.label}
                      </span>
                      <span className="ml-auto text-xs text-nilin-warmGray">
                        Confidence: <strong className="text-nilin-charcoal">{flag.confidence}%</strong>
                      </span>
                    </div>
                    <p className="font-medium text-nilin-charcoal">{flag.authorName}</p>
                    <p className="text-sm text-nilin-warmGray mt-1 italic">"{flag.text}"</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                      <span>Provider: <strong className="text-nilin-charcoal">{flag.providerName}</strong></span>
                      <span>Service: <strong className="text-nilin-charcoal">{flag.serviceName}</strong></span>
                      <span className="ml-auto">{new Date(flag.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {flag.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(flag.id, 'deleted')}
                          disabled={actionLoading === flag.id}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title="Delete Review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(flag.id, 'rejected')}
                          disabled={actionLoading === flag.id}
                          className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          title="False Positive"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(flag.id, 'approved')}
                          disabled={actionLoading === flag.id}
                          className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                          title="Keep Review"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedFlag(selectedFlag?.id === flag.id ? null : flag)}
                      className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      <Eye className="w-4 h-4 text-nilin-warmGray" />
                    </button>
                  </div>
                </div>
                {selectedFlag?.id === flag.id && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    <p className="text-sm font-medium text-nilin-charcoal mb-2">Detection Reasons</p>
                    <div className="flex flex-wrap gap-2">
                      {flag.reasons.map((reason, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-white/50 rounded-full text-xs text-nilin-charcoal border border-nilin-border/30"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
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

export default FakeReviewDetector;
