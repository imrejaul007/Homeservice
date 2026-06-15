import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../../hooks/useCategories';
import { CATEGORY_IMAGES } from '../../constants/images';
import { cn } from '@/lib/utils';

const CategoryCards: React.FC = () => {
  const navigate = useNavigate();
  const { categories, isLoading } = useCategories(undefined, true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const displayCategories = categories.slice(0, 6);

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-nilin-cream to-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className={cn(
          'text-center mb-12 transition-all duration-700',
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}>
          <h2 className="text-4xl md:text-5xl font-bold text-nilin-charcoal mb-3">
            What are you looking for?
          </h2>
          <p className="text-lg text-nilin-warmGray">Explore our curated categories</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-8">
            {displayCategories.map((category: any, index: number) => {
              const images = CATEGORY_IMAGES[category.slug];
              const thumbnailUrl = images?.thumbnail || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80';

              return (
                <button
                  key={category._id}
                  onClick={() => navigate(`/category/${category.slug}`)}
                  className="group flex flex-col items-center gap-3 focus:outline-none"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0) scale(1)' : `translateY(30px) scale(0.9)`,
                    transition: `opacity 0.6s ease ${index * 100}ms, transform 0.6s ease ${index * 100}ms`,
                  }}
                >
                  {/* Image Container */}
                  <div className="relative">
                    {/* Glow effect on hover */}
                    <div className={cn(
                      'absolute -inset-3 bg-gradient-to-r from-nilin-coral/50 to-nilin-rose/50 rounded-full blur-xl',
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-90 group-hover:scale-100'
                    )} />

                    {/* Main circle - Larger */}
                    <div className={cn(
                      'relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden',
                      'shadow-lg group-hover:shadow-2xl transition-all duration-500',
                      'group-hover:scale-110 group-hover:-translate-y-2'
                    )}>
                      <img
                        src={thumbnailUrl}
                        alt={category.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className={cn(
                        'absolute inset-0 bg-gradient-to-t from-nilin-charcoal/30 to-transparent',
                        'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                      )} />
                    </div>

                    {/* Featured badge */}
                    {category.featured && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-nilin-coral rounded-full flex items-center justify-center shadow-md animate-pulse">
                        <span className="text-white text-xs">✨</span>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <span className="text-base font-medium text-nilin-charcoal group-hover:text-nilin-coral transition-colors duration-300 text-center">
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* View All Button - Fixed Animation */}
        <div className={cn(
          'text-center mt-12 transition-all duration-700 delay-500',
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}>
          <button
            onClick={() => navigate('/customer/book-services')}
            className={cn(
              'group relative overflow-hidden',
              'px-8 py-4 rounded-full',
              'bg-nilin-charcoal text-white font-semibold text-base',
              'hover:bg-nilin-coral hover:shadow-xl hover:shadow-nilin-coral/30 hover:-translate-y-1',
              'transition-all duration-300 ease-out'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <span>View All Categories</span>
              <svg
                className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default CategoryCards;