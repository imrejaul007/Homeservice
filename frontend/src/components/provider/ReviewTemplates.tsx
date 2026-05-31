/**
 * ReviewTemplates - Saved review response templates
 * Provider Dashboard Component
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  MessageSquare,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Check,
  Star,
  Search,
  Loader2,
  Send,
  Clock,
  FileText,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export type TemplateCategory = 'thank_you' | 'apology' | 'follow_up' | 'upgrade' | 'custom';

export interface ReviewTemplate {
  /** Unique template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template title (for quick reference) */
  title: string;
  /** Template content/body */
  content: string;
  /** Category */
  category: TemplateCategory;
  /** Usage count */
  usageCount: number;
  /** Average rating this template is used for */
  usedForRatings?: number[];
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Is default template */
  isDefault?: boolean;
}

export interface ReviewTemplatesProps {
  /** Available templates */
  templates: ReviewTemplate[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when template is created */
  onCreate: (template: Partial<ReviewTemplate>) => Promise<void>;
  /** Callback when template is updated */
  onUpdate: (templateId: string, template: Partial<ReviewTemplate>) => Promise<void>;
  /** Callback when template is deleted */
  onDelete: (templateId: string) => Promise<void>;
  /** Callback when template is selected for use */
  onSelect?: (template: ReviewTemplate) => void;
  /** Callback when copying template */
  onCopy?: (templateId: string) => Promise<void>;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Category Configuration
// =============================================================================

const categoryConfig: Record<TemplateCategory, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  thank_you: { label: 'Thank You', icon: Star, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  apology: { label: 'Apology', icon: MessageSquare, color: 'text-red-600', bgColor: 'bg-red-50' },
  follow_up: { label: 'Follow Up', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  upgrade: { label: 'Service Upgrade', icon: Send, color: 'text-green-600', bgColor: 'bg-green-50' },
  custom: { label: 'Custom', icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-50' },
};

// =============================================================================
// Template Form Modal
// =============================================================================

interface TemplateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (template: Partial<ReviewTemplate>) => Promise<void>;
  initialData?: Partial<ReviewTemplate>;
}

const TemplateFormModal: React.FC<TemplateFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [formData, setFormData] = useState<Partial<ReviewTemplate>>(
    initialData || {
      name: '',
      title: '',
      content: '',
      category: 'thank_you',
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.content) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-nilin-xl max-w-lg w-full">
          <div className="p-6 border-b border-nilin-border">
            <h2 className="text-lg font-semibold text-nilin-charcoal">
              {initialData?.id ? 'Edit Template' : 'Create Template'}
            </h2>
          </div>

          <div className="p-6 space-y-4">
            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Template Name *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                placeholder="e.g., Thank You for 5 Stars"
              />
            </div>

            {/* Short Title */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Short Title
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                placeholder="e.g., Thanks for your feedback!"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(categoryConfig) as TemplateCategory[]).map((cat) => {
                  const config = categoryConfig[cat];
                  const Icon = config.icon;
                  return (
                    <button
                      key={cat}
                      onClick={() => setFormData({ ...formData, category: cat })}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        formData.category === cat
                          ? `${config.bgColor} ${config.color}`
                          : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Template Content *
              </label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 resize-none"
                placeholder="Dear {customer_name},

Thank you so much for your wonderful review! We truly appreciate you taking the time to share your feedback.

We're thrilled to hear that you had a great experience with our service. Your satisfaction is our top priority, and we're always working to make every visit even better.

We look forward to serving you again soon!

Best regards,
{provider_name}"
              />
              <p className="text-xs text-nilin-lightGray mt-1">
                Use {'{customer_name}'} and {'{provider_name}'} as placeholders
              </p>
            </div>

            {/* Set as Default */}
            <label className="flex items-center gap-3 p-3 bg-nilin-muted rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault || false}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-5 h-5 text-nilin-coral rounded focus:ring-nilin-coral"
              />
              <span className="text-sm text-nilin-charcoal">
                Set as default template for this category
              </span>
            </label>
          </div>

          <div className="p-6 border-t border-nilin-border flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.content || isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {initialData?.id ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// =============================================================================
// Template Card Component
// =============================================================================

interface TemplateCardProps {
  template: ReviewTemplate;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onCopy: () => Promise<void>;
  onSelect?: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onEdit,
  onDelete,
  onCopy,
  onSelect,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const category = categoryConfig[template.category];
  const CategoryIcon = category.icon;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await onCopy();
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-nilin-sm overflow-hidden transition-all',
        template.isDefault ? 'border-nilin-coral' : 'border-nilin-border'
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', category.bgColor)}>
              <CategoryIcon className={cn('w-5 h-5', category.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-nilin-charcoal">{template.name}</h4>
                {template.isDefault && (
                  <span className="px-2 py-0.5 bg-nilin-coral/10 text-nilin-coral text-xs font-medium rounded-full">
                    Default
                  </span>
                )}
              </div>
              {template.title && (
                <p className="text-sm text-nilin-warmGray">{template.title}</p>
              )}
            </div>
          </div>

          {/* Category Badge */}
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              category.bgColor,
              category.color
            )}
          >
            {category.label}
          </span>
        </div>

        {/* Content Preview */}
        <div className="bg-nilin-muted/50 rounded-lg p-3 mb-3">
          <p className="text-sm text-nilin-charcoal line-clamp-3 whitespace-pre-wrap">
            {template.content}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-nilin-warmGray">
          <span className="flex items-center gap-1">
            <Send className="w-3 h-3" />
            Used {template.usageCount} times
          </span>
          <span>Updated {formatDate(template.updatedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-nilin-muted/50 border-t border-nilin-border flex items-center justify-between">
        <button
          onClick={handleCopy}
          disabled={isCopying}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            isCopied
              ? 'bg-green-100 text-green-700'
              : 'text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush',
            isCopying && 'opacity-50'
          )}
        >
          {isCopied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>

        <div className="flex items-center gap-1">
          {onSelect && (
            <button
              onClick={onSelect}
              className="p-2 text-nilin-coral hover:bg-nilin-coral/10 rounded-lg transition-colors"
              title="Use template"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
            title="Edit template"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-nilin-warmGray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Delete template"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ReviewTemplates: React.FC<ReviewTemplatesProps> = ({
  templates,
  isLoading = false,
  onCreate,
  onUpdate,
  onDelete,
  onSelect,
  onCopy,
  className,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReviewTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all');

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    if (categoryFilter !== 'all' && template.category !== categoryFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.title.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Group by category
  const templatesByCategory = filteredTemplates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<TemplateCategory, ReviewTemplate[]>
  );

  const handleSubmit = async (templateData: Partial<ReviewTemplate>) => {
    if (editingTemplate) {
      await onUpdate(editingTemplate.id, templateData);
    } else {
      await onCreate(templateData);
    }
    setEditingTemplate(null);
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-nilin-muted rounded-xl" />
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Review Response Templates
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {templates.length} template{templates.length !== 1 ? 's' : ''} saved
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-lightGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as TemplateCategory | 'all')}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Categories</option>
          {(Object.keys(categoryConfig) as TemplateCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {categoryConfig[cat].label}
            </option>
          ))}
        </select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => setEditingTemplate(template)}
              onDelete={() => onDelete(template.id)}
              onCopy={onCopy ? () => onCopy(template.id) : async () => {}}
              onSelect={onSelect ? () => onSelect(template) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
          <p className="text-nilin-warmGray">No templates found</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            {templates.length === 0
              ? 'Create your first review response template'
              : 'Try adjusting your filters'}
          </p>
          {templates.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg font-medium hover:bg-nilin-rose transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          )}
        </div>
      )}

      {/* Form Modal */}
      <TemplateFormModal
        isOpen={showForm || editingTemplate !== null}
        onClose={() => {
          setShowForm(false);
          setEditingTemplate(null);
        }}
        onSubmit={handleSubmit}
        initialData={editingTemplate || undefined}
      />
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ReviewTemplates;
