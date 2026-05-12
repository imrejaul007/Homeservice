import React from 'react';
import { ArrowRight } from 'lucide-react';
import { SUBCATEGORY_IMAGES } from '../../constants/images';

interface SubcategoryMetadata {
  displayName?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
  iconImage?: string;
  averagePrice?: number;
  averageDuration?: number;
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
}

const SubcategoryCard: React.FC<SubcategoryCardProps> = ({ subcategory, categorySlug, onClick }) => {
  const displayName = subcategory.metadata?.displayName || subcategory.name;
  const price = subcategory.metadata?.averagePrice;
  const duration = subcategory.metadata?.averageDuration;

  // Get image from centralized image library
  const image = (categorySlug && SUBCATEGORY_IMAGES[categorySlug]?.[subcategory.slug])
    || subcategory.metadata?.heroImage
    || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80&fit=crop';

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-nilin-lg overflow-hidden text-left w-full border-nilin shadow-nilin hover-lift transition-all duration-300 group"
    >
      {/* Image with glass overlay */}
      <div className="relative h-[140px] md:h-[160px] overflow-hidden">
        <img
          src={image}
          alt={displayName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent glass-nilin" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-nilin-charcoal text-base mb-1 group-hover:text-nilin-primary transition-colors">
          {displayName}
        </h3>

        <div className="flex items-center gap-3 text-sm text-nilin-warm-gray mb-2">
          {price && <span>From AED {price}</span>}
          {price && duration && <span className="text-nilin-blush">|</span>}
          {duration && <span>{duration} min</span>}
        </div>

        <div className="flex items-center gap-1 text-nilin-coral">
          <span className="text-xs font-medium">View details</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  );
};

export default SubcategoryCard;
