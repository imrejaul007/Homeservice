import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const OFFERS = [
  {
    title: 'First Booking 20% Off',
    subtitle: 'Use code NILIN20 on your first service',
    gradient: 'from-nilin-pink via-pink-100 to-nilin-lavender',
    cta: 'Book Now',
  },
  {
    title: 'Weekend Massage Special',
    subtitle: 'Swedish & Deep Tissue from AED 199 this weekend',
    gradient: 'from-nilin-blue via-blue-100 to-nilin-lavender',
    cta: 'View Offer',
  },
  {
    title: 'Bridal Glow Package',
    subtitle: 'Complete bridal beauty starting at AED 1,499',
    gradient: 'from-nilin-cream via-amber-50 to-nilin-pink',
    cta: 'Explore',
  },
];

const OfferBanner: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -320 : 320,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="py-6 md:py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            Special offers
          </h2>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              className="p-2 rounded-full bg-white border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 rounded-full bg-white border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {OFFERS.map((offer, index) => (
            <div
              key={index}
              className={`flex-shrink-0 w-[300px] md:w-[400px] rounded-2xl bg-gradient-to-br ${offer.gradient} p-6 md:p-8 cursor-pointer hover:shadow-lg transition-shadow`}
            >
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">
                {offer.title}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {offer.subtitle}
              </p>
              <button className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors">
                {offer.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OfferBanner;
