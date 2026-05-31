/**
 * CustomerNotes - Per-customer notes CRM
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  User,
  MessageSquare,
  Search,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Calendar,
  Clock,
  Star,
  ChevronRight,
  Filter,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface CustomerNote {
  /** Unique note ID */
  id: string;
  /** Customer ID */
  customerId: string;
  /** Customer name */
  customerName: string;
  /** Customer avatar */
  customerAvatar?: string;
  /** Note content */
  content: string;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Tags */
  tags?: string[];
  /** Note type */
  type: 'general' | 'preference' | 'complaint' | 'compliment' | 'follow_up';
  /** Created by (provider ID) */
  createdBy: string;
  /** Whether it's pinned */
  isPinned?: boolean;
}

export interface Customer {
  /** Customer ID */
  id: string;
  /** Customer name */
  name: string;
  /** Customer avatar */
  avatar?: string;
  /** Total bookings */
  totalBookings: number;
  /** Total spent */
  totalSpent: number;
  /** Average rating given */
  avgRating: number;
  /** Last booking date */
  lastBookingDate: string;
  /** Number of notes */
  notesCount: number;
  /** Has unresolved issues */
  hasUnresolvedIssues?: boolean;
}

export interface CustomerNotesProps {
  /** Customer notes */
  notes: CustomerNote[];
  /** Customers list */
  customers: Customer[];
  /** Loading state */
  isLoading?: boolean;
  /** Current provider ID */
  providerId: string;
  /** Callback when note is created */
  onCreateNote: (note: Partial<CustomerNote>) => Promise<void>;
  /** Callback when note is updated */
  onUpdateNote: (noteId: string, note: Partial<CustomerNote>) => Promise<void>;
  /** Callback when note is deleted */
  onDeleteNote: (noteId: string) => Promise<void>;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Note Type Configuration
// =============================================================================

const noteTypeConfig: Record<CustomerNote['type'], { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  general: { label: 'General', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: MessageSquare },
  preference: { label: 'Preference', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: Star },
  complaint: { label: 'Complaint', color: 'text-red-600', bgColor: 'bg-red-50', icon: AlertCircle },
  compliment: { label: 'Compliment', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  follow_up: { label: 'Follow Up', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Clock },
};

// =============================================================================
// Note Editor Component
// =============================================================================

interface NoteEditorProps {
  customerId?: string;
  customers: Customer[];
  onSave: (note: Partial<CustomerNote>) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<CustomerNote>;
}

const NoteEditor: React.FC<NoteEditorProps> = ({
  customerId,
  customers,
  onSave,
  onCancel,
  initialData,
}) => {
  const [content, setContent] = useState(initialData?.content || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customerId || initialData?.customerId || ''
  );
  const [noteType, setNoteType] = useState<CustomerNote['type']>(
    initialData?.type || 'general'
  );
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isPinned, setIsPinned] = useState(initialData?.isPinned || false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!content.trim() || !selectedCustomerId) return;

    setIsSubmitting(true);
    try {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      await onSave({
        content: content.trim(),
        customerId: selectedCustomerId,
        customerName: customer?.name || '',
        type: noteType,
        tags,
        isPinned,
      });
      setContent('');
      setSelectedCustomerId('');
      setTags([]);
      setIsPinned(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-nilin-border p-4 mb-4">
      {/* Customer Select */}
      {!customerId && !initialData?.customerId && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-nilin-charcoal mb-1">
            Customer
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          >
            <option value="">Select a customer...</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.totalBookings} bookings)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Note Type */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-nilin-charcoal mb-1">
          Note Type
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(noteTypeConfig) as CustomerNote['type'][]).map((type) => {
            const config = noteTypeConfig[type];
            const Icon = config.icon;
            return (
              <button
                key={type}
                onClick={() => setNoteType(type)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  noteType === type
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
      <div className="mb-4">
        <label className="block text-sm font-medium text-nilin-charcoal mb-1">
          Note
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 resize-none"
          placeholder="Write your note here..."
        />
      </div>

      {/* Tags */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-nilin-charcoal mb-1">
          Tags
        </label>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-1 bg-nilin-coral/10 text-nilin-coral rounded-full text-sm"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-nilin-rose"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            className="flex-1 px-3 py-1.5 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
            placeholder="Add a tag..."
          />
          <button
            onClick={handleAddTag}
            className="px-3 py-1.5 bg-nilin-muted text-nilin-charcoal rounded-lg hover:bg-nilin-blush text-sm"
          >
            Add
          </button>
        </div>
      </div>

      {/* Pin & Actions */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="w-4 h-4 text-nilin-coral rounded focus:ring-nilin-coral"
          />
          <span className="text-sm text-nilin-warmGray">Pin this note</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim() || (!customerId && !initialData?.customerId && !selectedCustomerId) || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Note Card Component
// =============================================================================

interface NoteCardProps {
  note: CustomerNote;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  isEditing?: boolean;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onEdit, onDelete, isEditing }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const typeConfig = noteTypeConfig[note.type];
  const TypeIcon = typeConfig.icon;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
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

  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-4 transition-all',
        note.isPinned ? 'border-nilin-coral shadow-nilin-sm' : 'border-nilin-border',
        isEditing && 'ring-2 ring-nilin-coral/30'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {note.isPinned && (
            <span className="text-nilin-coral text-xs font-medium">Pinned</span>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              typeConfig.bgColor,
              typeConfig.color
            )}
          >
            <TypeIcon className="w-3 h-3" />
            {typeConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 text-nilin-warmGray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-sm text-nilin-charcoal mb-3 whitespace-pre-wrap">
        {note.content}
      </p>

      {note.tags && note.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-nilin-muted text-nilin-warmGray rounded-full text-xs"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-nilin-lightGray">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span>{note.customerName}</span>
        </div>
        <span>{formatDate(note.createdAt)}</span>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const CustomerNotes: React.FC<CustomerNotesProps> = ({
  notes,
  customers,
  isLoading = false,
  providerId,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  currency = 'AED',
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [filterType, setFilterType] = useState<CustomerNote['type'] | 'all'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<CustomerNote | null>(null);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        if (filterCustomer !== 'all' && note.customerId !== filterCustomer) return false;
        if (filterType !== 'all' && note.type !== filterType) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            note.content.toLowerCase().includes(query) ||
            note.customerName.toLowerCase().includes(query) ||
            note.tags?.some((t) => t.toLowerCase().includes(query))
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Pinned first, then by date
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [notes, filterCustomer, filterType, searchQuery]);

  const handleSaveNote = async (noteData: Partial<CustomerNote>) => {
    if (editingNote) {
      await onUpdateNote(editingNote.id, noteData);
      setEditingNote(null);
    } else {
      await onCreateNote(noteData);
    }
    setShowEditor(false);
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-nilin-muted rounded-xl" />
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
              Customer Notes
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {notes.length} note{notes.length !== 1 ? 's' : ''} for {customers.length} customer{customers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingNote(null);
            setShowEditor(!showEditor);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      </div>

      {/* Note Editor */}
      {showEditor && (
        <NoteEditor
          customers={customers}
          onSave={handleSaveNote}
          onCancel={() => {
            setShowEditor(false);
            setEditingNote(null);
          }}
          initialData={editingNote || undefined}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-lightGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>

        <select
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Customers</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as CustomerNote['type'] | 'all')}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          {(Object.keys(noteTypeConfig) as CustomerNote['type'][]).map((type) => (
            <option key={type} value={type}>
              {noteTypeConfig[type].label}
            </option>
          ))}
        </select>
      </div>

      {/* Notes List */}
      {filteredNotes.length > 0 ? (
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => {
                setEditingNote(note);
                setShowEditor(true);
              }}
              onDelete={() => onDeleteNote(note.id)}
              isEditing={editingNote?.id === note.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
          <p className="text-nilin-warmGray">No notes found</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            {notes.length === 0
              ? 'Add your first customer note'
              : 'Try adjusting your filters'}
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default CustomerNotes;
