import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Folder, Search, Sparkles, TrendingUp } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import { useCategory } from '../hooks/useCategories';
import SubcategoryCard from '../components/category/SubcategoryCard';
import { CATEGORY_IMAGES } from '../constants/images';
import { PageErrorBoundary } from '../components/common/PageErrorBoundary';
import { resolveCategorySlug } from '../utils/categorySlugResolver';
import TrustBadges from '../components/category/TrustBadges';

// Popular subcategories by category slug (for highlighting)
const POPULAR_SUBCATEGORIES: Record<string, string[]> = {
  hair: ['womens-haircut', 'mens-haircut', 'keratin-treatment', 'hair-coloring'],
  'skin-aesthetics': ['facials', 'microdermabrasion', 'chemical-peel'],
  nails: ['manicure', 'pedicure', 'nail-art'],
  makeup: ['bridal-makeup', 'party-makeup', 'everyday-makeup'],
  massage: ['swedish-massage', 'deep-tissue', 'aromatherapy'],
  'teeth-whitening': ['in-office-whitening', 'at-home-whitening'],
};

// Category stats by slug
const CATEGORY_STATS: Record<string, { services: number; providers: number; bookings: string }> = {
  hair: { services: 150, providers: 45, bookings: '2.5k+' },
  'skin-aesthetics': { services: 120, providers: 38, bookings: '1.8k+' },
  nails: { services: 80, providers: 28, bookings: '1.2k+' },
  makeup: { services: 95, providers: 32, bookings: '1.5k+' },
  massage: { services: 110, providers: 42, bookings: '2.1k+' },
  'teeth-whitening': { services: 45, providers: 18, bookings: '800+' },
};

// Loading skeleton
const CategoryPageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-nilin-cream">
    <NavigationHeader />
    <div className="animate-pulse">
      <div className="h-[280px] bg-gradient-to-r from-nilin-blush to-nilin-peach" />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-8 bg-white/50 rounded w-48 mb-8" />
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

// Category Stats Bar
const CategoryStats: React.FC<{ stats: { services: number; providers: number; bookings: string } }> = ({ stats }) => (
  <div className="flex items-center gap-6 md:gap-10">
    <div className="text-center">
      <div className="text-lg md:text-xl font-bold text-nilin-charcoal">{stats.services}+</div>
      <div className="text-xs text-nilin-warmGray">Services</div>
    </div>
    <div className="w-px h-8 bg-nilin-blush/40" />
    <div className="text-center">
      <div className="text-lg md:text-xl font-bold text-nilin-charcoal">{stats.providers}+</div>
      <div className="text-xs text-nilin-warmGray">Providers</div>
    </div>
    <div className="w-px h-8 bg-nilin-blush/40" />
    <div className="text-center">
      <div className="text-lg md:text-xl font-bold text-nilin-charcoal">{stats.bookings}</div>
      <div className="text-xs text-nilin-warmGray">Bookings</div>
    </div>
  </div>
);

