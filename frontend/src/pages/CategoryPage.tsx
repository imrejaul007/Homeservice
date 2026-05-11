import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Folder } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import { useCategory } from '../hooks/useCategories';
import SubcategoryCard from '../components/category/SubcategoryCard';
import { CATEGORY_IMAGES } from '../constants/images';

// Loading skeleton
const CategoryPageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-white">
    <NavigationHeader />
    <div className="animate-pulse">
      <div className="h-[200px] bg-gray-200" />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-gray-100 rounded-2xl h-[240px]" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Not found
const CategoryNotFound: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white">
      <NavigationHeader />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <Folder className="w-12 h-12 text-gray-400" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          Category not found
        </h1>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          The category you're looking for doesn't exist or may have been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-nilin-primary text-white rounded-full font-semibold hover:bg-nilin-primary-dark transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
};

// Breadcrumb
const Breadcrumb: React.FC<{ items: { label: string; href?: string }[] }> = ({ items }) => {
  const navigate = useNavigate();
  return (
    <nav className="flex items-center gap-2 text-sm">
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
          {item.href ? (
            <button onClick={() => navigate(item.href!)} className="text-gray-500 hover:text-gray-900 transition-colors">
              {item.label}
            </button>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { category, isLoading, error } = useCategory(slug);

  if (isLoading) return <CategoryPageSkeleton />;
  if (error || !category) return <CategoryNotFound />;

  const handleSubcategoryClick = (subcategorySlug: string) => {
    navigate(`/service/${slug}/${subcategorySlug}`);
  };

  const displayConfig = (category.metadata?.displayConfig || {}) as any;
  const tagline = displayConfig.tagline || 'Premium services, handpicked by NILIN';
  const heroImage = CATEGORY_IMAGES[slug || '']?.hero || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop';

  const subcategories = category.subcategories
    ?.filter((sub: any) => sub.isActive !== false)
    .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)) || [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <NavigationHeader />

      <main className="flex-1">
        {/* Category Hero Banner */}
        <div className="relative h-[180px] md:h-[220px] overflow-hidden">
          <img
            src={heroImage}
            alt={category.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {category.name}
              </h1>
              <p className="text-white/80 text-sm md:text-base max-w-md">
                {tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="bg-gray-50 border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: category.name },
              ]}
            />
          </div>
        </div>

        {/* Subcategory Grid */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-6">
            Choose a service
          </h2>

          {subcategories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
              {subcategories.map((subcategory: any) => (
                <SubcategoryCard
                  key={subcategory.slug}
                  subcategory={subcategory}
                  categorySlug={slug}
                  onClick={() => handleSubcategoryClick(subcategory.slug)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Folder className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">No services available in this category yet.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CategoryPage;
