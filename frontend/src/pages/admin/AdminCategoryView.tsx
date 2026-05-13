import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, ExternalLink } from 'lucide-react';
import authService from '../../services/AuthService';

interface CategoryData {
  slug: string;
  name: string;
  isActive: boolean;
}

const AdminCategoryView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryData | null>(null);

  const categoryId = searchParams.get('id');

  useEffect(() => {
    if (!categoryId) {
      setError('No category ID provided');
      setIsLoading(false);
      return;
    }

    const fetchCategory = async () => {
      try {
        const response = await authService.get<{ success: boolean; data: CategoryData }>(
          `/categories/id/${categoryId}`
        );

        if (response.success && response.data) {
          setCategory(response.data);

          if (!response.data.isActive) {
            setError('This category is currently inactive');
          }
        } else {
          setError('Category not found');
        }
      } catch (err: any) {
        console.error('Error fetching category:', err);
        setError(err?.response?.data?.message || 'Failed to load category');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategory();
  }, [categoryId]);

  const handleViewPublicPage = () => {
    if (category) {
      navigate(`/category/${category.slug}`);
    }
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
    <div className="min-h-screen bg-nilin-cream">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="inline-flex items-center text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-nilin p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-nilin-charcoal">Category Preview</h1>
            {category && (
              <button
                onClick={handleViewPublicPage}
                className="inline-flex items-center px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-rose transition-colors"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Public Page
              </button>
            )}
          </div>

          {category && (
            <div className="space-y-4">
              <div className="p-4 bg-nilin-blush/30 rounded-xl">
                <p className="text-sm text-nilin-warmGray mb-1">Category Name</p>
                <p className="text-lg font-medium text-nilin-charcoal">{category.name}</p>
              </div>

              <div className="p-4 bg-nilin-blush/30 rounded-xl">
                <p className="text-sm text-nilin-warmGray mb-1">Slug</p>
                <p className="text-lg font-medium text-nilin-charcoal">/{category.slug}</p>
              </div>

              <div className="p-4 bg-nilin-blush/30 rounded-xl">
                <p className="text-sm text-nilin-warmGray mb-1">Status</p>
                <p className={`text-lg font-medium ${category.isActive ? 'text-green-600' : 'text-amber-600'}`}>
                  {category.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCategoryView;
