import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Star,
  X,
  Save,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowLeft,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import PageLayout from '../../components/layout/PageLayout';
import type { Category, Subcategory } from '../../types/category';

// ============================================
// Types
// ============================================

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  isFeatured: boolean;
  comingSoon: boolean;
  imageUrl: string;
}

interface SubcategoryFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
}

// ============================================
// Subcategory Modal Component
// ============================================

const SubcategoryModal: React.FC<{
  category: Category;
  onClose: () => void;
  onRefresh: () => void;
  tokens: { accessToken?: string };
}> = ({ category, onClose, onRefresh, tokens }) => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<SubcategoryFormData>({
    name: '',
    slug: '',
    description: '',
    icon: '🔧',
    color: '#6366f1',
    sortOrder: 0,
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadSubcategories();
  }, [category.slug]);

  const loadSubcategories = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/categories/${category.slug}/subcategories`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken || ''}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setSubcategories(data.data.subcategories || []);
      }
    } catch (error) {
      console.error('Failed to load subcategories:', error);
      toast.error('Failed to load subcategories');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const url = editingSub
        ? `${API_URL}/categories/${category.slug}/subcategories/${editingSub.slug}`
        : `${API_URL}/categories/${category.slug}/subcategories`;

      const response = await fetch(url, {
        method: editingSub ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken || ''}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(editingSub ? 'Subcategory updated' : 'Subcategory created');
        setShowAddForm(false);
        setEditingSub(null);
        setFormData({
          name: '',
          slug: '',
          description: '',
          icon: '🔧',
          color: '#6366f1',
          sortOrder: 0,
        });
        loadSubcategories();
        onRefresh();
      } else {
        toast.error(data.message || 'Failed to save subcategory');
      }
    } catch (error) {
      toast.error('Failed to save subcategory');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (subSlug: string) => {
    if (!confirm('Are you sure you want to delete this subcategory?')) return;

    try {
      const response = await fetch(
        `${API_URL}/categories/${category.slug}/subcategories/${subSlug}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${tokens.accessToken || ''}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Subcategory deleted');
        loadSubcategories();
        onRefresh();
      } else {
        toast.error(data.message || 'Failed to delete subcategory');
      }
    } catch (error) {
      toast.error('Failed to delete subcategory');
    }
  };

  const handleEdit = (sub: Subcategory) => {
    setEditingSub(sub);
    setFormData({
      name: sub.name,
      slug: sub.slug,
      description: sub.description,
      icon: sub.icon,
      color: sub.color,
      sortOrder: sub.sortOrder || 0,
    });
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingSub(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '🔧',
      color: '#6366f1',
      sortOrder: 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-nilin-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Subcategories
            </h2>
            <p className="text-sm text-nilin-warmGray mt-1">
              Manage subcategories for "{category.name}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-nilin-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
            </div>
          ) : showAddForm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-2 hover:bg-nilin-muted rounded-lg"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="font-medium text-nilin-charcoal">
                  {editingSub ? 'Edit Subcategory' : 'Add New Subcategory'}
                </h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: generateSlug(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                  placeholder="e.g., AC Repair"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Slug *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value.toLowerCase() })
                  }
                  className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none font-mono"
                  placeholder="ac-repair"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none resize-none"
                  placeholder="Describe this subcategory..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    placeholder="🔧"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-12 h-10 rounded-xl border-2 border-nilin-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1 px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 rounded-xl border-2 border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 btn-nilin flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {editingSub ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="btn-nilin flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Subcategory
                </button>
              </div>

              {subcategories.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-12 h-12 text-nilin-warmGray mx-auto mb-3" />
                  <p className="text-nilin-warmGray">No subcategories yet</p>
                  <p className="text-sm text-nilin-lightGray">
                    Add your first subcategory to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subcategories.map((sub) => (
                    <div
                      key={sub.slug}
                      className="flex items-center gap-4 p-4 bg-nilin-muted/50 rounded-xl hover:bg-nilin-muted transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${sub.color}20` }}
                      >
                        {sub.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-nilin-charcoal">{sub.name}</p>
                        <p className="text-sm text-nilin-warmGray truncate">{sub.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(sub)}
                          className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4 text-nilin-coral" />
                        </button>
                        <button
                          onClick={() => handleDelete(sub.slug)}
                          className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
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

// ============================================
// Main Component
// ============================================

const CategoryManagement: React.FC = () => {
  const navigate = useNavigate();
  const { tokens } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    description: '',
    icon: '🔧',
    color: '#6366f1',
    sortOrder: 0,
    isFeatured: false,
    comingSoon: false,
    imageUrl: '',
  });

  // Load categories
  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/categories`, {
        headers: {
          Authorization: `Bearer ${tokens?.accessToken || ''}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data.categories || data.data || []);
      } else {
        toast.error(data.message || 'Failed to load categories');
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [API_URL, tokens?.accessToken]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Filter categories by search term
  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Toggle category expansion
  const toggleExpand = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Open modal for create
  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '🔧',
      color: '#6366f1',
      sortOrder: categories.length,
      isFeatured: false,
      comingSoon: false,
      imageUrl: '',
    });
    setShowModal(true);
  };

  // Open modal for edit
  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
      color: category.color,
      sortOrder: category.sortOrder,
      isFeatured: category.isFeatured,
      comingSoon: category.comingSoon || false,
      imageUrl: category.imageUrl || '',
    });
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const url = editingCategory
        ? `${API_URL}/admin/categories/${editingCategory._id}`
        : `${API_URL}/admin/categories`;

      const response = await fetch(url, {
        method: editingCategory ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.accessToken || ''}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          editingCategory ? 'Category updated successfully' : 'Category created successfully'
        );
        setShowModal(false);
        setEditingCategory(null);
        loadCategories();
      } else {
        toast.error(data.message || 'Failed to save category');
      }
    } catch (error) {
      console.error('Failed to save category:', error);
      toast.error('Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokens?.accessToken || ''}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Category deleted successfully');
        loadCategories();
      } else {
        toast.error(data.message || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Failed to delete category');
    }
  };

  // Toggle featured
  const handleToggleFeatured = async (category: Category) => {
    try {
      const response = await fetch(`${API_URL}/admin/categories/${category._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.accessToken || ''}`,
        },
        body: JSON.stringify({ isFeatured: !category.isFeatured }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          category.isFeatured ? 'Removed from featured' : 'Added to featured'
        );
        loadCategories();
      } else {
        toast.error(data.message || 'Failed to update category');
      }
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  // View subcategories
  const handleViewSubcategories = (category: Category) => {
    setSelectedCategory(category);
  };

  return (
    <PageLayout
      title="Category Management"
      subtitle="Manage service categories and their subcategories"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-nilin-border bg-white/80 focus:border-nilin-coral focus:outline-none"
              />
            </div>
          </div>
          <button onClick={handleOpenCreate} className="btn-nilin flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Category
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-nilin-warmGray">Total Categories</p>
            <p className="text-2xl font-bold text-nilin-charcoal">{categories.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-nilin-warmGray">Featured</p>
            <p className="text-2xl font-bold text-nilin-charcoal">
              {categories.filter((c) => c.isFeatured).length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-nilin-warmGray">Coming Soon</p>
            <p className="text-2xl font-bold text-nilin-charcoal">
              {categories.filter((c) => c.comingSoon).length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-nilin-warmGray">Total Subcategories</p>
            <p className="text-2xl font-bold text-nilin-charcoal">
              {categories.reduce((sum, c) => sum + c.subcategories.length, 0)}
            </p>
          </div>
        </div>

        {/* Categories List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <Layers className="w-16 h-16 text-nilin-warmGray mx-auto mb-4" />
            <h3 className="text-xl font-medium text-nilin-charcoal mb-2">
              {searchTerm ? 'No categories found' : 'No categories yet'}
            </h3>
            <p className="text-nilin-warmGray mb-6">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Create your first category to get started'}
            </p>
            {!searchTerm && (
              <button onClick={handleOpenCreate} className="btn-nilin">
                <Plus className="w-5 h-5 mr-2" />
                Create Category
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-nilin-border bg-nilin-muted/30">
                    <th className="px-6 py-4 text-left text-sm font-medium text-nilin-charcoal">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-nilin-charcoal">
                      Slug
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-medium text-nilin-charcoal">
                      Subcategories
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-medium text-nilin-charcoal">
                      Featured
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-medium text-nilin-charcoal">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-nilin-charcoal">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <tr
                      key={category._id}
                      className="border-b border-nilin-border last:border-b-0 hover:bg-nilin-muted/20 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                            style={{ backgroundColor: `${category.color}20` }}
                          >
                            {category.icon}
                          </div>
                          <div>
                            <p className="font-medium text-nilin-charcoal">{category.name}</p>
                            <p className="text-sm text-nilin-warmGray line-clamp-1 max-w-xs">
                              {category.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-sm font-mono text-nilin-coral bg-nilin-blush/50 px-2 py-1 rounded">
                          /{category.slug}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleViewSubcategories(category)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-nilin-muted rounded-full text-sm text-nilin-charcoal hover:bg-nilin-muted/70 transition-colors"
                        >
                          {category.subcategoryCount || category.subcategories?.length || 0}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleFeatured(category)}
                          className="p-2 hover:bg-nilin-muted rounded-full transition-colors"
                          title={category.isFeatured ? 'Remove from featured' : 'Add to featured'}
                        >
                          {category.isFeatured ? (
                            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                          ) : (
                            <Star className="w-5 h-5 text-nilin-warmGray" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {category.comingSoon ? (
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                            Coming Soon
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(category)}
                            className="p-2 hover:bg-nilin-muted rounded-lg transition-colors"
                            title="Edit category"
                          >
                            <Edit3 className="w-4 h-4 text-nilin-coral" />
                          </button>
                          <button
                            onClick={() => handleDelete(category._id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete category"
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-nilin-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-serif text-nilin-charcoal">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-nilin-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: generateSlug(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    placeholder="e.g., Home Cleaning"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value.toLowerCase() })
                    }
                    className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none font-mono"
                    placeholder="home-cleaning"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none resize-none"
                    placeholder="Describe this category..."
                  />
                </div>

                {/* Icon & Color */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Icon (emoji)
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none text-center text-2xl"
                      placeholder="🧹"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Color
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-12 h-10 rounded-xl border-2 border-nilin-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="flex-1 px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Sort Order & Image URL */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.sortOrder}
                      onChange={(e) =>
                        setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="w-5 h-5 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral"
                    />
                    <span className="text-sm font-medium text-nilin-charcoal">
                      Feature this category on homepage
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.comingSoon}
                      onChange={(e) => setFormData({ ...formData, comingSoon: e.target.checked })}
                      className="w-5 h-5 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral"
                    />
                    <span className="text-sm font-medium text-nilin-charcoal">
                      Mark as "Coming Soon"
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border-2 border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 btn-nilin flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {editingCategory ? 'Update Category' : 'Create Category'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcategory Modal */}
      {selectedCategory && (
        <SubcategoryModal
          category={selectedCategory}
          onClose={() => setSelectedCategory(null)}
          onRefresh={loadCategories}
          tokens={tokens || {}}
        />
      )}
    </PageLayout>
  );
};

export default CategoryManagement;
