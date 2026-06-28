import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  X,
  Save,
  GripVertical,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { cn } from '../../lib/utils';
import { adminHeroSlideApi, type HeroSlide, type HeroSlideFormPayload } from '../../services/adminHeroSlideApi';

/** Homepage hero fills full viewport — use landscape images at least this size */
const HERO_IMAGE_RECOMMENDED_WIDTH = 1920;
const HERO_IMAGE_RECOMMENDED_HEIGHT = 1080;
const HERO_IMAGE_MIN_WIDTH = 1600;
const HERO_IMAGE_MIN_HEIGHT = 900;

const emptySlideForm = (sortOrder = 0): HeroSlideFormPayload => ({
  image: '',
  badge: '',
  title: '',
  subtitle: '',
  cta: 'Book Now',
  ctaLink: '/search',
  sortOrder,
  isActive: true,
});

interface SlideFormModalProps {
  slide: HeroSlide | null;
  onClose: () => void;
  onRefresh: () => void;
  defaultSortOrder?: number;
}

const SlideFormModal: React.FC<SlideFormModalProps> = ({
  slide,
  onClose,
  onRefresh,
  defaultSortOrder = 0,
}) => {
  const isEditing = !!slide;
  const [formData, setFormData] = useState<HeroSlideFormPayload>(() =>
    slide
      ? {
          image: slide.image,
          badge: slide.badge,
          title: slide.title,
          subtitle: slide.subtitle,
          cta: slide.cta,
          ctaLink: slide.ctaLink,
          sortOrder: slide.sortOrder,
          isActive: slide.isActive,
          startsAt: slide.startsAt ? new Date(slide.startsAt).toISOString().slice(0, 16) : '',
          endsAt: slide.endsAt ? new Date(slide.endsAt).toISOString().slice(0, 16) : '',
        }
      : emptySlideForm(defaultSortOrder)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof HeroSlideFormPayload, string>>>({});
  const [imageSizeWarning, setImageSizeWarning] = useState<string | null>(null);

  const checkImageDimensions = (url: string) => {
    if (!url.trim() || !/^https?:\/\/.+/.test(url)) {
      setImageSizeWarning(null);
      return;
    }
    const probe = new Image();
    probe.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = probe;
      if (w < HERO_IMAGE_MIN_WIDTH || h < HERO_IMAGE_MIN_HEIGHT) {
        setImageSizeWarning(
          `Image is ${w}×${h}px — below minimum ${HERO_IMAGE_MIN_WIDTH}×${HERO_IMAGE_MIN_HEIGHT}px. It may look soft on large screens.`
        );
      } else if (w < HERO_IMAGE_RECOMMENDED_WIDTH || h < HERO_IMAGE_RECOMMENDED_HEIGHT) {
        setImageSizeWarning(
          `Image is ${w}×${h}px — recommended ${HERO_IMAGE_RECOMMENDED_WIDTH}×${HERO_IMAGE_RECOMMENDED_HEIGHT}px for full-screen hero.`
        );
      } else {
        setImageSizeWarning(null);
      }
    };
    probe.onerror = () => setImageSizeWarning(null);
    probe.src = url;
  };

  useEffect(() => {
    if (slide?.image) {
      checkImageDimensions(slide.image);
    }
  }, [slide?.image]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof HeroSlideFormPayload, string>> = {};
    if (!formData.image.trim()) newErrors.image = 'Image URL is required';
    else if (!/^https?:\/\/.+/.test(formData.image)) newErrors.image = 'Invalid image URL';
    if (!formData.badge.trim()) newErrors.badge = 'Badge text is required';
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.subtitle.trim()) newErrors.subtitle = 'Subtitle is required';
    if (!formData.cta.trim()) newErrors.cta = 'CTA text is required';
    if (!formData.ctaLink.trim()) newErrors.ctaLink = 'CTA link is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload: HeroSlideFormPayload = {
        ...formData,
        badge: formData.badge.trim(),
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim(),
        cta: formData.cta.trim(),
        ctaLink: formData.ctaLink.trim(),
        startsAt: formData.startsAt || undefined,
        endsAt: formData.endsAt || undefined,
      };
      if (isEditing) {
        await adminHeroSlideApi.update(slide._id, payload);
        toast.success('Slide updated successfully');
      } else {
        await adminHeroSlideApi.create(payload);
        toast.success('Slide created successfully');
      }
      onRefresh();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Failed to save slide');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slide-form-title"
      onClick={() => !isSaving && onClose()}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-nilin-border/50 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-nilin-border/50 px-6 py-4 flex justify-between items-center">
          <h2 id="slide-form-title" className="text-xl font-serif text-nilin-charcoal">
            {isEditing ? 'Edit slide' : 'New slide'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-11 h-11 flex items-center justify-center hover:bg-nilin-muted rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            aria-label="Close form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 font-sans">
          {/* Image URL */}
          <label className="block">
            <span className="text-sm font-medium text-nilin-charcoal">
              Image URL <span className="text-nilin-rose">*</span>
            </span>
            <p className="mt-1 text-xs text-nilin-warmGray">
              Use a landscape photo at least {HERO_IMAGE_MIN_WIDTH}×{HERO_IMAGE_MIN_HEIGHT}px
              (recommended {HERO_IMAGE_RECOMMENDED_WIDTH}×{HERO_IMAGE_RECOMMENDED_HEIGHT}px) so the homepage hero fills the screen without blur.
            </p>
            <input
              type="url"
              value={formData.image}
              onChange={(e) => {
                const next = e.target.value;
                setFormData({ ...formData, image: next });
                checkImageDimensions(next);
              }}
              className={cn(
                'mt-1 w-full px-4 py-2.5 rounded-xl border bg-white/60 focus:ring-2 focus:ring-nilin-coral/30',
                errors.image ? 'border-nilin-rose' : 'border-nilin-border/50'
              )}
              placeholder="https://example.com/hero-image.jpg"
            />
            {errors.image && (
              <p className="mt-1 text-sm text-nilin-rose flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.image}
              </p>
            )}
            {imageSizeWarning && !errors.image && (
              <p className="mt-1 text-sm text-amber-700 flex items-start gap-1">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {imageSizeWarning}
              </p>
            )}
            {formData.image && (
              <div className="mt-2 rounded-lg overflow-hidden border border-nilin-border/30 h-40 bg-nilin-muted/20">
                <img
                  src={formData.image}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const w = img.naturalWidth;
                    const h = img.naturalHeight;
                    if (w < HERO_IMAGE_MIN_WIDTH || h < HERO_IMAGE_MIN_HEIGHT) {
                      setImageSizeWarning(
                        `Image is ${w}×${h}px — below minimum ${HERO_IMAGE_MIN_WIDTH}×${HERO_IMAGE_MIN_HEIGHT}px. It may look soft on large screens.`
                      );
                    } else if (w < HERO_IMAGE_RECOMMENDED_WIDTH || h < HERO_IMAGE_RECOMMENDED_HEIGHT) {
                      setImageSizeWarning(
                        `Image is ${w}×${h}px — recommended ${HERO_IMAGE_RECOMMENDED_WIDTH}×${HERO_IMAGE_RECOMMENDED_HEIGHT}px for full-screen hero.`
                      );
                    } else {
                      setImageSizeWarning(null);
                    }
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    setImageSizeWarning(null);
                  }}
                />
              </div>
            )}
          </label>

          {/* Badge */}
          <label className="block">
            <span className="text-sm font-medium text-nilin-charcoal">
              Badge <span className="text-nilin-rose">*</span>
            </span>
            <input
              type="text"
              value={formData.badge}
              onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
              maxLength={80}
              className={cn(
                'mt-1 w-full px-4 py-2.5 rounded-xl border bg-white/60 focus:ring-2 focus:ring-nilin-coral/30',
                errors.badge ? 'border-nilin-rose' : 'border-nilin-border/50'
              )}
              placeholder="e.g. Summer Sale, New Service"
            />
            {errors.badge && (
              <p className="mt-1 text-sm text-nilin-rose flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.badge}
              </p>
            )}
            <p className="mt-1 text-xs text-nilin-warmGray">{formData.badge.length}/80</p>
          </label>

          {/* Title */}
          <label className="block">
            <span className="text-sm font-medium text-nilin-charcoal">
              Title <span className="text-nilin-rose">*</span>
            </span>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={120}
              className={cn(
                'mt-1 w-full px-4 py-2.5 rounded-xl border bg-white/60 focus:ring-2 focus:ring-nilin-coral/30',
                errors.title ? 'border-nilin-rose' : 'border-nilin-border/50'
              )}
              placeholder="e.g. Professional Home Cleaning"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-nilin-rose flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.title}
              </p>
            )}
            <p className="mt-1 text-xs text-nilin-warmGray">{formData.title.length}/120</p>
          </label>

          {/* Subtitle */}
          <label className="block">
            <span className="text-sm font-medium text-nilin-charcoal">
              Subtitle <span className="text-nilin-rose">*</span>
            </span>
            <textarea
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              maxLength={200}
              rows={2}
              className={cn(
                'mt-1 w-full px-4 py-2.5 rounded-xl border bg-white/60 focus:ring-2 focus:ring-nilin-coral/30 resize-none',
                errors.subtitle ? 'border-nilin-rose' : 'border-nilin-border/50'
              )}
              placeholder="e.g. Book trusted cleaners at your doorstep"
            />
            {errors.subtitle && (
              <p className="mt-1 text-sm text-nilin-rose flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.subtitle}
              </p>
            )}
            <p className="mt-1 text-xs text-nilin-warmGray">{formData.subtitle.length}/200</p>
          </label>

          {/* CTA Text */}
          <label className="block">
            <span className="text-sm font-medium text-nilin-charcoal">
              CTA Button Text <span className="text-nilin-rose">*</span>
            </span>
            <input
              type="text"
              value={formData.cta}
              onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
              maxLength={60}
              className={cn(
                'mt-1 w-full px-4 py-2.5 rounded-xl border bg-white/60 focus:ring-2 focus:ring-nilin-coral/30',
                errors.cta ? 'border-nilin-rose' : 'border-nilin-border/50'
              )}
              placeholder="e.g. Book Now, Learn More"
            />
            {errors.cta && (
              <p className="mt-1 text-sm text-nilin-rose flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.cta}
              </p>
            )}
          </label>

          {/* CTA Link */}
          <label className="block">
            <span className="text-sm font-medium text-nilin-charcoal">
              CTA Link <span className="text-nilin-rose">*</span>
            </span>
            <input
              type="text"
              value={formData.ctaLink}
              onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
              className={cn(
                'mt-1 w-full px-4 py-2.5 rounded-xl border bg-white/60 focus:ring-2 focus:ring-nilin-coral/30 font-mono text-sm',
                errors.ctaLink ? 'border-nilin-rose' : 'border-nilin-border/50'
              )}
              placeholder="/search, /category/cleaning, https://..."
            />
            {errors.ctaLink && (
              <p className="mt-1 text-sm text-nilin-rose flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.ctaLink}
              </p>
            )}
          </label>

          {/* Sort Order */}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-nilin-charcoal">Sort Order</span>
              <input
                type="number"
                min={0}
                value={formData.sortOrder ?? defaultSortOrder}
                onChange={(e) =>
                  setFormData({ ...formData, sortOrder: parseInt(e.target.value, 10) || 0 })
                }
                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 focus:ring-2 focus:ring-nilin-coral/30"
              />
            </label>

            {/* Active Toggle */}
            <label className="flex items-center gap-3 pt-6 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 rounded text-nilin-coral focus:ring-nilin-coral/30"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-nilin-charcoal">Start Date</span>
              <input
                type="datetime-local"
                value={formData.startsAt ?? ''}
                onChange={(e) => setFormData({ ...formData, startsAt: e.target.value || undefined })}
                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 focus:ring-2 focus:ring-nilin-coral/30"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-nilin-charcoal">End Date</span>
              <input
                type="datetime-local"
                value={formData.endsAt ?? ''}
                onChange={(e) => setFormData({ ...formData, endsAt: e.target.value || undefined })}
                className="mt-1 w-full px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 focus:ring-2 focus:ring-nilin-coral/30"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-nilin-border/30">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl border border-nilin-border/50 hover:bg-nilin-muted/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 btn-nilin flex justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {isEditing ? 'Save Changes' : 'Create Slide'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HeroSlidePreview: React.FC<{ slide: HeroSlide }> = ({ slide }) => (
  <div className="relative rounded-xl overflow-hidden h-48 bg-nilin-muted/30">
    <img
      src={slide.image}
      alt={slide.title}
      className="w-full h-full object-cover"
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        img.style.display = 'none';
        img.parentElement!.innerHTML =
          '<div class="flex items-center justify-center w-full h-full text-nilin-warmGray"><svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21" stroke-width="2"/></svg></div>';
      }}
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-4">
      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-nilin-coral text-white rounded-full w-fit mb-2">
        {slide.badge}
      </span>
      <h4 className="text-white font-serif text-lg leading-tight line-clamp-1">{slide.title}</h4>
      <p className="text-white/80 text-sm line-clamp-1">{slide.subtitle}</p>
      <a
        href={slide.ctaLink}
        className="inline-flex items-center gap-1 text-white text-sm font-medium mt-1 hover:underline"
        onClick={(e) => e.preventDefault()}
      >
        {slide.cta}
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
    {!slide.isActive && (
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
        <span className="px-3 py-1.5 rounded-full bg-nilin-warmGray/80 text-white text-sm font-medium">
          Inactive
        </span>
      </div>
    )}
  </div>
);

