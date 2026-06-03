import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Star,
  X,
  Save,
  ChevronRight,
  Layers,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { cn } from '../../lib/utils';
import {
  adminCategoryApi,
  type CategoryFormPayload,
  type SubcategoryFormPayload,
} from '../../services/adminCategoryApi';
import type { Category, Subcategory } from '../../types/category';
import {
  CategoryIcon,
  resolveCategoryIconKey,
  type CategoryIconKey,
} from '../../components/category/CategoryIcon';
import { CategoryIconPicker } from '../../components/category/CategoryIconPicker';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function subcategoryCount(category: Category): number {
  return category.subcategoryCount ?? category.subcategories?.length ?? 0;
}

const emptyCategoryForm = (sortOrder = 0): CategoryFormPayload => ({
  name: '',
  slug: '',
  description: '',
  icon: 'sparkles',
  color: '#E8A598',
  sortOrder,
  isFeatured: false,
  comingSoon: false,
  imageUrl: '',
});

const emptySubcategoryForm = (): SubcategoryFormPayload => ({
  name: '',
  slug: '',
  description: '',
  icon: 'sparkles',
  color: '#6366f1',
  sortOrder: 0,
});

const SubcategoryModal: React.FC<{
  category: Category;
  onClose: () => void;
  onRefresh: () => void;
}> = ({ category, onClose, onRefresh }) => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<SubcategoryFormPayload>(emptySubcategoryForm());

  const loadSubcategories = useCallback(async () => {
    setLoading(true);
    try {
      const full = await adminCategoryApi.getById(category._id);
      setSubcategories(full.subcategories ?? []);
    } catch {
      toast.error('Failed to load subcategories');
    } finally {
      setLoading(false);
    }
  }, [category._id]);

  useEffect(() => {
    loadSubcategories();
  }, [loadSubcategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: SubcategoryFormPayload = {
        ...formData,
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description:
          formData.description.trim() ||
          `${formData.name.trim()} — ${category.name} subcategory`,
        icon: resolveCategoryIconKey(formData.icon, formData.slug),
      };
      if (editingSub) {
        await adminCategoryApi.updateSubcategory(category.slug, editingSub.slug, payload);
        toast.success('Subcategory updated');
      } else {
        await adminCategoryApi.addSubcategory(category._id, payload);
        toast.success('Subcategory created');
      }
      setShowAddForm(false);
      setEditingSub(null);
      setFormData(emptySubcategoryForm());
      await loadSubcategories();
      onRefresh();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Failed to save subcategory');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (subSlug: string) => {
    if (!confirm('Delete this subcategory?')) return;
    try {
      await adminCategoryApi.deleteSubcategory(category.slug, subSlug);
      toast.success('Subcategory deleted');
      await loadSubcategories();
      onRefresh();
    } catch {
      toast.error('Failed to delete subcategory');
    }
  };

  const handleEdit = (sub: Subcategory) => {
    setEditingSub(sub);
    setFormData({
      name: sub.name,
      slug: sub.slug,
      description: sub.description,
      icon: resolveCategoryIconKey(sub.icon, sub.slug),
      color: sub.color,
      sortOrder: sub.sortOrder ?? 0,
    });
    setShowAddForm(true);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subcategory-modal-title"
    >
      <div className="glass glass-blur bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-nilin-border/50 shadow-xl">
        <div className="p-6 border-b border-nilin-border/50 flex items-center justify-between">
          <div>
            <h2 id="subcategory-modal-title" className="text-xl font-serif text-nilin-charcoal">
              Subcategories
            </h2>
            <p className="text-sm text-nilin-warmGray mt-1 font-sans">
              {category.name} · {subcategories.length} total
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-nilin-blush/40 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
            </div>
          ) : showAddForm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingSub(null);
                    setFormData(emptySubcategoryForm());
                  }}
                  className="p-2 hover:bg-nilin-muted rounded-lg"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="font-medium text-nilin-charcoal font-sans">
                  {editingSub ? 'Edit subcategory' : 'Add subcategory'}
                </h3>
              </div>

              <label className="block text-sm font-medium text-nilin-charcoal font-sans">
                Name *
                <input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: editingSub ? formData.slug : generateSlug(e.target.value),
                    })
                  }
                  className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50 focus:ring-2 focus:ring-nilin-coral/30"
                />
              </label>

              <label className="block text-sm font-medium text-nilin-charcoal font-sans">
                Slug *
                <input
                  required
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value.toLowerCase() })
                  }
                  className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50 font-mono text-sm"
                />
              </label>

              <label className="block text-sm font-medium text-nilin-charcoal font-sans">
                Description *
                <textarea
                  rows={2}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50 resize-none"
                />
              </label>

              <div>
                <span className="block text-sm font-medium text-nilin-charcoal font-sans">Icon</span>
                <CategoryIconPicker
                  value={formData.icon}
                  slug={formData.slug || category.slug}
                  onChange={(iconKey: CategoryIconKey) => setFormData({ ...formData, icon: iconKey })}
                />
              </div>
              <label className="block text-sm font-medium text-nilin-charcoal font-sans">
                Accent color
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="mt-1 w-full h-10 rounded-xl border border-nilin-border/50 cursor-pointer"
                />
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingSub(null);
                    setFormData(emptySubcategoryForm());
                  }}
                  className="flex-1 px-4 py-2 rounded-xl border border-nilin-border/50"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 btn-nilin flex justify-center gap-2">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {editingSub ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...emptySubcategoryForm(),
                      icon: resolveCategoryIconKey(category.icon, category.slug),
                    });
                    setShowAddForm(true);
                  }}
                  className="btn-nilin flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add subcategory
                </button>
              </div>
              {subcategories.length === 0 ? (
                <div className="text-center py-12 text-nilin-warmGray font-sans">
                  <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No subcategories yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subcategories.map((sub) => (
                    <div
                      key={sub.slug}
                      className="flex items-center gap-3 p-4 rounded-xl border border-nilin-border/40 bg-white/60"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${sub.color || category.color}20` }}
                      >
                        <CategoryIcon icon={sub.icon} slug={sub.slug} size="lg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-nilin-charcoal font-sans">{sub.name}</p>
                        <p className="text-xs text-nilin-warmGray font-mono">/{sub.slug}</p>
                      </div>
                      {sub.isActive === false && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Inactive
                        </span>
                      )}
                      <button type="button" onClick={() => handleEdit(sub)} className="p-2 hover:bg-nilin-blush/40 rounded-lg">
                        <Edit3 className="w-4 h-4 text-nilin-coral" />
                      </button>
                      <button type="button" onClick={() => handleDelete(sub.slug)} className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CategoryManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    featured: number;
    comingSoon: number;
    subcategories: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<CategoryFormPayload>(emptyCategoryForm());

  const syncSearch = (q: string) => {
    if (q.trim()) setSearchParams({ q: q.trim() });
    else setSearchParams({});
  };

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [listResult, statsResult] = await Promise.all([
        adminCategoryApi.list({ limit: 200 }),
        adminCategoryApi.getStats().catch(() => null),
      ]);
      setCategories(listResult.categories);
      const comingSoon = listResult.categories.filter((c) => c.comingSoon).length;
      const featured = listResult.categories.filter((c) => c.isFeatured).length;
      const subTotal = listResult.categories.reduce((s, c) => s + subcategoryCount(c), 0);
      setStats({
        total: statsResult?.stats.total ?? listResult.pagination.total ?? listResult.categories.length,
        featured: statsResult?.stats.featured ?? featured,
        comingSoon,
        subcategories: subTotal,
      });
      if (isRefresh) toast.success('Categories refreshed');
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== 'admin') return;
    loadData();
  }, [loadData, user]);

  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData(emptyCategoryForm(categories.length));
    setShowModal(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: resolveCategoryIconKey(category.icon, category.slug),
      color: category.color,
      sortOrder: category.sortOrder,
      isFeatured: category.isFeatured,
      comingSoon: category.comingSoon ?? false,
      imageUrl: category.imageUrl || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: CategoryFormPayload = {
        ...formData,
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description:
          formData.description.trim() ||
          `${formData.name.trim()} — marketplace category`,
        icon: resolveCategoryIconKey(formData.icon, formData.slug),
      };
      if (editingCategory) {
        await adminCategoryApi.update(editingCategory._id, payload);
        toast.success('Category updated');
      } else {
        await adminCategoryApi.create(payload);
        toast.success('Category created');
      }
      setShowModal(false);
      setEditingCategory(null);
      await loadData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Delete this category? This cannot be undone.')) return;
    try {
      await adminCategoryApi.delete(categoryId);
      toast.success('Category deleted');
      await loadData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Cannot delete — reassign or remove linked services first');
    }
  };

  const handleToggleFeatured = async (category: Category) => {
    try {
      await adminCategoryApi.toggleFeatured(category._id);
      toast.success(category.isFeatured ? 'Removed from featured' : 'Added to featured');
      await loadData();
    } catch {
      toast.error('Failed to update featured status');
    }
  };

  return (
    <ErrorBoundary>
      <AdminPageShell
        wideLayout
        title="Category Management"
        subtitle="Service taxonomy · categories and subcategories for the marketplace"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Categories', current: true },
        ]}
        headerActions={
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-sm font-sans hover:bg-nilin-blush/40 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
              <input
                type="search"
                placeholder="Search name, slug, or description…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  syncSearch(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-nilin-border/50 bg-white/60 font-sans focus:ring-2 focus:ring-nilin-coral/30"
              />
            </div>
            <button type="button" onClick={handleOpenCreate} className="btn-nilin flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              Add category
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total categories', value: stats?.total ?? categories.length },
              { label: 'Featured', value: stats?.featured ?? categories.filter((c) => c.isFeatured).length },
              { label: 'Coming soon', value: stats?.comingSoon ?? categories.filter((c) => c.comingSoon).length },
              {
                label: 'Subcategories',
                value: stats?.subcategories ?? categories.reduce((s, c) => s + subcategoryCount(c), 0),
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray font-sans">
                  {kpi.label}
                </p>
                <p className="text-2xl font-serif text-nilin-charcoal mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-12 text-center">
              <Layers className="w-14 h-14 text-nilin-warmGray mx-auto mb-4 opacity-60" />
              <p className="font-medium text-nilin-charcoal font-sans">
                {searchTerm ? 'No categories match your search' : 'No categories yet'}
              </p>
              {!searchTerm && (
                <button type="button" onClick={handleOpenCreate} className="btn-nilin mt-4">
                  Create first category
                </button>
              )}
            </div>
          ) : (
            <div className="glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full font-sans text-sm">
                  <thead>
                    <tr className="border-b border-nilin-border/40 bg-nilin-blush/20">
                      <th className="px-5 py-3 text-left font-medium text-nilin-charcoal">Category</th>
                      <th className="px-5 py-3 text-left font-medium text-nilin-charcoal">Slug</th>
                      <th className="px-5 py-3 text-center font-medium text-nilin-charcoal">Subcategories</th>
                      <th className="px-5 py-3 text-center font-medium text-nilin-charcoal">Featured</th>
                      <th className="px-5 py-3 text-center font-medium text-nilin-charcoal">Status</th>
                      <th className="px-5 py-3 text-right font-medium text-nilin-charcoal">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((category) => (
                      <tr
                        key={category._id}
                        className="border-b border-nilin-border/30 last:border-0 hover:bg-nilin-blush/10"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${category.color || '#E8A598'}20` }}
                            >
                              <CategoryIcon
                                icon={category.icon}
                                slug={category.slug}
                                size="lg"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-nilin-charcoal">{category.name}</p>
                              <p className="text-xs text-nilin-warmGray line-clamp-1 max-w-md">
                                {category.description}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <code className="text-xs font-mono text-nilin-coral bg-nilin-blush/50 px-2 py-1 rounded">
                            /{category.slug}
                          </code>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedCategory(category)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-nilin-muted/80 hover:bg-nilin-blush/50 transition-colors"
                          >
                            {subcategoryCount(category)}
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleFeatured(category)}
                            className="p-2 rounded-full hover:bg-nilin-blush/40"
                            title={category.isFeatured ? 'Unfeature' : 'Feature'}
                          >
                            <Star
                              className={cn(
                                'w-5 h-5',
                                category.isFeatured
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-nilin-warmGray'
                              )}
                            />
                          </button>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {category.comingSoon ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Coming soon
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(category)}
                              className="p-2 rounded-lg hover:bg-nilin-blush/40"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4 text-nilin-coral" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(category._id)}
                              className="p-2 rounded-lg hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {showModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-form-title"
            onClick={() => !isSaving && setShowModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-nilin-border/50 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-nilin-border/50 px-6 py-4 flex justify-between items-center">
                <h2 id="category-form-title" className="text-xl font-serif text-nilin-charcoal">
                  {editingCategory ? 'Edit category' : 'New category'}
                </h2>
                <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-nilin-muted rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 font-sans">
                <label className="block text-sm font-medium text-nilin-charcoal">
                  Name *
                  <input
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: editingCategory ? formData.slug : generateSlug(e.target.value),
                      })
                    }
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                  />
                </label>
                <label className="block text-sm font-medium text-nilin-charcoal">
                  Slug *
                  <input
                    required
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value.toLowerCase() })
                    }
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50 font-mono text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-nilin-charcoal">
                  Description
                  <textarea
                    rows={3}
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50 resize-none"
                    placeholder="Short description shown in the marketplace"
                  />
                </label>
                <div>
                  <span className="block text-sm font-medium text-nilin-charcoal">Icon</span>
                  <CategoryIconPicker
                    value={formData.icon}
                    slug={formData.slug}
                    onChange={(iconKey: CategoryIconKey) =>
                      setFormData({ ...formData, icon: iconKey })
                    }
                  />
                </div>
                <label className="block text-sm font-medium text-nilin-charcoal">
                  Accent color
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="mt-1 w-full h-10 rounded-xl border border-nilin-border/50 cursor-pointer"
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-sm font-medium text-nilin-charcoal">
                    Sort order
                    <input
                      type="number"
                      min={0}
                      value={formData.sortOrder}
                      onChange={(e) =>
                        setFormData({ ...formData, sortOrder: parseInt(e.target.value, 10) || 0 })
                      }
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                    />
                  </label>
                  <label className="block text-sm font-medium text-nilin-charcoal">
                    Image URL
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="mt-1 w-full px-4 py-2 rounded-xl border border-nilin-border/50"
                      placeholder="https://…"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Feature on homepage</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.comingSoon}
                    onChange={(e) => setFormData({ ...formData, comingSoon: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Mark as coming soon</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 rounded-xl border border-nilin-border/50"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={isSaving} className="flex-1 btn-nilin flex justify-center gap-2">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {editingCategory ? 'Save changes' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedCategory && (
          <SubcategoryModal
            category={selectedCategory}
            onClose={() => setSelectedCategory(null)}
            onRefresh={() => loadData(true)}
          />
        )}
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default CategoryManagement;
