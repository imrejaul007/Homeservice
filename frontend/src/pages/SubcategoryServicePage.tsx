import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Home, Star, Clock, Check } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import { useCategory } from '../hooks/useCategories';
import { useProvidersBySubcategory } from '../hooks/useProvider';
import { SUBCATEGORY_IMAGES, CATEGORY_IMAGES } from '../constants/images';
import { SERVICE_CONTENT } from '../constants/serviceContent';
import RecommendedProviders from '../components/service/RecommendedProviders';
import ServiceVariants from '../components/service/ServiceVariants';
import ServiceProcedure from '../components/service/ServiceProcedure';
import ServicePrerequisites from '../components/service/ServicePrerequisites';
import ServiceEquipment from '../components/service/ServiceEquipment';
import ServiceFAQ from '../components/service/ServiceFAQ';
import ServiceReviews from '../components/service/ServiceReviews';

// Loading skeleton
const ServicePageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-nilin-cream">
    <NavigationHeader />
    <div className="animate-pulse">
      <div className="h-[300px] md:h-[400px] bg-gradient-to-r from-nilin-blush to-nilin-peach" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-8 bg-white/50 rounded-nilin w-64 mb-4" />
        <div className="h-4 bg-white/30 rounded-nilin w-96 mb-8" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-nilin rounded-nilin h-24 shadow-nilin" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Not found
const NotFound: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-nilin-cream">
      <NavigationHeader />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center animate-nilin-in">
        <div className="w-24 h-24 rounded-nilin bg-gradient-to-br from-nilin-blush to-nilin-coral flex items-center justify-center mx-auto mb-6 shadow-nilin">
          <Home className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-nilin-charcoal mb-4">
          Service not found
        </h1>
        <p className="text-nilin-warmGray mb-8 max-w-md mx-auto">
          The service you're looking for doesn't exist or may have been moved.
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
    <nav className="flex items-center gap-2 text-sm flex-wrap">
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 && <ChevronRight className="w-4 h-4 text-nilin-coral flex-shrink-0" />}
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

