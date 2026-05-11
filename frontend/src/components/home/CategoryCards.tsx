import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../../hooks/useCategories';
import { CATEGORY_IMAGES } from '../../constants/images';

const CATEGORY_DISPLAY_TITLES: Record<string, string> = {
  'hair': 'Hair',
  'makeup': 'Makeup',
  'nails': 'Nails',
  'skin-aesthetics': 'Skin & Aesthetics',
  'massage-body': 'Massage & Body',
  'personal-care': 'Personal Care',
};

const CategoryCardSkeleton: React.FC = () => (
  <div className="flex flex-col items-center gap-2">
    <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-gray-200 animate-pulse" />
    <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
  </div>
);

const CategoryCards: React.FC = () => {
  const navigate = useNavigate();
  const { categories, isLoading } = useCategories(undefined, true);

  const displayCategories = categories.slice(0, 6);

  return (
    <section className="py-8 md:py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
            What are you looking for?
          </h2>
          <p className="text-sm text-gray-500">Choose from our beauty & wellness categories</p>
        </div>

        <div className="flex justify-center">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-6 md:gap-10">
            {isLoading ? (
              <>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <CategoryCardSkeleton key={i} />
                ))}
              </>
            ) : (
              displayCategories.map((category: any) => {
                const images = CATEGORY_IMAGES[category.slug];
                const thumbnailUrl = images?.thumbnail || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300&q=80&fit=crop';
                const title = CATEGORY_DISPLAY_TITLES[category.slug] || category.name;

                return (
                  <button
                    key={category._id || category.slug}
                    onClick={() => navigate(`/category/${category.slug}`)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-gray-100 group-hover:border-nilin-accent group-hover:scale-105 transition-all duration-300 shadow-sm group-hover:shadow-md">
                      <img
                        src={thumbnailUrl}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-gray-700 group-hover:text-nilin-primary transition-colors text-center">
                      {title}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoryCards;
