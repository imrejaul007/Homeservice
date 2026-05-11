import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useCategory } from '../../hooks/useCategories';
import { SUBCATEGORY_IMAGES } from '../../constants/images';

interface CategorySpotlightProps {
  categorySlug: string;
  title: string;
}

const CategorySpotlight: React.FC<CategorySpotlightProps> = ({ categorySlug, title }) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { category, isLoading } = useCategory(categorySlug);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -240 : 240,
        behavior: 'smooth',
      });
    }
  };

  const subcategories = category?.subcategories?.filter((s: any) => s.isActive !== false) || [];
  const subcatImages = SUBCATEGORY_IMAGES[categorySlug] || {};

  if (isLoading) {
    return (
      <section className="py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse" />
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-[200px] md:w-[240px] h-[260px] bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (subcategories.length === 0) return null;

  return (
    <section className="py-6 md:py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/category/${categorySlug}`)}
              className="flex items-center gap-1 text-sm font-semibold text-nilin-primary hover:text-nilin-primary-dark transition-colors"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="hidden md:flex items-center gap-1 ml-2">
              <button
                onClick={() => scroll('left')}
                className="p-2 rounded-full bg-white border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => scroll('right')}
                className="p-2 rounded-full bg-white border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {subcategories.map((sub: any) => {
            const displayName = sub.metadata?.displayName || sub.name;
            const price = sub.metadata?.averagePrice;
            const image = subcatImages[sub.slug] || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80&fit=crop';

            return (
              <div
                key={sub.slug}
                onClick={() => navigate(`/service/${categorySlug}/${sub.slug}`)}
                className="flex-shrink-0 w-[200px] md:w-[240px] bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-0.5"
              >
                <div className="relative h-[140px] md:h-[160px] overflow-hidden">
                  <img
                    src={image}
                    alt={displayName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-3 md:p-4">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-nilin-primary transition-colors">
                    {displayName}
                  </h3>
                  {price && (
                    <p className="text-xs text-gray-500">
                      From AED {price}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-nilin-primary">
                    <span className="text-xs font-medium">View details</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategorySpotlight;
