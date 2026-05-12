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
  <div className="min-h-screen bg-nilin-cream">
    <NavigationHeader />
    <div className="animate-pulse">
      <div className="h-[200px] bg-gradient-to-r from-nilin-blush to-nilin-peach" />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-nilin rounded-nilin h-[240px] shadow-nilin" />
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
    <div className="min-h-screen bg-nilin-cream">
      <NavigationHeader />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center animate-nilin-in">
        <div className="w-24 h-24 rounded-nilin bg-gradient-to-br from-nilin-blush to-nilin-coral flex items-center justify-center mx-auto mb-6 shadow-nilin">
          <Folder className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-nilin-charcoal mb-4">
          Category not found
        </h1>
        <p className="text-nilin-warmGray mb-8 max-w-md mx-auto">
          The category you're looking for doesn't exist or may have been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn-nilin px-6 py-3 rounded-nilin text-white font-semibold hover-lift"
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
          {index > 0 && <ChevronRight className="w-4 h-4 text-nilin-coral" />}
          {item.href ? (
            <button
              onClick={() => navigate(item.href!)}
              className="text-nilin-warmGray hover:text-nilin-coral transition-colors hover-lift"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-nilin-charcoal font-medium">{item.label}</span>
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
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <main className="flex-1">
        {/* Category Hero Banner */}
        <div className="relative h-[180px] md:h-[220px] overflow-hidden animate-nilin-in">
          <img
            src={heroImage}
            alt={category.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-nilin-charcoal/70 via-nilin-charcoal/40 to-transparent" />
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
          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-nilin-cream to-transparent" />
        </div>

        {/* Breadcrumb */}
        <div className="bg-white/80 glass-nilin border-b border-nilin-blush/30 animate-nilin-in" style={{animationDelay: '0.1s'}}>
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
          <h2 className="text-lg md:text-xl font-bold text-nilin-charcoal mb-6 animate-nilin-in" style={{animationDelay: '0.2s'}}>
            Choose a service
          </h2>

          {subcategories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
              {subcategories.map((subcategory: any, index: number) => (
                <div key={subcategory.slug} className="animate-nilin-in hover-lift" style={{animationDelay: `${0.2 + index * 0.05}s`}}>
                  <SubcategoryCard
                    subcategory={subcategory}
                    categorySlug={slug}
                    onClick={() => handleSubcategoryClick(subcategory.slug)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-nilin rounded-nilin p-12 text-center shadow-nilin animate-nilin-in">
              <div className="w-16 h-16 rounded-nilin bg-gradient-to-br from-nilin-blush to-nilin-coral flex items-center justify-center mx-auto mb-4">
                <Folder className="w-8 h-8 text-white" />
              </div>
              <p className="text-nilin-warmGray">No services available in this category yet.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CategoryPage;
