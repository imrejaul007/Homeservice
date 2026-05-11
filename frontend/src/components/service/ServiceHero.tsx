import React from 'react';
import { ArrowRight, Shield, Clock } from 'lucide-react';

interface ServiceHeroProps {
  title: string;
  subtitle: string;
  image?: string;
  onBookClick: () => void;
  disabled?: boolean;
}

const ServiceHero: React.FC<ServiceHeroProps> = ({
  title,
  subtitle,
  image,
  onBookClick,
  disabled
}) => {
  // Default fallback image - professional massage/spa setting
  const heroImage = image || 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1400&q=80';

  return (
    <section className="relative min-h-[420px] md:min-h-[500px]">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt=""
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay - darker on left for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
        {/* Bottom gradient fade */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#FAF8F5] to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 md:pt-24 pb-20 md:pb-28">
        <div className="max-w-2xl">
          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-white mb-5 leading-[1.1] tracking-tight">
            {title}
          </h1>

          {/* Subtitle */}
          <p className="text-white/90 text-lg md:text-xl mb-8 leading-relaxed max-w-lg">
            {subtitle}
          </p>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-white/90 text-sm font-medium">Verified Experts</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-white/90 text-sm font-medium">Book in 2 mins</span>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={onBookClick}
            disabled={disabled}
            className="
              group inline-flex items-center gap-3
              px-8 py-4 rounded-xl
              bg-gradient-to-r from-[#C4A962] to-[#D4B872]
              hover:from-[#B39952] hover:to-[#C4A962]
              text-white font-semibold text-lg
              shadow-lg shadow-amber-500/25
              hover:shadow-xl hover:shadow-amber-500/30
              transform hover:-translate-y-0.5
              transition-all duration-300 ease-out
              disabled:opacity-50 disabled:cursor-not-allowed
              disabled:hover:translate-y-0 disabled:hover:shadow-lg
            "
          >
            Book this service
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default ServiceHero;
