import React, { useState, useCallback } from 'react';
import {
  Plus,
  ThumbsUp,
  MessageSquare,
  Clock,
  CheckCircle,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  Zap,
  Star,
  Send,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// Type Definitions
// ============================================

export type RequestStatus = 'under_review' | 'planned' | 'in_progress' | 'completed' | 'declined';
export type RequestCategory = 'booking' | 'payment' | 'communication' | 'features' | 'performance' | 'other';

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: RequestCategory;
  status: RequestStatus;
  upvotes: number;
  hasVoted: boolean;
  commentCount: number;
  createdAt: Date;
  userName?: string;
}

export interface CreateRequestInput {
  title: string;
  description: string;
  category: RequestCategory;
}

export interface FeatureRequestPortalProps {
  requests: FeatureRequest[];
  onCreateRequest: (input: CreateRequestInput) => Promise<void>;
  onUpvote: (requestId: string) => Promise<void>;
  onAddComment?: (requestId: string, comment: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

// ============================================
// Constants
// ============================================

const CATEGORIES: { value: RequestCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'booking', label: 'Booking', icon: <Clock className="h-4 w-4" /> },
  { value: 'payment', label: 'Payment', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'communication', label: 'Communication', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'features', label: 'Features', icon: <Zap className="h-4 w-4" /> },
  { value: 'performance', label: 'Performance', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'other', label: 'Other', icon: <Star className="h-4 w-4" /> },
];

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; bgColor: string }> = {
  under_review: { label: 'Under Review', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  planned: { label: 'Planned', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-100' },
  declined: { label: 'Declined', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

// ============================================
// Request Card Component
// ============================================

interface RequestCardProps {
  request: FeatureRequest;
  onUpvote: () => void;
  onToggleComments?: () => void;
  showComments?: boolean;
  className?: string;
}

const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onUpvote,
  onToggleComments,
  showComments,
  className,
}) => {
  const statusConfig = STATUS_CONFIG[request.status];

  return (
    <div className={cn('bg-white rounded-xl border border-nilin-border overflow-hidden', className)}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Upvote Button */}
          <button
            onClick={onUpvote}
            className={cn(
              'flex flex-col items-center p-2 rounded-lg transition-all min-w-[48px]',
              request.hasVoted
                ? 'bg-nilin-coral/10 text-nilin-coral'
                : 'bg-gray-100 text-gray-500 hover:bg-nilin-coral/10 hover:text-nilin-coral'
            )}
          >
            <ThumbsUp className={cn('h-4 w-4', request.hasVoted && 'fill-current')} />
            <span className="text-xs font-semibold mt-1">{request.upvotes}</span>
          </button>

          <div className="flex-1 min-w-0">
            {/* Category & Status */}
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-xs font-medium', CATEGORIES.find(c => c.value === request.category)?.value === request.category && 'text-nilin-coral')}>
                {CATEGORIES.find(c => c.value === request.category)?.label}
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-nilin-warmGray">
                {new Date(request.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Title */}
            <h4 className="font-medium text-nilin-charcoal mb-1">{request.title}</h4>

            {/* Description */}
            <p className="text-sm text-nilin-warmGray line-clamp-2">{request.description}</p>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={onToggleComments}
                className="flex items-center gap-1.5 text-sm text-nilin-warmGray hover:text-nilin-coral transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                <span>{request.commentCount} comments</span>
                {showComments ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              <span className={cn('text-xs font-medium px-2 py-1 rounded-full', statusConfig.bgColor, statusConfig.color)}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const FeatureRequestPortal: React.FC<FeatureRequestPortalProps> = ({
  requests,
  onCreateRequest,
  onUpvote,
  onAddComment,
  isLoading = false,
  className,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<Record<string, string>>({});

  const [selectedCategory, setSelectedCategory] = useState<RequestCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'discussed'>('popular');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState<CreateRequestInput>({
    title: '',
    description: '',
    category: 'features',
  });

  // Filter requests
  const filteredRequests = requests
    .filter(req => {
      if (selectedCategory !== 'all' && req.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && req.status !== selectedStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return req.title.toLowerCase().includes(query) ||
               req.description.toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'popular':
          return b.upvotes - a.upvotes;
        case 'discussed':
          return b.commentCount - a.commentCount;
        default:
          return 0;
      }
    });

  // Stats
  const stats = {
    total: requests.length,
    planned: requests.filter(r => r.status === 'planned' || r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  // Handle create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) return;

    await onCreateRequest(formData);
    setFormData({ title: '', description: '', category: 'features' });
    setShowForm(false);
    setIsCreating(false);
  };

  // Handle comment
  const handleComment = useCallback(async (requestId: string) => {
    const comment = newComment[requestId];
    if (!comment?.trim() || !onAddComment) return;

    await onAddComment(requestId, comment);
    setNewComment(prev => ({ ...prev, [requestId]: '' }));
  }, [newComment, onAddComment]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-nilin-charcoal">Feature Requests</h2>
          <p className="text-nilin-warmGray">Help us improve by sharing your ideas</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setIsCreating(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          New Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-nilin-border p-4 text-center">
          <p className="text-2xl font-bold text-nilin-charcoal">{stats.total}</p>
          <p className="text-sm text-nilin-warmGray">Total Requests</p>
        </div>
        <div className="bg-white rounded-xl border border-nilin-border p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.planned}</p>
          <p className="text-sm text-nilin-warmGray">In Progress</p>
        </div>
        <div className="bg-white rounded-xl border border-nilin-border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-sm text-nilin-warmGray">Completed</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-nilin-coral/30 p-6 space-y-4">
          <h3 className="font-semibold text-nilin-charcoal">Share Your Idea</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Give your idea a short title"
              className="w-full px-4 py-3 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              maxLength={100}
            />
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your idea in detail..."
              rows={3}
              className="w-full px-4 py-3 border border-nilin-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              maxLength={1000}
            />
            <div className="flex items-center gap-4">
              <select
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as RequestCategory }))}
                className="px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ title: '', description: '', category: 'features' });
                }}
                className="px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.title.trim() || !formData.description.trim()}
                className="px-6 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search requests..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value as RequestCategory | 'all')}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value as RequestStatus | 'all')}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
            <option key={value} value={value}>{config.label}</option>
          ))}
        </select>

        {/* Sort */}
        <div className="flex bg-nilin-blush/50 rounded-lg p-1">
          {(['popular', 'newest', 'discussed'] as const).map(sort => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md transition-all',
                sortBy === sort
                  ? 'bg-white text-nilin-charcoal shadow-sm'
                  : 'text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              {sort === 'popular' && <ThumbsUp className="h-4 w-4 inline mr-1" />}
              {sort === 'newest' && <Clock className="h-4 w-4 inline mr-1" />}
              {sort === 'discussed' && <MessageSquare className="h-4 w-4 inline mr-1" />}
              {sort.charAt(0).toUpperCase() + sort.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-nilin-border">
            <Star className="h-12 w-12 text-nilin-warmGray mx-auto mb-3" />
            <p className="text-nilin-charcoal font-medium">No requests found</p>
            <p className="text-sm text-nilin-warmGray mt-1">
              {searchQuery ? 'Try a different search term' : 'Be the first to share an idea!'}
            </p>
          </div>
        ) : (
          filteredRequests.map(request => (
            <div key={request.id}>
              <RequestCard
                request={request}
                onUpvote={() => onUpvote(request.id)}
                onToggleComments={() => setExpandedRequest(
                  expandedRequest === request.id ? null : request.id
                )}
                showComments={expandedRequest === request.id}
              />

              {/* Comments Section */}
              {expandedRequest === request.id && (
                <div className="mt-2 ml-14 p-4 bg-nilin-blush/20 rounded-b-xl">
                  {/* Add Comment */}
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newComment[request.id] || ''}
                      onChange={e => setNewComment(prev => ({
                        ...prev,
                        [request.id]: e.target.value,
                      }))}
                      placeholder="Add a comment..."
                      className="flex-1 px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
                    />
                    <button
                      onClick={() => handleComment(request.id)}
                      disabled={!newComment[request.id]?.trim()}
                      className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Comments List Placeholder */}
                  {request.commentCount > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-nilin-warmGray">
                        {request.commentCount} comments
                      </p>
                      {/* Comments would be rendered here */}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FeatureRequestPortal;
