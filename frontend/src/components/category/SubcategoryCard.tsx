import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { SUBCATEGORY_IMAGES } from '../../constants/images';
import { getSubcategoryImageKey } from '../../utils/categorySlugResolver';

interface SubcategoryMetadata {
  displayName?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
  iconImage?: string;
  averagePrice?: number;
  averageDuration?: number;
  isPopular?: boolean;
}

interface Subcategory {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  metadata?: SubcategoryMetadata;
}

interface SubcategoryCardProps {
  subcategory: Subcategory;
  categorySlug?: string;
  onClick: () => void;
  isPopular?: boolean;
}

const SubcategoryCard: React.FC<SubcategoryCardProps> = ({
  subcategory,
  categorySlug,
  onClick,
  isPopular = false
}) => {
  const displayName = subcategory.metadata?.displayName || subcategory.name;
  const price = subcategory.metadata?.averagePrice;
  const duration = subcategory.metadata?.averageDuration;

  const imageKey = categorySlug ? getSubcategoryImageKey(categorySlug, subcategory.slug) : subcategory.slug;
  const image = (categorySlug && SUBCATEGORY_IMAGES[categorySlug]?.[imageKey])
    || subcategory.metadata?.heroImage
    || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80&fit=crop';

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-nilin-lg overflow-hidden text-left w-full border-nilin shadow-nilin hover-lift transition-all duration-300 group relative"
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg">
          <Sparkles className="w-3 h-3" />
          Popular
        </div>
      )}

      {/* Image with glass overlay */}
      <div className="relative h-[140px] md:h-[150px] overflow-hidden">
        <img
          src={image}
          alt={displayName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Gradient border effect on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-nilin-coral/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-nilin-charcoal text-base mb-1.5 group-hover:text-nilin-coral transition-colors line-clamp-1">
          {displayName}
        </h3>

        <div className="flex items-center gap-3 text-sm text-nilin-warm-gray mb-3">
          {price && (
            <span className="font-medium text-nilin-charcoal">From AED {price}</span>
          )}
          {price && duration && (
            <span className="text-nilin-blush">•</span>
          )}
          {duration && (
            <span className="text-nilin-warmGray">{duration} min</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-nilin-coral">
            <span className="text-xs font-medium">View details</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>

          {/* Quick arrow indicator */}
          <div className="w-6 h-6 rounded-full bg-nilin-blush/20 flex items-center justify-center group-hover:bg-nilin-coral/20 transition-colors">
            <ArrowRight className="w-3 h-3 text-nilin-coral" />
          </div>
        </div>
      </div>

      {/* Bottom border accent on hover */}
      <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-nilin-coral to-amber-500 transition-all duration-300" />
    </button>
  );
};

export default SubcategoryCard;
