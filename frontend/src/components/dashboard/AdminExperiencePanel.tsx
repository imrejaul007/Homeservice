import React, { useState, useEffect, useCallback } from 'react';
import {
  Star,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
  User,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { experienceApi } from '../../services/experienceApi';
import type { Experience, ExperienceStats, ExperienceFilters } from '../../types/experience';

interface AdminExperiencePanelProps {
  embedded?: boolean;
  onClose?: () => void;
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

const AdminExperiencePanel: React.FC<AdminExperiencePanelProps> = ({
  embedded = false,
  onClose
}) => {
  // State
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [stats, setStats] = useState<ExperienceStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    averageRating: 0,
    featuredCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExperiences, setSelectedExperiences] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewingExperience, setViewingExperience] = useState<Experience | null>(null);
  const limit = 10;

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchExperiences();
  }, [activeTab, currentPage, searchQuery]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchExperiences = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: ExperienceFilters = {
        status: activeTab === 'all' ? undefined : activeTab,
        search: searchQuery || undefined,
        page: currentPage,
        limit
      };

      const response = await experienceApi.getAllExperiences(filters);

      if (response.success) {
        setExperiences(response.data.experiences || []);
        if (response.data.pages) {
          setTotalPages(response.data.pages || 1);
        }
      } else {
        setError('Failed to load experiences');
      }
    } catch (err) {
      console.error('Error fetching experiences:', err);
      setError('Failed to load experiences. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const response = await experienceApi.getStats();
      if (response.success) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedExperiences(new Set());
  };

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchExperiences();
  }, []);

  const toggleSelection = (id: string) => {
    setSelectedExperiences(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedExperiences.size === experiences.length) {
      setSelectedExperiences(new Set());
    } else {
      setSelectedExperiences(new Set(experiences.map(e => e._id)));
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await experienceApi.approveExperience(id);
      if (response.success) {
        await Promise.all([fetchExperiences(), fetchStats()]);
      }
    } catch (err) {
      console.error('Error approving experience:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Please provide a reason for rejection (required):');
    if (!reason || !reason.trim()) {
      return;
    }

    setActionLoading(id);
    try {
      const response = await experienceApi.rejectExperience(id, reason.trim());
      if (response.success) {
        await Promise.all([fetchExperiences(), fetchStats()]);
      }
    } catch (err) {
      console.error('Error rejecting experience:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleFeatured = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await experienceApi.toggleFeatured(id);
      if (response.success) {
        await fetchExperiences();
        await fetchStats();
      }
    } catch (err) {
      console.error('Error toggling featured:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this experience? This action cannot be undone.')) {
      return;
    }

    setActionLoading(id);
    try {
      const response = await experienceApi.deleteExperienceAdmin(id);
      if (response.success) {
        await Promise.all([fetchExperiences(), fetchStats()]);
        setSelectedExperiences(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Error deleting experience:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedExperiences.size === 0) return;

    setActionLoading('bulk-approve');
    try {
      const response = await experienceApi.bulkApprove(Array.from(selectedExperiences));
      if (response.success) {
        setSelectedExperiences(new Set());
        await Promise.all([fetchExperiences(), fetchStats()]);
      }
    } catch (err) {
      console.error('Error bulk approving:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkReject = async () => {
    if (selectedExperiences.size === 0) return;

    const reason = window.prompt('Please provide a reason for rejection (required):');
    if (!reason || !reason.trim()) {
      return;
    }

    setActionLoading('bulk-reject');
    try {
      const response = await experienceApi.bulkReject(Array.from(selectedExperiences), reason.trim());
      if (response.success) {
        setSelectedExperiences(new Set());
        await Promise.all([fetchExperiences(), fetchStats()]);
      }
    } catch (err) {
      console.error('Error bulk rejecting:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-3.5 w-3.5',
              star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'
            )}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      approved: 'bg-green-50 text-green-700 border-green-200',
      rejected: 'bg-red-50 text-red-700 border-red-200'
    };
    return cn(
      'px-2.5 py-1 rounded-full text-xs font-medium border',
      styles[status as keyof typeof styles] || styles.pending
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Stats Cards
  const statsCards = [
    { label: 'Total', value: stats.total, icon: Star, color: 'bg-nilin-coral/20 text-nilin-coral' },
    { label: 'Pending', value: stats.pending, icon: Clock || Loader2, color: 'bg-amber-500/20 text-amber-600' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'bg-green-500/20 text-green-600' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'bg-red-500/20 text-red-600' }
  ];

  return (
    <div className={cn("bg-white rounded-2xl shadow-sm", embedded ? "" : "max-w-7xl mx-auto p-6")}>
      {/* Header */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Experience Management</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Review and manage customer experiences</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchExperiences}
              disabled={isLoading}
              className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
            >
              <RefreshCw className={cn('h-5 w-5 text-nilin-warmGray', isLoading && 'animate-spin')} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
              >
                <XCircle className="h-5 w-5 text-nilin-warmGray" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statsCards.map((stat, index) => (
          <div
            key={index}
            className="glass rounded-xl p-4 border border-nilin-border/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nilin-warmGray">{stat.label}</p>
                <p className="text-2xl font-serif text-nilin-charcoal mt-1">
                  {isLoadingStats ? '-' : stat.value}
                </p>
              </div>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-nilin-blush/30 rounded-xl">
          {(['all', 'pending', 'approved', 'rejected'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
                activeTab === tab
                  ? 'bg-white text-nilin-charcoal shadow-sm'
                  : 'text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search experiences..."
              className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors text-sm font-medium"
          >
            Search
          </button>
        </form>
      </div>

      {/* Bulk Actions */}
      {selectedExperiences.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-nilin-blush/50 rounded-xl mb-4">
          <p className="text-sm text-nilin-charcoal">
            {selectedExperiences.size} experience{selectedExperiences.size > 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkApprove}
              disabled={actionLoading === 'bulk-approve'}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              {actionLoading === 'bulk-approve' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve All
            </button>
            <button
              onClick={handleBulkReject}
              disabled={actionLoading === 'bulk-reject'}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              {actionLoading === 'bulk-reject' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject All
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-nilin-error/10 border border-nilin-error/20 rounded-xl mb-4">
          <AlertCircle className="h-5 w-5 text-nilin-error" />
          <p className="text-sm text-nilin-error">{error}</p>
          <button
            onClick={fetchExperiences}
            className="ml-auto text-sm text-nilin-error hover:underline"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-nilin-coral" />
        </div>
      )}

      {/* Data Table */}
      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-xl border border-nilin-border/50">
          <table className="w-full">
            <thead className="bg-nilin-blush/30">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={experiences.length > 0 && selectedExperiences.size === experiences.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                  Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                  Media
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                  Featured
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nilin-border/50">
              {experiences.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-nilin-warmGray">
                    No experiences found
                  </td>
                </tr>
              ) : (
                experiences.map((experience) => (
                  <tr
                    key={experience._id}
                    className={cn(
                      'hover:bg-nilin-blush/20 transition-colors',
                      selectedExperiences.has(experience._id) && 'bg-nilin-blush/30'
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedExperiences.has(experience._id)}
                        onChange={() => toggleSelection(experience._id)}
                        className="h-4 w-4 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-nilin-coral/20 flex items-center justify-center overflow-hidden">
                          {experience.userId?.avatar ? (
                            <img
                              src={experience.userId.avatar}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-nilin-coral" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-nilin-charcoal">
                            {experience.userId?.firstName} {experience.userId?.lastName?.charAt(0)}.
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-nilin-charcoal truncate max-w-[150px]">
                        {experience.serviceId?.name || 'Unknown Service'}
                      </p>
                      <p className="text-xs text-nilin-warmGray">
                        {experience.providerId?.firstName} {experience.providerId?.lastName?.charAt(0)}.
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {renderStars(experience.rating)}
                        <span className="text-sm text-nilin-charcoal">{experience.rating}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {experience.images && experience.images.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <ImageIcon className="h-4 w-4 text-nilin-warmGray" />
                            <span className="text-sm text-nilin-charcoal">{experience.images.length}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-nilin-warmGray">None</span>
                        )}
                        {experience.videoUrl && (
                          <ExternalLink className="h-4 w-4 text-nilin-coral" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={getStatusBadge(experience.status)}>
                        {experience.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleFeatured(experience._id)}
                        disabled={actionLoading === experience._id || experience.status !== 'approved'}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          experience.isFeatured
                            ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                            : 'text-gray-400 hover:bg-gray-100',
                          (actionLoading === experience._id || experience.status !== 'approved') && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Star
                          className={cn('h-4 w-4', experience.isFeatured && 'fill-current')}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-nilin-warmGray">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(experience.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewingExperience(experience)}
                          className="p-1.5 rounded-lg text-nilin-warmGray hover:bg-nilin-blush/50 hover:text-nilin-charcoal transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {experience.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(experience._id)}
                              disabled={actionLoading === experience._id}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                              title="Approve"
                            >
                              {actionLoading === experience._id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(experience._id)}
                              disabled={actionLoading === experience._id}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(experience._id)}
                          disabled={actionLoading === experience._id}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-nilin-warmGray">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-nilin-border hover:bg-nilin-blush/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-nilin-border hover:bg-nilin-blush/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* View Experience Modal */}
      {viewingExperience && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-nilin-charcoal/60 backdrop-blur-sm"
            onClick={() => setViewingExperience(null)}
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-nilin-lg">
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-nilin-border/50 bg-white rounded-t-2xl">
              <h3 className="text-xl font-serif text-nilin-charcoal">Experience Details</h3>
              <button
                onClick={() => setViewingExperience(null)}
                className="p-2 rounded-full hover:bg-nilin-blush/50 transition-colors"
              >
                <XCircle className="h-5 w-5 text-nilin-warmGray" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center overflow-hidden">
                    {viewingExperience.userId?.avatar ? (
                      <img
                        src={viewingExperience.userId.avatar}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-nilin-coral" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-nilin-charcoal">
                      {viewingExperience.userId?.firstName} {viewingExperience.userId?.lastName}
                    </p>
                    <p className="text-sm text-nilin-warmGray">
                      {viewingExperience.serviceId?.name} by {viewingExperience.providerId?.firstName} {viewingExperience.providerId?.lastName?.charAt(0)}.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {renderStars(viewingExperience.rating)}
                  <p className="text-xs text-nilin-warmGray mt-1">
                    {formatDate(viewingExperience.createdAt)}
                  </p>
                </div>
              </div>

              {/* Title */}
              <div>
                <h4 className="text-lg font-medium text-nilin-charcoal">{viewingExperience.title}</h4>
              </div>

              {/* Description */}
              <div>
                <p className="text-nilin-charcoal whitespace-pre-wrap">{viewingExperience.description}</p>
              </div>

              {/* Images */}
              {viewingExperience.images && viewingExperience.images.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-nilin-warmGray mb-3">Photos</h5>
                  <div className="grid grid-cols-4 gap-3">
                    {viewingExperience.images.map((img, idx) => (
                      <a
                        key={idx}
                        href={img}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden bg-nilin-blush/30 hover:opacity-80 transition-opacity"
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Video */}
              {viewingExperience.videoUrl && (
                <div>
                  <h5 className="text-sm font-medium text-nilin-warmGray mb-3">Video</h5>
                  <a
                    href={viewingExperience.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-nilin-coral hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Watch Video
                  </a>
                </div>
              )}

              {/* Status & Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-nilin-border/50">
                <span className={getStatusBadge(viewingExperience.status)}>
                  {viewingExperience.status}
                </span>
                {viewingExperience.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        handleApprove(viewingExperience._id);
                        setViewingExperience(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        handleReject(viewingExperience._id);
                        setViewingExperience(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminExperiencePanel;

// Helper for Clock icon
const Clock = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
