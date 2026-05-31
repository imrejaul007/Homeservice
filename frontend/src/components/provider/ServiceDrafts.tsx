/**
 * ServiceDrafts - Service draft management
 * Provider Dashboard Component
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  FileText,
  Edit3,
  Trash2,
  Clock,
  Calendar,
  DollarSign,
  Image,
  MoreVertical,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Send,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ServiceDraft {
  /** Unique draft ID */
  id: string;
  /** Draft name/title */
  name: string;
  /** Service category */
  category: string;
  /** Draft description */
  description: string;
  /** Base price */
  price?: number;
  /** Currency code */
  currency?: string;
  /** Duration in minutes */
  duration?: number;
  /** Number of images */
  imageCount: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Completion percentage (0-100) */
  completionPercent: number;
  /** Missing fields */
  missingFields: string[];
  /** Is scheduled to publish */
  scheduledPublish?: string;
}

export interface ServiceDraftsProps {
  /** Array of service drafts */
  drafts: ServiceDraft[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when draft is clicked for editing */
  onEdit: (draftId: string) => void;
  /** Callback when draft is deleted */
  onDelete: (draftId: string) => Promise<void>;
  /** Callback when draft is published */
  onPublish: (draftId: string) => Promise<void>;
  /** Callback when draft is duplicated */
  onDuplicate?: (draftId: string) => Promise<void>;
  /** Callback when scheduling publish */
  onSchedulePublish?: (draftId: string, date: Date) => Promise<void>;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Individual Draft Card
// =============================================================================

interface DraftCardProps {
  draft: ServiceDraft;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onPublish: () => Promise<void>;
  onDuplicate?: () => Promise<void>;
  onSchedulePublish?: () => void;
}

const DraftCard: React.FC<DraftCardProps> = ({
  draft,
  onEdit,
  onDelete,
  onPublish,
  onDuplicate,
  onSchedulePublish,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatPrice = (price?: number, currency = 'AED') => {
    if (price === undefined) return 'Not set';
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
    }).format(price);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  const isComplete = draft.completionPercent === 100;

  return (
    <div className="bg-white rounded-xl border border-nilin-border shadow-nilin-sm overflow-hidden hover:shadow-nilin-md transition-shadow">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Service Image Placeholder */}
            <div className="w-16 h-16 rounded-lg bg-nilin-muted flex items-center justify-center overflow-hidden">
              {draft.imageCount > 0 ? (
                <div className="relative">
                  <Image className="w-6 h-6 text-nilin-lightGray" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-nilin-coral text-white text-xs rounded-full flex items-center justify-center">
                    {draft.imageCount}
                  </span>
                </div>
              ) : (
                <Image className="w-6 h-6 text-nilin-lightGray" />
              )}
            </div>

            {/* Draft Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-nilin-charcoal truncate">
                {draft.name}
              </h4>
              <p className="text-sm text-nilin-warmGray">{draft.category}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-nilin-lightGray">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(draft.updatedAt)}
                </span>
                {draft.price !== undefined && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {formatPrice(draft.price, draft.currency)}
                  </span>
                )}
                {draft.duration !== undefined && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {draft.duration} min
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-nilin-lightGray hover:text-nilin-charcoal hover:bg-nilin-muted rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-nilin-lg border border-nilin-border py-1 min-w-[160px]">
                  <button
                    onClick={() => {
                      onEdit();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-nilin-charcoal hover:bg-nilin-blush flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Draft
                  </button>
                  {onDuplicate && (
                    <button
                      onClick={() => {
                        onDuplicate();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-nilin-charcoal hover:bg-nilin-blush flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                  )}
                  {onSchedulePublish && (
                    <button
                      onClick={() => {
                        onSchedulePublish();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-nilin-charcoal hover:bg-nilin-blush flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      Schedule Publish
                    </button>
                  )}
                  <hr className="my-1 border-nilin-border" />
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete Draft
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Completion Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-nilin-warmGray">
              {isComplete ? 'Ready to publish' : 'Completion progress'}
            </span>
            <span className="text-xs font-medium text-nilin-charcoal">
              {draft.completionPercent}%
            </span>
          </div>
          <div className="h-2 bg-nilin-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                isComplete ? 'bg-green-500' : 'bg-nilin-coral'
              )}
              style={{ width: `${draft.completionPercent}%` }}
            />
          </div>
        </div>

        {/* Missing Fields */}
        {!isComplete && draft.missingFields.length > 0 && (
          <div className="mt-3 flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700">
              <p className="font-medium mb-1">Missing information:</p>
              <p>{draft.missingFields.join(', ')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 bg-nilin-muted/50 border-t border-nilin-border flex items-center justify-between">
        {draft.scheduledPublish ? (
          <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
            <Calendar className="w-4 h-4" />
            <span>Scheduled: {formatDate(draft.scheduledPublish)}</span>
          </div>
        ) : (
          <span className="text-sm text-nilin-lightGray">
            Last edited {formatDate(draft.updatedAt)}
          </span>
        )}

        <button
          onClick={handlePublish}
          disabled={!isComplete || isPublishing}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
            isComplete
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-nilin-muted text-nilin-lightGray cursor-not-allowed',
            isPublishing && 'opacity-50'
          )}
        >
          {isPublishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Publish
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// Empty State
// =============================================================================

const EmptyState: React.FC<{ onCreateNew: () => void }> = ({ onCreateNew }) => (
  <div className="text-center py-12">
    <div className="w-16 h-16 rounded-full bg-nilin-muted flex items-center justify-center mx-auto mb-4">
      <FileText className="w-8 h-8 text-nilin-lightGray" />
    </div>
    <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
      No drafts yet
    </h3>
    <p className="text-sm text-nilin-warmGray mb-6">
      Start creating a new service and save it as a draft
    </p>
    <button
      onClick={onCreateNew}
      className="inline-flex items-center gap-2 px-6 py-3 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
    >
      <FileText className="w-4 h-4" />
      Create New Service
    </button>
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

export const ServiceDrafts: React.FC<ServiceDraftsProps> = ({
  drafts,
  isLoading = false,
  onEdit,
  onDelete,
  onPublish,
  onDuplicate,
  onSchedulePublish,
  className,
}) => {
  const [filter, setFilter] = useState<'all' | 'complete' | 'incomplete'>('all');

  const filteredDrafts = drafts.filter((d) => {
    if (filter === 'complete') return d.completionPercent === 100;
    if (filter === 'incomplete') return d.completionPercent < 100;
    return true;
  });

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Service Drafts
          </h3>
          <p className="text-sm text-nilin-warmGray">
            {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === 'all'
                ? 'bg-nilin-coral text-white'
                : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
            )}
          >
            All ({drafts.length})
          </button>
          <button
            onClick={() => setFilter('complete')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === 'complete'
                ? 'bg-green-600 text-white'
                : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
            )}
          >
            Ready ({drafts.filter((d) => d.completionPercent === 100).length})
          </button>
          <button
            onClick={() => setFilter('incomplete')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === 'incomplete'
                ? 'bg-amber-500 text-white'
                : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
            )}
          >
            Incomplete ({drafts.filter((d) => d.completionPercent < 100).length})
          </button>
        </div>
      </div>

      {/* Drafts List */}
      {filteredDrafts.length > 0 ? (
        <div className="space-y-4">
          {filteredDrafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onEdit={() => onEdit(draft.id)}
              onDelete={() => onDelete(draft.id)}
              onPublish={() => onPublish(draft.id)}
              onDuplicate={onDuplicate ? () => onDuplicate(draft.id) : undefined}
              onSchedulePublish={
                onSchedulePublish ? () => onSchedulePublish(draft.id, new Date()) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState onCreateNew={() => {}} />
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ServiceDrafts;
