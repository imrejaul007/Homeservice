import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../../hooks/useCategories';
import { CATEGORY_IMAGES } from '../../constants/images';

const CategoryCards: React.FC = () => {
  const navigate = useNavigate();
  const { categories, isLoading } = useCategories(undefined, true);

  const displayCategories = categories.slice(0, 6);

  return (
    <section className="py-12 px-4 bg-gradient-to-b from-nilin-cream to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-serif text-nilin-charcoal mb-3">
            What are you looking for?
          </h2>
          <p className="text-nilin-warmGray">Explore our curated categories</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 md:gap-8">
            {displayCategories.map((category: any) => {
              const images = CATEGORY_IMAGES[category.slug];
              const thumbnailUrl = images?.thumbnail || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80';

              return (
                <button
                  key={category._id}
                  onClick={() => navigate(`/category/${category.slug}`)}
                  className="group flex flex-col items-center gap-3 focus:outline-none"
                >
                  {/* Image Container */}
                  <div className="relative">
                    {/* Glow effect on hover */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-nilin-coral/40 to-nilin-rose/40 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Main circle */}
                    <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                      <img
                        src={thumbnailUrl}
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-nilin-charcoal/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Featured badge */}
                    {category.featured && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-nilin-coral rounded-full flex items-center justify-center shadow-md">
                        <span className="text-white text-xs">✨</span>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <span className="text-sm font-medium text-nilin-charcoal group-hover:text-nilin-coral transition-colors text-center">
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* View All Link */}
        <div className="text-center mt-10">
          <button
            onClick={() => navigate('/categories')}
            className="glass-btn inline-flex items-center gap-2 px-6 py-3 rounded-full text-nilin-charcoal"
          >
            View All Categories
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

export default CategoryCards;
