import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Heart, Home, Scissors, Paintbrush, Hand, Eye } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';

export interface Category {
  id: string;
  name: string;
  icon: string;
  serviceCount?: number;
  slug: string;
}

interface CategoryGridProps {
  categories?: Category[];
  onCategoryClick?: (category: Category) => void;
}

// Icon mapping for beauty categories
const iconMap: Record<string, React.ReactNode> = {
  scissors: <Scissors className="h-8 w-8" />,
  paintbrush: <Paintbrush className="h-8 w-8" />,
  palette: <Paintbrush className="h-8 w-8" />,
  hand: <Hand className="h-8 w-8" />,
  sparkles: <Sparkles className="h-8 w-8" />,
  massage: <Heart className="h-8 w-8" />,
  eye: <Eye className="h-8 w-8" />,
  home: <Home className="h-8 w-8" />,
};

// Slug-to-icon fallback for API categories
const slugIconMap: Record<string, string> = {
  'hair': 'scissors',
  'makeup': 'palette',
  'nails': 'hand',
  'skin-aesthetics': 'sparkles',
  'massage-body': 'massage',
  'personal-care': 'eye',
};

const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories: propCategories,
  onCategoryClick
}) => {
  const navigate = useNavigate();
  const { categories: apiCategories, isLoading } = useCategories(undefined, true);

  // Map API categories to the component's Category interface
  const resolvedCategories: Category[] = propCategories ?? apiCategories.map(cat => ({
    id: cat._id,
    name: cat.name,
    icon: cat.icon || slugIconMap[cat.slug] || 'home',
    serviceCount: cat.subcategoryCount,
    slug: cat.slug,
  }));

  const handleCategoryClick = (category: Category) => {
    if (onCategoryClick) {
      onCategoryClick(category);
    } else {
      navigate(`/search?category=${category.slug}`);
    }
  };

  const gradients = [
    'bg-gradient-nilin-primary',
    'bg-gradient-nilin-secondary',
    'bg-gradient-nilin-tertiary',
    'bg-gradient-nilin-lavender-blue',
    'bg-gradient-nilin-pink-lavender',
    'bg-gradient-nilin-secondary',
  ];

  // Loading skeleton
  if (!propCategories && isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl h-32 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
      {resolvedCategories.map((category, index) => (
        <button
          key={category.id}
          onClick={() => handleCategoryClick(category)}
          className="group relative"
        >
          <div className={`
            ${gradients[index % gradients.length]}
            rounded-2xl p-6 h-32 flex flex-col items-center justify-center
            transition-all duration-300 ease-in-out
            hover:shadow-lg hover:scale-105
            border border-gray-100
          `}>
            {/* Icon */}
            <div className="text-gray-700 mb-2 group-hover:scale-110 transition-transform">
              {iconMap[category.icon] || iconMap.home}
            </div>

            {/* Category Name */}
            <h3 className="text-sm font-semibold text-gray-900 text-center">
              {category.name}
            </h3>

            {/* Service count badge */}
            {category.serviceCount ? (
              <span className="absolute top-2 right-2 bg-white text-gray-700 text-xs font-medium px-2 py-1 rounded-full shadow-sm">
                {category.serviceCount}+
              </span>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
};

export default CategoryGrid;