// Search Filter Chip
const FilterChip: React.FC<{
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
      active
        ? 'bg-nilin-coral text-white shadow-md'
        : 'bg-white text-nilin-charcoal hover:bg-nilin-blush/30 border border-nilin-blush/30'
    }`}
  >
    {icon}
    {label}
  </button>
);

const CategoryPage: React.FC = () => {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showPopularOnly, setShowPopularOnly] = useState(false);

  const slug = resolveCategorySlug(rawSlug ?? '') ?? rawSlug ?? '';
  const { category, isLoading, error } = useCategory(slug);

  // Redirect legacy category URLs (e.g. /category/skincare → /category/skin-aesthetics)
  useEffect(() => {
    if (rawSlug && slug && rawSlug !== slug) {
      navigate(`/category/${slug}`, { replace: true });
    }
  }, [rawSlug, slug, navigate]);

  // Filter subcategories - always compute this, but use it only when category exists
  const filteredSubcategories = useMemo(() => {
    if (!category?.subcategories) return [];

    let subs = category.subcategories
      .filter((sub: any) => sub.isActive !== false)
      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      subs = subs.filter((sub: any) =>
        sub.name.toLowerCase().includes(query) ||
        sub.description?.toLowerCase().includes(query) ||
        sub.metadata?.displayName?.toLowerCase().includes(query)
      );
    }

    // Filter to popular only
    const popularSlugs = POPULAR_SUBCATEGORIES[slug] || [];
    if (showPopularOnly) {
      subs = subs.filter((sub: any) => popularSlugs.includes(sub.slug));
    }

    return subs;
  }, [category?.subcategories, searchQuery, showPopularOnly, slug]);

  // Show loading state first
  if (isLoading) {
    return <CategoryPageSkeleton />;
  }

  // Show not found state
  if (error || !category) {
    return <CategoryNotFound />;
  }

  const handleSubcategoryClick = (subcategorySlug: string) => {
    navigate(`/service/${slug}/${subcategorySlug}`);
  };

  const displayConfig = (category.metadata as any)?.displayConfig || {};
  const tagline = displayConfig.tagline || 'Premium services, handpicked by NILIN';
  const heroImage = CATEGORY_IMAGES[slug]?.hero || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop';
  const stats = CATEGORY_STATS[slug] || { services: 100, providers: 30, bookings: '1k+' };
  const popularSlugs = POPULAR_SUBCATEGORIES[slug] || [];

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <main className="flex-1">
        {/* Enhanced Category Hero Banner */}
        <div className="relative overflow-hidden animate-nilin-in">
          {/* Background Image */}
          <div className="relative h-[240px] md:h-[300px]">
            <img
              src={heroImage}
              alt={category.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-nilin-charcoal/80 via-nilin-charcoal/60 to-transparent" />
          </div>

          {/* Hero Content */}
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 w-full">
                <div className="flex-1">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
                    {category.name}
                  </h1>
                  <p className="text-white/80 text-sm md:text-base max-w-lg">
                    {tagline}
                  </p>
                </div>
                {/* Stats (hidden on mobile, shown in different location) */}
                <div className="hidden md:block">
                  <CategoryStats stats={stats} />
                </div>
              </div>
            </div>
          </div>

          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-20 md:h-24 bg-gradient-to-t from-nilin-cream to-transparent" />
        </div>

        {/* Mobile Stats Bar */}
        <div className="md:hidden bg-white/90 glass-nilin border-b border-nilin-blush/30 -mt-4 relative z-10 mx-4 rounded-nilin shadow-sm">
          <div className="px-4 py-3">
            <CategoryStats stats={stats} />
          </div>
        </div>

        {/* Breadcrumb + Search Bar */}
        <div className="bg-white/80 glass-nilin border-b border-nilin-blush/30 animate-nilin-in relative z-10" style={{animationDelay: '0.1s'}}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <Breadcrumb
                  items={[
                    { label: 'Home', href: '/' },
                    { label: category.name },
                  ]}
                />
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-64 md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-full bg-nilin-cream/80 border border-nilin-blush/40 text-sm text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 focus:border-nilin-coral transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Chips + Results Count */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 animate-nilin-in" style={{animationDelay: '0.15s'}}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Filter Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <FilterChip
                label="All"
                active={!showPopularOnly && !searchQuery}
                onClick={() => {
                  setShowPopularOnly(false);
                  setSearchQuery('');
                }}
              />
              <FilterChip
                label="Popular"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                active={showPopularOnly}
                onClick={() => setShowPopularOnly(!showPopularOnly)}
              />
              <FilterChip
                label="Trending"
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                active={false}
                onClick={() => {}}
              />
            </div>

            {/* Results count */}
            <span className="text-sm text-nilin-warmGray">
              {filteredSubcategories.length} {filteredSubcategories.length === 1 ? 'service' : 'services'}
            </span>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 animate-nilin-in" style={{animationDelay: '0.18s'}}>
          <TrustBadges />
        </div>

        {/* Subcategory Grid */}
        <PageErrorBoundary pageName={`${category.name} Category`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            {filteredSubcategories.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {filteredSubcategories.map((subcategory: any, index: number) => {
                  const isPopular = popularSlugs.includes(subcategory.slug);
                  return (
                    <div key={subcategory.slug} className="animate-nilin-in hover-lift" style={{animationDelay: `${0.2 + index * 0.04}s`}}>
                      <SubcategoryCard
                        subcategory={subcategory}
                        categorySlug={slug}
                        onClick={() => handleSubcategoryClick(subcategory.slug)}
                        isPopular={isPopular}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass-nilin rounded-nilin p-12 text-center shadow-nilin animate-nilin-in">
                <div className="w-16 h-16 rounded-nilin bg-gradient-to-br from-nilin-blush to-nilin-coral flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-white" />
                </div>
                <p className="text-nilin-warmGray mb-2">No services found matching your search.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowPopularOnly(false);
                  }}
                  className="text-nilin-coral hover:text-nilin-coral/80 font-medium text-sm mt-2 hover-lift"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </PageErrorBoundary>
      </main>

      <Footer />
    </div>
  );
};

export default CategoryPage;
