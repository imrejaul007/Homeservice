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
      className="bg-white rounded-2xl overflow-hidden text-left w-full border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
    >
      {/* Image */}
      <div className="relative h-[140px] md:h-[160px] overflow-hidden">
        <img
          src={image}
          alt={displayName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-base mb-1 group-hover:text-nilin-primary transition-colors">
          {displayName}
        </h3>

        <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
          {price && <span>From AED {price}</span>}
          {price && duration && <span className="text-gray-300">|</span>}
          {duration && <span>{duration} min</span>}
        </div>

        <div className="flex items-center gap-1 text-nilin-primary">
          <span className="text-xs font-medium">View details</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  );
};

export default SubcategoryCard;
