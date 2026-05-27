
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  Edit,
  Layers,
  TrendingUp,
  Users,
  Star,
  ChevronRight,
  Image,
  FileText,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import authService from '../../services/AuthService';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

interface Subcategory {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  serviceCount?: number;
}

interface CategoryStats {
  totalServices: number;
  activeProviders: number;
  avgRating: number;
  totalBookings: number;
  monthlyGrowth: number;
}

interface CategoryData {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  isActive: boolean;
  icon?: string;
  image?: string;
  parentCategory?: {
    _id: string;
    name: string;
    slug: string;
  };
  subcategories?: Subcategory[];
  displayOrder?: number;
  metadata?: {
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
  };
}

const AdminCategoryView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryData | null>(null);
  const [stats, setStats] = useState<CategoryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const categoryId = searchParams.get('id');
  const categorySlug = searchParams.get('slug');

  const fetchCategory = useCallback(async () => {
    if (!categoryId && !categorySlug) {
      setError('No category ID or slug provided');
      setIsLoading(false);
      return;
    }

    try {
      // Try to fetch by ID first, then by slug
      let endpoint = categoryId
        ? `/categories/id/${categoryId}`
        : `/categories/slug/${categorySlug}`;

      const response = await authService.get<{ success: boolean; data: CategoryData }>(endpoint);

      if (response.success && response.data) {
        setCategory(response.data);

        if (!response.data.isActive) {
          setError('This category is currently inactive');
        }

        // Fetch category statistics
        fetchCategoryStats(response.data._id || categoryId);
      } else {
        setError('Category not found');
      }
    } catch (err: any) {
      console.error('Error fetching category:', err);
      setError(err?.response?.data?.message || 'Failed to load category');
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, categorySlug]);

  const fetchCategoryStats = async (catId: string) => {
    setStatsLoading(true);
    try {
      // Fetch category-specific statistics from a dedicated endpoint
      const response = await authService.get<{
        success: boolean;
        data: CategoryStats;
      }>(`/categories/${catId}/stats`);

      if (response.success && response.data) {
        setStats(response.data);
      } else {
        // Set placeholder stats if endpoint doesn't exist
        setStats({
          totalServices: 0,
          activeProviders: 0,
          avgRating: 0,
          totalBookings: 0,
          monthlyGrowth: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching category stats:', err);
      // Set placeholder stats on error
      setStats({
        totalServices: 0,
        activeProviders: 0,
        avgRating: 0,
        totalBookings: 0,
        monthlyGrowth: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCategory();
    setIsRefreshing(false);
  };

  const handleViewPublicPage = () => {
    if (category) {
      navigate(`/category/${category.slug}`);
    }
  };

  const handleEditCategory = () => {
    if (category) {
      navigate(`/admin/categories/edit/${category._id || categoryId}`);
    }
  };

  const handleViewSubcategory = (subcat: Subcategory) => {
    navigate(`/admin/subcategory/${subcat._id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nilin-coral mx-auto mb-4"></div>
          <p className="text-nilin-warmGray">Loading category...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-nilin-cream flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-nilin p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-nilin-charcoal mb-2">Category Not Found</h2>
            <p className="text-nilin-warmGray mb-6">{error}</p>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="inline-flex items-center px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-rose transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-nilin-cream">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="inline-flex items-center text-nilin-warmGray hover:text-nilin-charcoal transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {category?.icon && (
                <div className="w-14 h-14 bg-nilin-coral/10 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">{category.icon}</span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-semibold text-nilin-charcoal">
                  {category?.name || 'Category Details'}
                </h1>
                <p className="text-nilin-warmGray">Category management and overview</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 border border-nilin-border rounded-lg hover:bg-nilin-lightGray transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 text-nilin-charcoal ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleEditCategory}
                className="inline-flex items-center px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-rose transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Category
              </button>
              <button
                onClick={handleViewPublicPage}
                className="inline-flex items-center px-4 py-2 border border-nilin-border text-nilin-charcoal rounded-xl hover:bg-nilin-lightGray transition-colors"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Public Page
              </button>
            </div>
          </div>
        </div>

        {category && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className={`rounded-xl p-4 ${
              category.isActive
                ? 'bg-green-50 border border-green-200'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    category.isActive ? 'bg-green-100' : 'bg-amber-100'
                  }`}>
                    <span className={category.isActive ? 'text-green-600' : 'text-amber-600'}>
                      {category.isActive ? '✓' : '!'}
                    </span>
                  </div>
                  <div>
                    <p className={`font-medium ${category.isActive ? 'text-green-800' : 'text-amber-800'}`}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </p>
                    <p className={`text-sm ${category.isActive ? 'text-green-600' : 'text-amber-600'}`}>
                      {category.isActive
                        ? 'This category is visible to users'
                        : 'This category is hidden from users'}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-nilin-warmGray">
                  Slug: /{category.slug}
                </span>
              </div>
            </div>

            {/* Category Details */}
            <div className="bg-white rounded-2xl shadow-nilin p-6">
              <h2 className="text-lg font-semibold text-nilin-charcoal mb-4">Category Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-nilin-blush/30 rounded-xl">
                    <p className="text-sm text-nilin-warmGray mb-1">Category Name</p>
                    <p className="text-lg font-medium text-nilin-charcoal">{category.name}</p>
                  </div>

                  {category.description && (
                    <div className="p-4 bg-nilin-blush/30 rounded-xl">
                      <p className="text-sm text-nilin-warmGray mb-1">Description</p>
                      <p className="text-nilin-charcoal">{category.description}</p>
                    </div>
                  )}

                  {category.parentCategory && (
                    <div className="p-4 bg-nilin-blush/30 rounded-xl">
                      <p className="text-sm text-nilin-warmGray mb-1">Parent Category</p>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/category?id=${category.parentCategory._id}`}
                          className="text-nilin-coral hover:underline"
                        >
                          {category.parentCategory.name}
                        </Link>
                        <ChevronRight className="w-4 h-4 text-nilin-warmGray" />
                        <span className="text-nilin-charcoal">{category.name}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {category.image && (
                    <div className="p-4 bg-nilin-blush/30 rounded-xl">
                      <p className="text-sm text-nilin-warmGray mb-2">Category Image</p>
                      <div className="relative w-full h-40 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={category.image}
                          alt={category.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-nilin-blush/30 rounded-xl">
                    <p className="text-sm text-nilin-warmGray mb-1">Display Order</p>
                    <p className="text-lg font-medium text-nilin-charcoal">
                      {category.displayOrder ?? 'Not set'}
                    </p>
                  </div>

                  {category.metadata && (
                    <div className="p-4 bg-nilin-blush/30 rounded-xl">
                      <p className="text-sm text-nilin-warmGray mb-1">Last Updated</p>
                      <p className="text-nilin-charcoal">
                        {new Date(category.metadata.updatedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Category Statistics */}
            <div className="bg-white rounded-2xl shadow-nilin p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-nilin-charcoal">Category Statistics</h2>
                {statsLoading && <Loader2 className="w-5 h-5 animate-spin text-nilin-coral" />}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard
                  icon={<Layers className="w-5 h-5" />}
                  label="Total Services"
                  value={stats?.totalServices ?? '—'}
                  color="blue"
                />
                <StatCard
                  icon={<Users className="w-5 h-5" />}
                  label="Active Providers"
                  value={stats?.activeProviders ?? '—'}
                  color="green"
                />
                <StatCard
                  icon={<Star className="w-5 h-5" />}
                  label="Avg Rating"
                  value={stats?.avgRating ? `${stats.avgRating.toFixed(1)} ★` : '—'}
                  color="yellow"
                />
                <StatCard
                  icon={<FileText className="w-5 h-5" />}
                  label="Total Bookings"
                  value={stats?.totalBookings?.toLocaleString() ?? '—'}
                  color="purple"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Monthly Growth"
                  value={stats?.monthlyGrowth ? `${stats.monthlyGrowth > 0 ? '+' : ''}${stats.monthlyGrowth}%` : '—'}
                  color={stats?.monthlyGrowth && stats.monthlyGrowth > 0 ? 'green' : 'red'}
                  trend={stats?.monthlyGrowth}
                />
              </div>
            </div>

            {/* Subcategories */}
            {category.subcategories && category.subcategories.length > 0 && (
              <div className="bg-white rounded-2xl shadow-nilin p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-nilin-charcoal">
                    Subcategories ({category.subcategories.length})
                  </h2>
                  <Link
                    to={`/admin/categories?parent=${category._id}`}
                    className="text-sm text-nilin-coral hover:underline"
                  >
                    View All
                  </Link>
                </div>

                <div className="space-y-2">
                  {category.subcategories.map((subcat) => (
                    <div
                      key={subcat._id}
                      onClick={() => handleViewSubcategory(subcat)}
                      className="flex items-center justify-between p-4 bg-nilin-lightGray rounded-xl hover:bg-nilin-blush/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                          <Layers className="w-5 h-5 text-nilin-coral" />
                        </div>
                        <div>
                          <p className="font-medium text-nilin-charcoal">{subcat.name}</p>
                          <p className="text-sm text-nilin-warmGray">/{subcat.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {subcat.serviceCount !== undefined && (
                          <span className="text-sm text-nilin-warmGray">
                            {subcat.serviceCount} services
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          subcat.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {subcat.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <ChevronRight className="w-5 h-5 text-nilin-warmGray" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-nilin p-6">
              <h2 className="text-lg font-semibold text-nilin-charcoal mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ActionButton
                  icon={<Edit className="w-4 h-4" />}
                  label="Edit Category"
                  onClick={handleEditCategory}
                />
                <ActionButton
                  icon={<Image className="w-4 h-4" />}
                  label="Update Image"
                  onClick={handleEditCategory}
                />
                <ActionButton
                  icon={<Layers className="w-4 h-4" />}
                  label="Add Subcategory"
                  onClick={() => navigate(`/admin/categories/new?parent=${category._id}`)}
                />
                <ActionButton
                  icon={<ExternalLink className="w-4 h-4" />}
                  label="View Public Page"
                  onClick={handleViewPublicPage}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
};

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  trend?: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, trend }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="p-4 bg-nilin-lightGray rounded-xl">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorClasses[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-nilin-charcoal mb-1">{value}</p>
      <div className="flex items-center gap-1">
        <p className="text-sm text-nilin-warmGray">{label}</p>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  );
};

// Action Button Component
interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-3 border border-nilin-border rounded-xl hover:bg-nilin-lightGray transition-colors"
  >
    <span className="text-nilin-coral">{icon}</span>
    <span className="text-sm font-medium text-nilin-charcoal">{label}</span>
  </button>
);

export default AdminCategoryView;