const HeroSlideManager: React.FC = () => {
  const { user } = useAuthStore();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [previewSlide, setPreviewSlide] = useState<HeroSlide | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const loadSlides = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await adminHeroSlideApi.list({
        isActive: showOnlyActive ? true : undefined,
      });
      setSlides(result.slides.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch {
      toast.error('Failed to load hero slides');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showOnlyActive]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
      return;
    }
    loadSlides();
  }, [loadSlides, user, navigate]);

  const filteredSlides = slides.filter(
    (slide) =>
      slide.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slide.badge.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slide.subtitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingSlide(null);
    setShowModal(true);
  };

  const handleEdit = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setShowModal(true);
  };

  const handleDelete = async (slide: HeroSlide) => {
    if (!confirm(`Delete "${slide.title}"? This cannot be undone.`)) return;
    try {
      await adminHeroSlideApi.delete(slide._id);
      toast.success('Slide deleted');
      await loadSlides();
    } catch {
      toast.error('Failed to delete slide');
    }
  };

  const handleToggleActive = async (slide: HeroSlide) => {
    try {
      await adminHeroSlideApi.toggleActive(slide._id);
      toast.success(slide.isActive ? 'Slide deactivated' : 'Slide activated');
      await loadSlides();
    } catch {
      toast.error('Failed to update slide status');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newSlides = [...slides];
    [newSlides[index - 1], newSlides[index]] = [newSlides[index], newSlides[index - 1]];
    const updatedOrder = newSlides.map((s, i) => ({ ...s, sortOrder: i }));
    setSlides(updatedOrder);
    try {
      await adminHeroSlideApi.reorder({
        order: updatedOrder.map((s, i) => ({ id: s._id, sortOrder: i })),
      });
      toast.success('Order updated');
    } catch {
      toast.error('Failed to update order');
      loadSlides();
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === slides.length - 1) return;
    const newSlides = [...slides];
    [newSlides[index], newSlides[index + 1]] = [newSlides[index + 1], newSlides[index]];
    const updatedOrder = newSlides.map((s, i) => ({ ...s, sortOrder: i }));
    setSlides(updatedOrder);
    try {
      await adminHeroSlideApi.reorder({
        order: updatedOrder.map((s, i) => ({ id: s._id, sortOrder: i })),
      });
      toast.success('Order updated');
    } catch {
      toast.error('Failed to update order');
      loadSlides();
    }
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragEnd = async () => {
    if (dragIndex === null) return;
    setDragIndex(null);
    try {
      await adminHeroSlideApi.reorder({
        order: slides.map((s, i) => ({ id: s._id, sortOrder: i })),
      });
      toast.success('Order saved');
    } catch {
      toast.error('Failed to save order');
      loadSlides();
    }
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newSlides = [...slides];
    const [dragged] = newSlides.splice(dragIndex, 1);
    newSlides.splice(index, 0, dragged);
    setSlides(newSlides);
    setDragIndex(index);
  };

  const activeCount = slides.filter((s) => s.isActive).length;
  const scheduledCount = slides.filter((s) => s.startsAt || s.endsAt).length;

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Hero Slide Manager"
        subtitle="Homepage hero banners — create, edit, reorder and schedule slides"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Hero Slides', current: true },
        ]}
        headerActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadSlides(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-sm font-sans hover:bg-nilin-blush/40 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn-nilin flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Slide
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/70 px-5 py-4 flex gap-3">
            <ImageIcon className="w-5 h-5 text-sky-800 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-sky-950 font-sans space-y-1">
              <p className="font-medium">Image size guidelines</p>
              <p>
                Hero slides display full-screen on the homepage. Upload landscape images at{' '}
                <strong>{HERO_IMAGE_RECOMMENDED_WIDTH}×{HERO_IMAGE_RECOMMENDED_HEIGHT}px</strong> (16:9) or larger.
                Minimum {HERO_IMAGE_MIN_WIDTH}×{HERO_IMAGE_MIN_HEIGHT}px. JPEG or WebP under 500KB works best.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Slides', value: slides.length },
              { label: 'Active', value: activeCount },
              { label: 'Scheduled', value: scheduledCount },
              { label: 'Draft', value: slides.length - activeCount },
            ].map((kpi) => (
              <div key={kpi.label} className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray font-sans">
                  {kpi.label}
                </p>
                <p className="text-2xl font-serif text-nilin-charcoal mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
              <input
                type="search"
                placeholder="Search slides..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 font-sans focus:ring-2 focus:ring-nilin-coral/30"
              />
            </div>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyActive}
                onChange={(e) => setShowOnlyActive(e.target.checked)}
                className="w-4 h-4 rounded text-nilin-coral focus:ring-nilin-coral/30"
              />
              <span className="text-sm font-sans">Show active only</span>
            </label>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
            </div>
          ) : filteredSlides.length === 0 ? (
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-12 text-center">
              <ImageIcon className="w-14 h-14 text-nilin-warmGray mx-auto mb-4 opacity-60" />
              <p className="font-medium text-nilin-charcoal font-sans">
                {searchTerm ? 'No slides match your search' : 'No hero slides yet'}
              </p>
              {!searchTerm && (
                <button type="button" onClick={handleOpenCreate} className="btn-nilin mt-4">
                  Create first slide
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredSlides.map((slide, index) => (
                <div
                  key={slide._id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  className={cn(
                    'glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden transition-all',
                    dragIndex === index && 'opacity-50 scale-[0.98]'
                  )}
                >
                  {/* Preview */}
                  <HeroSlidePreview slide={slide} />

                  {/* Drag handle & actions */}
                  <div className="p-4 flex items-center gap-2">
                    <button
                      type="button"
                      title="Drag to reorder"
                      className="cursor-grab active:cursor-grabbing p-1 text-nilin-warmGray hover:text-nilin-charcoal"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-nilin-blush/40 disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === slides.length - 1}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-nilin-blush/40 disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1" />

                    {/* Status badge */}
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        slide.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {slide.isActive ? 'Active' : 'Inactive'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(slide)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-nilin-blush/40"
                      title={slide.isActive ? 'Deactivate' : 'Activate'}
                      aria-label={slide.isActive ? 'Deactivate slide' : 'Activate slide'}
                    >
                      {slide.isActive ? (
                        <EyeOff className="w-4 h-4 text-nilin-warmGray" />
                      ) : (
                        <Eye className="w-4 h-4 text-emerald-600" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewSlide(slide)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-nilin-blush/40"
                      title="Preview"
                      aria-label="Preview slide"
                    >
                      <Eye className="w-4 h-4 text-nilin-coral" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEdit(slide)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-nilin-blush/40"
                      title="Edit"
                      aria-label="Edit slide"
                    >
                      <Edit3 className="w-4 h-4 text-nilin-coral" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(slide)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50"
                      title="Delete"
                      aria-label="Delete slide"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Slide Form Modal */}
        {showModal && (
          <SlideFormModal
            slide={editingSlide}
            onClose={() => {
              setShowModal(false);
              setEditingSlide(null);
            }}
            onRefresh={() => loadSlides(true)}
            defaultSortOrder={slides.length}
          />
        )}

        {/* Preview Modal */}
        {previewSlide && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            onClick={() => setPreviewSlide(null)}
          >
            <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 id="preview-title" className="text-lg font-serif text-white">
                  Slide Preview
                </h3>
                <button
                  type="button"
                  onClick={() => setPreviewSlide(null)}
                  className="w-11 h-11 flex items-center justify-center text-white hover:bg-white/10 rounded-full"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative rounded-2xl overflow-hidden aspect-[16/9]">
                <img
                  src={previewSlide.image}
                  alt={previewSlide.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 flex flex-col justify-end p-8 md:p-12">
                  <span className="inline-block px-3 py-1 text-sm font-medium bg-nilin-coral text-white rounded-full w-fit mb-3">
                    {previewSlide.badge}
                  </span>
                  <h2 className="text-white font-serif text-2xl md:text-4xl leading-tight mb-2">
                    {previewSlide.title}
                  </h2>
                  <p className="text-white/80 text-base md:text-lg mb-4 max-w-xl">
                    {previewSlide.subtitle}
                  </p>
                  <a
                    href={previewSlide.ctaLink}
                    onClick={(e) => e.preventDefault()}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-nilin-coral text-white font-medium w-fit hover:bg-nilin-coral/90 transition-colors"
                  >
                    {previewSlide.cta}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <p className="text-center text-white/50 text-sm mt-4 font-sans">
                How this slide will appear on the homepage
              </p>
            </div>
          </div>
        )}
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default HeroSlideManager;
