import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Gift, TrendingUp } from 'lucide-react';

// Promo data interface
export interface Promo {
  id: string;
  title: string;
  description: string;
  badge?: string;
  ctaText: string;
  ctaLink: string;
  colorScheme?: 'pink' | 'lavender' | 'blue' | 'cream';
}

interface PromoCardProps {
  promo: Promo;
  colorIndex?: number;
  onClick?: (promo: Promo) => void;
}

const PromoCard: React.FC<PromoCardProps> = ({
  promo,
  colorIndex = 0,
  onClick
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(promo);
    } else {
      navigate(promo.ctaLink);
    }
  };

  // Color schemes
  const colorSchemes = {
    pink: {
      bg: 'bg-gradient-to-br from-nilin-pink to-nilin-lavender',
      badge: 'bg-pink-500',
      icon: <Sparkles className="h-6 w-6" />,
    },
    lavender: {
      bg: 'bg-gradient-to-br from-nilin-lavender to-nilin-blue',
      badge: 'bg-purple-500',
      icon: <Gift className="h-6 w-6" />,
    },
    blue: {
      bg: 'bg-gradient-to-br from-nilin-blue to-nilin-cream',
      badge: 'bg-blue-500',
      icon: <TrendingUp className="h-6 w-6" />,
    },
    cream: {
      bg: 'bg-gradient-to-br from-nilin-cream to-nilin-pink',
      badge: 'bg-yellow-500',
      icon: <Sparkles className="h-6 w-6" />,
    },
  };

  const schemes = Object.values(colorSchemes);
  const scheme = promo.colorScheme
    ? colorSchemes[promo.colorScheme]
    : schemes[colorIndex % schemes.length];

  return (
    <button
      onClick={handleClick}
      className={`
        ${scheme.bg}
        rounded-2xl p-6 text-left
        hover:shadow-xl transition-all duration-300
        transform hover:scale-105
        border border-gray-100
        group relative overflow-hidden
        w-full
      `}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 right-4 text-6xl">✨</div>
        <div className="absolute bottom-4 left-4 text-4xl">⭐</div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Badge */}
        {promo.badge && (
          <span className={`
            ${scheme.badge}
            text-white text-xs font-bold px-3 py-1 rounded-full
            inline-flex items-center gap-1 mb-4
          `}>
            {scheme.icon}
            {promo.badge}
          </span>
        )}

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {promo.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-700 mb-4 line-clamp-2">
          {promo.description}
        </p>

        {/* CTA */}
        <div className="flex items-center gap-2 text-gray-900 font-semibold text-sm group-hover:gap-3 transition-all">
          <span>{promo.ctaText}</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </button>
  );
};

export default PromoCard;
