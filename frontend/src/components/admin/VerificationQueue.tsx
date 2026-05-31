import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Image,
  Download,
  MessageSquare,
  User,
  Building,
  Star,
  Camera,
  Upload,
  AlertCircle,
  Shield,
  Zap,
  ArrowUpDown
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
  Cell
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface VerificationItem {
  id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  providerPhone: string;
  submittedAt: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'needs_info';
  priority: 'normal' | 'high' | 'urgent';
  documents: Array<{
    id: string;
    type: string;
    label: string;
    url: string;
    thumbnail?: string;
    status: 'pending' | 'verified' | 'rejected';
    verifiedAt?: string;
    rejectionReason?: string;
  }>;
  profile: {
    avatar?: string;
    coverImage?: string;
    bio?: string;
    services: string[];
    experience?: string;
    certifications?: string[];
    rating?: number;
    completedJobs?: number;
  };
  verificationData: {
    identityVerified: boolean;
    addressVerified: boolean;
    phoneVerified: boolean;
    emailVerified: boolean;
    backgroundChecked: boolean;
  };
  assignedTo?: string;
  assignedAt?: string;
  notes: Array<{
    id: string;
    text: string;
    author: string;
    createdAt: string;
  }>;
  decision?: {
    action: 'approved' | 'rejected';
    reason: string;
    reviewedBy: string;
    reviewedAt: string;
  };
  reviewHistory: Array<{
    action: string;
    by: string;
    at: string;
    notes?: string;
  }>;
}

interface VerificationQueueStats {
  total: number;
  pending: number;
  inReview: number;
  approved: number;
  rejected: number;
  needsInfo: number;
  avgReviewTime: number;
  completionRate: number;
  urgentCount: number;
  byDocument: Array<{ type: string; count: number; pending: number; verified: number }>;
  recentDecisions: Array<{ action: 'approved' | 'rejected'; count: number; date: string }>;
}

interface VerificationQueueProps {
  embedded?: boolean;
  onClose?: () => void;
}

const DOCUMENT_TYPES: Record<string, { label: string; required: boolean; icon: React.ElementType }> = {
  id_front: { label: 'ID (Front)', required: true, icon: User },
  id_back: { label: 'ID (Back)', required: true, icon: User },
  selfie: { label: 'Selfie with ID', required: true, icon: Camera },
  address_proof: { label: 'Address Proof', required: true, icon: Building },
  certifications: { label: 'Certifications', required: false, icon: FileText },
  insurance: { label: 'Insurance', required: false, icon: Shield },
  bank_details: { label: 'Bank Details', required: false, icon: Building },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Clock },
  in_review: { label: 'In Review', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Eye },
  approved: { label: 'Approved', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
  needs_info: { label: 'Needs Info', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: AlertTriangle }
};

