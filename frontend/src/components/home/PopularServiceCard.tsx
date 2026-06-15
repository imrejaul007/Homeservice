import React from 'react';
import { Sparkles, Star } from 'lucide-react';
import { CardBody, CardContainer, CardItem } from '@/components/ui/3d-card';
import type { Service } from '@/types/service';

interface PopularServiceCardProps {
  service: Service;
  index: number;
  onClick: () => void;
  getServiceImage: (service: Service) => string;
  getDisplayPrice: (service: Service) => string;
}

const CATEGORY_GRADIENTS: Record<string, { card: string; shadow: string; image: string }> = {
  hair: {
    card: 'from-rose-50/90 via-white to-amber-50/80',
    shadow: 'shadow-rose-200/40',
    image: 'from-rose-400/20 to-amber-300/10',
  },
  makeup: {
    card: 'from-purple-50/90 via-white to-pink-50/80',
    shadow: 'shadow-purple-200/40',
    image: 'from-purple-400/20 to-pink-300/10',
  },
  nails: {
    card: 'from-pink-50/90 via-white to-rose-50/80',
    shadow: 'shadow-pink-200/40',
    image: 'from-pink-400/20 to-rose-300/10',
  },
  skin: {
    card: 'from-teal-50/90 via-white to-cyan-50/80',
    shadow: 'shadow-teal-200/40',
    image: 'from-teal-400/20 to-cyan-300/10',
  },
  spa: {
    card: 'from-emerald-50/90 via-white to-green-50/80',
    shadow: 'shadow-emerald-200/40',
    image: 'from-emerald-400/20 to-green-300/10',
  },
  massage: {
    card: 'from-amber-50/90 via-white to-orange-50/80',
    shadow: 'shadow-amber-200/40',
    image: 'from-amber-400/20 to-orange-300/10',
  },
  default: {
    card: 'from-nilin-blush/80 via-white to-nilin-peach/70',
    shadow: 'shadow-nilin-coral/30',
    image: 'from-nilin-coral/25 to-nilin-peach/15',
  },
};

const getCategoryGradient = (category: string) => {
  const cat = category?.toLowerCase() || '';
  for (const [key, style] of Object.entries(CATEGORY_GRADIENTS)) {
    if (key !== 'default' && cat.includes(key)) return style;
  }
  return CATEGORY_GRADIENTS.default;
};

const PopularServiceCard: React.FC<PopularServiceCardProps> = ({
  service,
  index,
  onClick,
  getServiceImage,
  getDisplayPrice,
}) => {
  const rating =
    typeof service.rating === 'number'
      ? service.rating
      : (service.rating?.average || 4.8);
  const gradient = getCategoryGradient(service.category || '');

  return (
    <CardContainer
      className="inter-var flex-shrink-0 w-[300px] sm:w-[340px]"
      containerClassName="py-0"
    >
      {/* Stacked back card — depth / pop effect */}
      <CardItem
        translateZ={-60}
        className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient.card} translate-x-3 translate-y-4 scale-[0.96] opacity-90 border border-white/60 ${gradient.shadow} shadow-xl`}
        aria-hidden
      />

      <CardBody
        onClick={onClick}
        className={`relative group/card bg-gradient-to-br ${gradient.card} border border-white/70 w-full h-auto rounded-2xl p-6 cursor-pointer shadow-[0_10px_40px_rgba(45,45,45,0.08)] hover:shadow-[0_24px_60px_rgba(232,180,168,0.35)] transition-shadow duration-300 ring-1 ring-nilin-coral/10 hover:ring-nilin-coral/25`}
      >
        <CardItem
          translateZ="50"
          className="text-xl font-bold text-nilin-charcoal truncate w-full leading-tight"
        >
          {service.name}
        </CardItem>
        <CardItem
          as="p"
          translateZ="60"
          className="text-nilin-warmGray text-sm mt-2 truncate w-full"
        >
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gradient-to-r from-nilin-blush/80 to-nilin-peach/60 text-nilin-charcoal/80 text-xs font-medium capitalize">
            {service.category}
          </span>
        </CardItem>

        <CardItem translateZ="100" className="w-full mt-5 relative">
          <div className="relative rounded-2xl overflow-hidden ring-2 ring-white/80 shadow-lg group-hover/card:shadow-2xl transition-shadow duration-300">
            <img
              src={getServiceImage(service)}
              alt={service.name}
              height="1000"
              width="1000"
              className="h-64 w-full object-cover"
            />
            <div
              className={`absolute inset-0 bg-gradient-to-t ${gradient.image} via-transparent to-transparent pointer-events-none`}
            />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />

            {index < 2 && (
              <div className="absolute top-3 left-3 px-3 py-1.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-full text-xs font-semibold flex items-center gap-1 shadow-md">
                <Sparkles className="w-3 h-3" />
                Featured
              </div>
            )}

            <CardItem
              translateZ="120"
              className="absolute top-3 right-3"
            >
              <div className="px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full flex items-center gap-1 shadow-md border border-white/50">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-nilin-charcoal">{rating.toFixed(1)}</span>
              </div>
            </CardItem>
          </div>
        </CardItem>

        <div className="flex justify-between items-center mt-8 px-1">
          <CardItem
            translateZ={20}
            className="text-xl font-bold bg-gradient-to-r from-nilin-coral to-nilin-rose bg-clip-text text-transparent"
          >
            {getDisplayPrice(service)}
          </CardItem>
          <CardItem
            translateZ={20}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-nilin-charcoal to-nilin-charcoal/90 text-white text-sm font-bold shadow-md hover:shadow-lg transition-shadow"
          >
            Book now →
          </CardItem>
        </div>
      </CardBody>
    </CardContainer>
  );
};

export default PopularServiceCard;
