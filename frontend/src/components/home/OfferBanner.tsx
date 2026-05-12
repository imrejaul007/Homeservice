import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const OFFERS = [
  {
    title: 'First Booking 20% Off',
    subtitle: 'Use code NILIN20 on your first service',
    gradient: 'from-nilin-rose via-nilin-coral to-nilin-peach',
    accent: '#E8B4A8',
  },
  {
    title: 'Weekend Spa Special',
    subtitle: 'Swedish & Deep Tissue from AED 199',
    gradient: 'from-nilin-charcoal via-gray-700 to-nilin-charcoal',
    accent: '#2D2D2D',
  },
  {
    title: 'Bridal Glow Package',
    subtitle: 'Complete bridal beauty from AED 1,499',
    gradient: 'from-nilin-blush via-nilin-peach to-nilin-rose',
    accent: '#D4A89A',
  },
];

const OfferBanner: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -350 : 350,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-serif text-nilin-charcoal">Special Offers</h2>
            <p className="text-sm text-nilin-warmGray">Limited time deals</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="glass-btn w-10 h-10 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              className="glass-btn w-10 h-10 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {OFFERS.map((offer, index) => (
            <div
              key={index}
              className="flex-shrink-0 w-[320px] md:w-[380px] rounded-2xl overflow-hidden shadow-lg card-3d"
            >
              <div className={`h-40 bg-gradient-to-br ${offer.gradient} p-6 flex flex-col justify-between`}>
                <div>
                  <h3 className="text-xl font-serif text-white mb-1">{offer.title}</h3>
                  <p className="text-sm text-white/80">{offer.subtitle}</p>
                </div>
                <button
                  onClick={() => navigate('/search')}
                  className="self-start inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium hover:bg-white/30 transition-colors"
                >
                  Claim Offer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OfferBanner;