export const VerificationQueue: React.FC<VerificationQueueProps> = ({
  embedded = false,
  onClose
}) => {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [stats, setStats] = useState<VerificationQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<VerificationItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject' | 'request_info'>('approve');
  const [decisionReason, setDecisionReason] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/verification-queue');

      if (response.data?.success) {
        setItems(response.data.data.items || []);
        setStats(response.data.data.stats);
      } else {
        // Mock data
        setItems([
          {
            id: 'vq-001',
            providerId: 'prov-001',
            providerName: 'Ahmed Al-Rashid',
            providerEmail: 'ahmed.rashid@email.com',
            providerPhone: '+971501234567',
            submittedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            status: 'pending',
            priority: 'urgent',
            documents: [
              { id: 'doc-1', type: 'id_front', label: 'Emirates ID Front', url: '/docs/id-front-001.jpg', status: 'pending' },
              { id: 'doc-2', type: 'id_back', label: 'Emirates ID Back', url: '/docs/id-back-001.jpg', status: 'pending' },
              { id: 'doc-3', type: 'selfie', label: 'Selfie with ID', url: '/docs/selfie-001.jpg', status: 'pending' },
              { id: 'doc-4', type: 'address_proof', label: 'Utility Bill', url: '/docs/utility-001.pdf', status: 'pending' }
            ],
            profile: {
              avatar: '/avatars/prov-001.jpg',
              bio: 'Professional electrician with 10+ years experience in residential and commercial properties.',
              services: ['Electrical', 'AC Repair', 'Appliance Installation'],
              experience: '10 years',
              certifications: ['Dubai Electricity Authority Licensed', 'First Aid Certified'],
              rating: 4.8,
              completedJobs: 245
            },
            verificationData: {
              identityVerified: false,
              addressVerified: false,
              phoneVerified: true,
              emailVerified: true,
              backgroundChecked: false
            },
            notes: [],
            reviewHistory: []
          },
          {
            id: 'vq-002',
            providerId: 'prov-002',
            providerName: 'Fatima Hassan',
            providerEmail: 'fatima.h@email.com',
            providerPhone: '+971552345678',
            submittedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
            status: 'in_review',
            priority: 'high',
            assignedTo: 'admin@nilin.com',
            assignedAt: new Date(Date.now() - 3600000).toISOString(),
            documents: [
              { id: 'doc-5', type: 'id_front', label: 'Emirates ID Front', url: '/docs/id-front-002.jpg', status: 'verified', verifiedAt: new Date(Date.now() - 3600000 * 2).toISOString() },
              { id: 'doc-6', type: 'id_back', label: 'Emirates ID Back', url: '/docs/id-back-002.jpg', status: 'verified', verifiedAt: new Date(Date.now() - 3600000 * 2).toISOString() },
              { id: 'doc-7', type: 'selfie', label: 'Selfie with ID', url: '/docs/selfie-002.jpg', status: 'verified', verifiedAt: new Date(Date.now() - 3600000 * 2).toISOString() },
              { id: 'doc-8', type: 'address_proof', label: 'Utility Bill', url: '/docs/utility-002.pdf', status: 'pending' },
              { id: 'doc-9', type: 'certifications', label: 'Beauty License', url: '/docs/license-002.pdf', status: 'verified', verifiedAt: new Date(Date.now() - 3600000).toISOString() }
            ],
            profile: {
              avatar: '/avatars/prov-002.jpg',
              bio: 'Experienced beauty therapist specializing in hair styling and makeup.',
              services: ['Hair Styling', 'Makeup', 'Nail Care', 'Facials'],
              experience: '7 years',
              certifications: ['DHCC Certified', 'International Makeup Artist'],
              rating: 4.9,
              completedJobs: 312
            },
            verificationData: {
              identityVerified: true,
              addressVerified: false,
              phoneVerified: true,
              emailVerified: true,
              backgroundChecked: true
            },
            notes: [
              { id: 'n1', text: 'Address document needs additional verification - name mismatch', author: 'admin@nilin.com', createdAt: new Date(Date.now() - 3600000).toISOString() }
            ],
            reviewHistory: []
          },
          {
            id: 'vq-003',
            providerId: 'prov-003',
            providerName: 'Omar Malik',
            providerEmail: 'omar.malik@email.com',
            providerPhone: '+971504567890',
            submittedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
            status: 'pending',
            priority: 'normal',
            documents: [
              { id: 'doc-10', type: 'id_front', label: 'Emirates ID Front', url: '/docs/id-front-003.jpg', status: 'pending' },
              { id: 'doc-11', type: 'id_back', label: 'Emirates ID Back', url: '/docs/id-back-003.jpg', status: 'pending' },
              { id: 'doc-12', type: 'selfie', label: 'Selfie with ID', url: '/docs/selfie-003.jpg', status: 'pending' },
              { id: 'doc-13', type: 'address_proof', label: 'Tenancy Contract', url: '/docs/tenancy-003.pdf', status: 'pending' },
              { id: 'doc-14', type: 'insurance', label: 'Professional Liability', url: '/docs/insurance-003.pdf', status: 'pending' }
            ],
            profile: {
              avatar: '/avatars/prov-003.jpg',
              bio: 'Expert plumber for all your residential and commercial plumbing needs.',
              services: ['Plumbing', 'Drain Cleaning', 'Water Heater Installation'],
              experience: '8 years',
              certifications: ['Dubai Municipality Licensed', 'ISO 9001 Certified'],
              rating: 4.6,
              completedJobs: 189
            },
            verificationData: {
              identityVerified: false,
              addressVerified: false,
              phoneVerified: true,
              emailVerified: true,
              backgroundChecked: false
            },
            notes: [],
            reviewHistory: []
          },
          {
            id: 'vq-004',
            providerId: 'prov-004',
            providerName: 'Sara Khan',
            providerEmail: 'sara.khan@email.com',
            providerPhone: '+971556789012',
            submittedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
            status: 'needs_info',
            priority: 'high',
            documents: [
              { id: 'doc-15', type: 'id_front', label: 'Emirates ID Front', url: '/docs/id-front-004.jpg', status: 'rejected', rejectionReason: 'Image too blurry, please resubmit' },
              { id: 'doc-16', type: 'id_back', label: 'Emirates ID Back', url: '/docs/id-back-004.jpg', status: 'pending' },
              { id: 'doc-17', type: 'selfie', label: 'Selfie with ID', url: '/docs/selfie-004.jpg', status: 'pending' },
              { id: 'doc-18', type: 'address_proof', label: 'DEWA Bill', url: '/docs/dewa-004.pdf', status: 'pending' }
            ],
            profile: {
              avatar: '/avatars/prov-004.jpg',
              bio: 'Professional cleaning services for homes and offices.',
              services: ['Home Cleaning', 'Deep Cleaning', 'Office Cleaning'],
              experience: '5 years',
              certifications: [],
              rating: 4.7,
              completedJobs: 156
            },
            verificationData: {
              identityVerified: false,
              addressVerified: false,
              phoneVerified: true,
              emailVerified: true,
              backgroundChecked: false
            },
            notes: [
              { id: 'n2', text: 'Requested clearer ID document - awaiting response', author: 'admin@nilin.com', createdAt: new Date(Date.now() - 3600000 * 12).toISOString() }
            ],
            reviewHistory: []
          },
          {
            id: 'vq-005',
            providerId: 'prov-005',
            providerName: 'Youssef Ibrahim',
            providerEmail: 'y.ibrahim@email.com',
            providerPhone: '+971501234999',
            submittedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
            status: 'approved',
            priority: 'normal',
            documents: [
              { id: 'doc-19', type: 'id_front', label: 'Emirates ID Front', url: '/docs/id-front-005.jpg', status: 'verified', verifiedAt: new Date(Date.now() - 3600000 * 36).toISOString() },
              { id: 'doc-20', type: 'id_back', label: 'Emirates ID Back', url: '/docs/id-back-005.jpg', status: 'verified', verifiedAt: new Date(Date.now() - 3600000 * 36).toISOString() },
              { id: 'doc-21', type: 'selfie', label: 'Selfie with ID', url: '/docs/selfie-005.jpg', status: 'verified', verifiedAt: new Date(Date.now() - 3600000 * 36).toISOString() },
              { id: 'doc-22', type: 'address_proof', label: 'Tenancy Contract', url: '/docs/tenancy-005.pdf', status: 'verified', verifiedAt: new Date(Date.now() - 3600000 * 24).toISOString() },
              { id: 'doc-23', type: 'certifications', label: 'Carpentry Certificate', url: '/docs/cert-005.pdf', status: 'verified', verifiedAt: new Date(Date.now() - 3600000 * 24).toISOString() }
            ],
            profile: {
              avatar: '/avatars/prov-005.jpg',
              bio: 'Master carpenter with expertise in custom furniture and renovations.',
              services: ['Carpentry', 'Furniture Repair', 'Cabinet Installation'],
              experience: '12 years',
              certifications: ['Master Carpenter Certificate', 'Safety Training'],
              rating: 4.8,
              completedJobs: 278
            },
            verificationData: {
              identityVerified: true,
              addressVerified: true,
              phoneVerified: true,
              emailVerified: true,
              backgroundChecked: true
            },
            decision: {
              action: 'approved',
              reason: 'All documents verified, profile complete',
              reviewedBy: 'admin@nilin.com',
              reviewedAt: new Date(Date.now() - 3600000 * 24).toISOString()
            },
            notes: [],
            reviewHistory: [
              { action: 'Submitted for review', by: 'System', at: new Date(Date.now() - 3600000 * 72).toISOString() },
              { action: 'Identity verified', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 48).toISOString() },
              { action: 'Documents verified', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 36).toISOString() },
              { action: 'Approved', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 24).toISOString() }
            ]
          }
        ]);
        setStats({
          total: 89,
          pending: 23,
          inReview: 15,
          approved: 45,
          rejected: 4,
          needsInfo: 2,
          avgReviewTime: 4.2,
          completionRate: 94.5,
          urgentCount: 5,
          byDocument: [
            { type: 'ID Document', count: 89, pending: 12, verified: 77 },
            { type: 'Selfie', count: 85, pending: 8, verified: 77 },
            { type: 'Address Proof', count: 82, pending: 15, verified: 67 },
            { type: 'Certifications', count: 45, pending: 10, verified: 35 },
            { type: 'Insurance', count: 28, pending: 5, verified: 23 }
          ],
          recentDecisions: [
            { action: 'approved', count: 12, date: 'Today' },
            { action: 'rejected', count: 2, date: 'Today' },
            { action: 'approved', count: 18, date: 'Yesterday' },
            { action: 'rejected', count: 1, date: 'Yesterday' }
          ]
        });
      }
    } catch (err) {
      console.error('Error fetching verification queue:', err);
      setError('Failed to load verification queue');
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

  const handleStatusUpdate = async (itemId: string, newStatus: VerificationItem['status']) => {
    setActionLoading(itemId);
    try {
      await api.patch(`/admin/verification-queue/${itemId}`, { status: newStatus });
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, status: newStatus } : item
      ));
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignToMe = async (itemId: string) => {
    setActionLoading(itemId);
    try {
      await api.patch(`/admin/verification-queue/${itemId}`, {
        assignedTo: 'admin@nilin.com',
        assignedAt: new Date().toISOString(),
        status: 'in_review'
      });
      setItems(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, assignedTo: 'admin@nilin.com', assignedAt: new Date().toISOString(), status: 'in_review' as const }
          : item
      ));
    } catch (err) {
      console.error('Error assigning item:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'request_info') => {
    if (selectedItems.length === 0) return;

    setActionLoading('bulk');
    try {
      await api.post(`/admin/verification-queue/bulk-action`, {
        ids: selectedItems,
        action
      });
      setItems(prev => prev.map(item =>
        selectedItems.includes(item.id)
          ? { ...item, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'needs_info' as const }
          : item
      ));
      setSelectedItems([]);
      setBulkMode(false);
    } catch (err) {
      console.error('Error performing bulk action:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecision = async () => {
    if (!selectedItem || !decisionReason.trim()) return;

    setActionLoading('decision');
    try {
      const newStatus = decisionType === 'approve' ? 'approved' : decisionType === 'reject' ? 'rejected' : 'needs_info';
      await api.post(`/admin/verification-queue/${selectedItem.id}/decision`, {
        action: decisionType,
        reason: decisionReason
      });

      setItems(prev => prev.map(item =>
        item.id === selectedItem.id
          ? {
              ...item,
              status: newStatus,
              decision: {
                action: decisionType === 'approve' ? 'approved' : 'rejected',
                reason: decisionReason,
                reviewedBy: 'admin@nilin.com',
                reviewedAt: new Date().toISOString()
              },
              reviewHistory: [
                ...item.reviewHistory,
                {
                  action: `Decision: ${decisionType}`,
                  by: 'admin@nilin.com',
                  at: new Date().toISOString(),
                  notes: decisionReason
                }
              ]
            }
          : item
      ));

      setShowDecisionModal(false);
      setDecisionReason('');
      setSelectedItem(null);
    } catch (err) {
      console.error('Error making decision:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDocumentVerify = async (itemId: string, docId: string, status: 'verified' | 'rejected', reason?: string) => {
    setActionLoading(docId);
    try {
      await api.patch(`/admin/verification-queue/${itemId}/documents/${docId}`, { status, rejectionReason: reason });
      setItems(prev => prev.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            documents: item.documents.map(doc =>
              doc.id === docId ? { ...doc, status, rejectionReason: reason } : doc
            )
          };
        }
        return item;
      }));
    } catch (err) {
      console.error('Error verifying document:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.providerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.providerId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

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
          <UserCheck className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Verification Queue</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Verification Queue</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Review & approve provider documents</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className={cn(
              'px-4 py-2 rounded-xl border transition-colors text-sm font-medium',
              bulkMode
                ? 'bg-nilin-coral text-white border-nilin-coral'
                : 'border-nilin-border hover:bg-nilin-blush/30'
            )}
          >
            <ArrowUpDown className="w-4 h-4 inline mr-2" />
            Bulk Actions
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <X className="w-5 h-5 text-nilin-warmGray" />
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <UserCheck className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.total || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.pending || 0}</p>
          <p className="text-xs text-nilin-warmGray">Pending</p>
        </div>
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <Eye className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{stats?.inReview || 0}</p>
          <p className="text-xs text-nilin-warmGray">In Review</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.approved || 0}</p>
          <p className="text-xs text-nilin-warmGray">Approved</p>
        </div>
        <div className="glass rounded-xl border border-orange-200/50 p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-orange-600">{stats?.needsInfo || 0}</p>
          <p className="text-xs text-nilin-warmGray">Needs Info</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <XCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.rejected || 0}</p>
          <p className="text-xs text-nilin-warmGray">Rejected</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Avg. Review Time</span>
            <span className="text-lg font-serif text-nilin-charcoal">{stats?.avgReviewTime || 0}h</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Completion Rate</span>
            <span className="text-lg font-serif text-green-600">{stats?.completionRate || 0}%</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Urgent</span>
            <span className="text-lg font-serif text-red-600">{stats?.urgentCount || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Selected</span>
            <span className="text-lg font-serif text-nilin-coral">{selectedItems.length}</span>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {bulkMode && selectedItems.length > 0 && (
        <div className="mb-6 p-4 bg-nilin-coral/10 rounded-xl border border-nilin-coral/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-nilin-charcoal">
              {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('approve')}
                disabled={actionLoading === 'bulk'}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Approve All
              </button>
              <button
                onClick={() => handleBulkAction('request_info')}
                disabled={actionLoading === 'bulk'}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
              >
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Request Info
              </button>
              <button
                onClick={() => handleBulkAction('reject')}
                disabled={actionLoading === 'bulk'}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                <XCircle className="w-4 h-4 inline mr-2" />
                Reject All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email or ID..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_review">In Review</option>
          <option value="needs_info">Needs Info</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
        </select>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <UserCheck className="w-12 h-12 mx-auto mb-4 text-nilin-border" />
            <p className="font-medium">No verification items match your filters</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const statusConfig = STATUS_CONFIG[item.status];
            const StatusIcon = statusConfig.icon;
            const isSelected = selectedItem?.id === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  item.priority === 'urgent' ? 'border-red-200 bg-red-50/30' :
                  item.priority === 'high' ? 'border-orange-200 bg-orange-50/30' :
                  item.status === 'approved' ? 'border-green-200/50' :
                  item.status === 'rejected' ? 'border-red-100 bg-red-50/20' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  {bulkMode && (
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      className="mt-2 w-5 h-5 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral/30"
                    />
                  )}
                  <div className="w-12 h-12 rounded-xl bg-nilin-blush/30 flex items-center justify-center overflow-hidden">
                    {item.profile.avatar ? (
                      <img src={item.profile.avatar} alt={item.providerName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-nilin-warmGray" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-nilin-charcoal">{item.providerName}</span>
                      {item.priority !== 'normal' && (
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          item.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        )}>
                          {item.priority.toUpperCase()}
                        </span>
                      )}
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.bgColor, statusConfig.color)}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig.label}
                      </span>
                      {item.assignedTo && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          Assigned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {item.providerEmail}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {item.providerPhone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.submittedAt).toLocaleDateString()}
                      </span>
                      {item.profile.rating && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Star className="w-3 h-3 fill-current" />
                          {item.profile.rating}
                        </span>
                      )}
                      <span className="text-nilin-charcoal font-medium">
                        {item.profile.completedJobs} jobs
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.profile.services.slice(0, 3).map(service => (
                        <span key={service} className="px-2 py-0.5 bg-nilin-blush/50 rounded text-xs text-nilin-charcoal">
                          {service}
                        </span>
                      ))}
                      {item.profile.services.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-nilin-warmGray">
                          +{item.profile.services.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'pending' && (
                      <button
                        onClick={() => handleAssignToMe(item.id)}
                        disabled={actionLoading === item.id}
                        className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors text-sm font-medium"
                      >
                        {actionLoading === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign'}
                      </button>
                    )}
                    {(item.status === 'pending' || item.status === 'in_review') && (
                      <>
                        <button
                          onClick={() => { setSelectedItem(item); setDecisionType('approve'); setShowDecisionModal(true); }}
                          disabled={actionLoading === item.id}
                          className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedItem(item); setDecisionType('reject'); setShowDecisionModal(true); }}
                          disabled={actionLoading === item.id}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedItem(isSelected ? null : item)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    {/* Profile Info */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: Profile Details */}
                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Provider Profile</h4>
                        {item.profile.bio && (
                          <p className="text-sm text-nilin-warmGray mb-3">{item.profile.bio}</p>
                        )}
                        {item.profile.experience && (
                          <div className="flex items-center gap-2 text-sm mb-2">
                            <Clock className="w-4 h-4 text-nilin-warmGray" />
                            <span className="text-nilin-charcoal">{item.profile.experience} experience</span>
                          </div>
                        )}
                        {item.profile.certifications && item.profile.certifications.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-nilin-warmGray mb-1">Certifications</p>
                            <div className="flex flex-wrap gap-1">
                              {item.profile.certifications.map(cert => (
                                <span key={cert} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                                  <CheckCircle className="w-3 h-3 inline mr-1" />
                                  {cert}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Verification Checklist */}
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-3 mt-4">Verification Status</h4>
                        <div className="space-y-2">
                          {Object.entries(item.verificationData).map(([key, verified]) => (
                            <div key={key} className="flex items-center justify-between">
                              <span className="text-sm text-nilin-warmGray capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              {verified ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Documents */}
                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Submitted Documents</h4>
                        <div className="space-y-2">
                          {item.documents.map(doc => {
                            const docConfig = DOCUMENT_TYPES[doc.type] || { label: doc.type, required: false, icon: FileText };
                            const DocIcon = docConfig.icon;

                            return (
                              <div key={doc.id} className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border',
                                doc.status === 'verified' ? 'bg-green-50/50 border-green-200' :
                                doc.status === 'rejected' ? 'bg-red-50/50 border-red-200' :
                                'bg-nilin-blush/20 border-nilin-border/50'
                              )}>
                                <DocIcon className="w-5 h-5 text-nilin-warmGray" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-nilin-charcoal">{doc.label}</p>
                                    {docConfig.required && (
                                      <span className="text-xs text-red-500">*</span>
                                    )}
                                  </div>
                                  {doc.rejectionReason && (
                                    <p className="text-xs text-red-600 mt-1">{doc.rejectionReason}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setPreviewImage(doc.url)}
                                    className="p-1.5 rounded hover:bg-white/50 transition-colors"
                                    title="Preview"
                                  >
                                    <Image className="w-4 h-4 text-nilin-warmGray" />
                                  </button>
                                  {(item.status === 'pending' || item.status === 'in_review') && (
                                    <>
                                      <button
                                        onClick={() => handleDocumentVerify(item.id, doc.id, 'verified')}
                                        disabled={actionLoading === doc.id}
                                        className="p-1.5 rounded hover:bg-green-100 transition-colors"
                                        title="Verify"
                                      >
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                      </button>
                                      <button
                                        onClick={() => handleDocumentVerify(item.id, doc.id, 'rejected', 'Document rejected')}
                                        disabled={actionLoading === doc.id}
                                        className="p-1.5 rounded hover:bg-red-100 transition-colors"
                                        title="Reject"
                                      >
                                        <XCircle className="w-4 h-4 text-red-600" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Notes */}
                        {item.notes.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Notes</h4>
                            <div className="space-y-2">
                              {item.notes.map(note => (
                                <div key={note.id} className="p-3 bg-blue-50/50 rounded-lg">
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
                          </div>
                        )}

                        {/* Review History */}
                        {item.reviewHistory.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Review History</h4>
                            <div className="space-y-1">
                              {item.reviewHistory.map((history, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs text-nilin-warmGray">
                                  <span className="w-2 h-2 rounded-full bg-nilin-coral" />
                                  <span>{history.action}</span>
                                  <span className="text-nilin-charcoal">by {history.by}</span>
                                  <span className="ml-auto">{new Date(history.at).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Decision */}
                    {item.decision && (
                      <div className={cn(
                        'mt-4 p-4 rounded-xl',
                        item.decision.action === 'approved' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          {item.decision.action === 'approved' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <span className={cn(
                            'font-medium capitalize',
                            item.decision.action === 'approved' ? 'text-green-700' : 'text-red-700'
                          )}>
                            {item.decision.action}
                          </span>
                          <span className="text-nilin-warmGray">by {item.decision.reviewedBy}</span>
                        </div>
                        <p className="text-sm text-nilin-charcoal">{item.decision.reason}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Decision Modal */}
      {showDecisionModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">
              {decisionType === 'approve' ? 'Approve Provider' : decisionType === 'reject' ? 'Reject Provider' : 'Request More Information'}
            </h3>
            <p className="text-sm text-nilin-warmGray mb-4">
              {selectedItem.providerName}
            </p>
            <textarea
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder={
                decisionType === 'approve' ? 'Approval notes (optional)...' :
                decisionType === 'reject' ? 'Rejection reason (required)...' :
                'Information requested from provider...'
              }
              className="w-full px-4 py-3 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm mb-4"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDecisionModal(false); setDecisionReason(''); }}
                className="px-4 py-2 border border-nilin-border rounded-xl hover:bg-nilin-blush/30 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDecision}
                disabled={actionLoading === 'decision' || (decisionType !== 'approve' && !decisionReason.trim())}
                className={cn(
                  'px-4 py-2 text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-50',
                  decisionType === 'approve' ? 'bg-green-500 hover:bg-green-600' :
                  decisionType === 'reject' ? 'bg-red-500 hover:bg-red-600' :
                  'bg-orange-500 hover:bg-orange-600'
                )}
              >
                {actionLoading === 'decision' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImage(null)}>
          <div className="max-w-4xl max-h-full">
            <img src={previewImage} alt="Document preview" className="max-w-full max-h-full object-contain rounded-lg" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationQueue;