const SubcategoryServicePage: React.FC = () => {
  const { categorySlug, subcategorySlug } = useParams<{ categorySlug: string; subcategorySlug: string }>();
  const navigate = useNavigate();

  const { category, isLoading: categoryLoading } = useCategory(categorySlug);
  const { providers, isLoading: providersLoading } = useProvidersBySubcategory(
    categorySlug, subcategorySlug, { limit: 10 }
  );

  const subcategory = useMemo(() =>
    category?.subcategories?.find((s: any) => s.slug === subcategorySlug),
    [category, subcategorySlug]
  );

  // Get rich content from constants
  const content = categorySlug && subcategorySlug
    ? SERVICE_CONTENT?.[categorySlug]?.[subcategorySlug]
    : undefined;

  const transformedProviders = useMemo(() => {
    if (!providers) return [];
    return providers.map((provider: any) => ({
      id: provider.id || provider._id,
      firstName: provider.firstName,
      lastName: provider.lastName,
      businessName: provider.businessName,
      profilePhoto: provider.profilePhoto,
      tier: provider.tier || 'standard',
      rating: provider.rating || 0,
      reviewCount: provider.reviewCount || 0,
      isVerified: provider.isVerified || false,
      startingPrice: provider.startingPrice || subcategory?.metadata?.averagePrice || 500,
      maxPrice: provider.maxPrice || (provider.startingPrice ? provider.startingPrice + 150 : 650),
    }));
  }, [providers, subcategory]);

  const handleBookClick = () => {
    if (transformedProviders.length > 0) {
      navigate(`/provider/${transformedProviders[0].id}`);
    } else {
      navigate(`/search?category=${categorySlug}&subcategory=${subcategorySlug}`);
    }
  };

  const handleProviderClick = (provider: any) => {
    navigate(`/provider/${provider.id}`);
  };

  const handleViewProfile = (providerId: string) => {
    navigate(`/provider/${providerId}`);
  };

  if (categoryLoading) return <ServicePageSkeleton />;
  if (!category || !subcategory) return <NotFound />;

  const metadata = (subcategory.metadata || {}) as any;
  const displayName = metadata.displayName || subcategory.name;
  const startingPrice = content?.startingPrice || metadata.averagePrice || 500;
  const rating = content?.rating || 4.8;
  const reviewCount = content?.reviewCount || 1250;
  const duration = content?.duration || `${metadata.averageDuration || 60} min`;

  // Get hero image
  const heroImage = (categorySlug && subcategorySlug && SUBCATEGORY_IMAGES[categorySlug]?.[subcategorySlug])
    || metadata.heroImage
    || CATEGORY_IMAGES[categorySlug || '']?.hero
    || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop';

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="bg-white/80 glass-nilin border-b border-nilin-blush/30 animate-nilin-in">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: category.name, href: `/category/${categorySlug}` },
                { label: displayName },
              ]}
            />
          </div>
        </div>

        {/* Hero Section */}
        <div className="relative h-[280px] md:h-[380px] overflow-hidden animate-nilin-in" style={{animationDelay: '0.1s'}}>
          <img
            src={heroImage}
            alt={displayName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-nilin-charcoal/70 via-nilin-charcoal/50 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">
                {content?.title || `${displayName} at Home`}
              </h1>
              <p className="text-white/80 text-sm md:text-base mb-4 max-w-lg">
                {content?.tagline || 'Professional, verified specialists at your location'}
              </p>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-1.5 glass-nilin px-3 py-1.5 rounded-full">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-white text-sm font-semibold">{rating.toFixed(1)}</span>
                  <span className="text-white/70 text-sm">({reviewCount.toLocaleString()})</span>
                </div>
                <div className="flex items-center gap-1.5 glass-nilin px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4 text-white" />
                  <span className="text-white text-sm">{duration}</span>
                </div>
                <span className="text-white text-lg font-bold">
                  From AED {startingPrice}
                </span>
              </div>
              <button
                onClick={handleBookClick}
                className="btn-nilin px-8 py-3 rounded-nilin text-white font-semibold text-sm hover-lift shadow-nilin"
              >
                Book Now
              </button>
            </div>
          </div>
          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-nilin-cream to-transparent" />
        </div>

        {/* Service Variants */}
        {content?.variants && content.variants.length > 0 && (
          <div className="animate-nilin-in" style={{animationDelay: '0.2s'}}>
            <ServiceVariants variants={content.variants} />
          </div>
        )}

        {/* What's Included */}
        {content?.whatsIncluded && content.whatsIncluded.length > 0 && (
          <section className="py-8 md:py-12 animate-nilin-in" style={{animationDelay: '0.25s'}}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl md:text-2xl font-bold text-nilin-charcoal mb-6">
                What's included
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {content.whatsIncluded.map((item, index) => (
                  <div key={index} className="glass-nilin rounded-nilin p-4 shadow-nilin hover-lift animate-nilin-in" style={{animationDelay: `${0.25 + index * 0.03}s`}}>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-nilin-success to-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm text-nilin-charcoal">{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Service Procedure */}
        {content?.procedure && content.procedure.length > 0 && (
          <div className="animate-nilin-in" style={{animationDelay: '0.3s'}}>
            <ServiceProcedure steps={content.procedure} />
          </div>
        )}

        {/* Prerequisites */}
        {content?.prerequisites && (
          <div className="animate-nilin-in" style={{animationDelay: '0.35s'}}>
            <ServicePrerequisites
              dos={content.prerequisites.dos}
              donts={content.prerequisites.donts}
            />
          </div>
        )}

        {/* Equipment */}
        {content?.equipment && content.equipment.length > 0 && (
          <div className="animate-nilin-in" style={{animationDelay: '0.4s'}}>
            <ServiceEquipment equipment={content.equipment} />
          </div>
        )}

        {/* Recommended Providers */}
        <div className="animate-nilin-in" style={{animationDelay: '0.45s'}}>
          <RecommendedProviders
            providers={transformedProviders}
            isLoading={providersLoading}
            onProviderClick={handleProviderClick}
            onViewProfile={handleViewProfile}
          />
        </div>

        {/* Reviews */}
        <div className="animate-nilin-in" style={{animationDelay: '0.5s'}}>
          <ServiceReviews rating={rating} reviewCount={reviewCount} />
        </div>

        {/* FAQ */}
        {content?.faqs && content.faqs.length > 0 && (
          <div className="animate-nilin-in" style={{animationDelay: '0.55s'}}>
            <ServiceFAQ faqs={content.faqs} />
          </div>
        )}

        {/* Mobile Fixed Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 glass-nilin border-t border-nilin-blush/30 px-4 py-3 z-50 md:hidden shadow-nilin">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-nilin-charcoal">AED {startingPrice}</span>
              <span className="text-xs text-nilin-warmGray ml-1">onwards</span>
            </div>
            <button
              onClick={handleBookClick}
              className="btn-nilin px-6 py-2.5 rounded-nilin text-white font-semibold text-sm hover-lift"
            >
              Book Now
            </button>
          </div>
        </div>

        {/* Bottom spacer for mobile fixed bar */}
        <div className="h-16 md:hidden" />
      </main>

      <Footer />
    </div>
  );
};

export default SubcategoryServicePage;
