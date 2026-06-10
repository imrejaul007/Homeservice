import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

interface CategorySpotlightProps {
  categorySlug?: string;
  title?: string;
}

const SERVICES = [
  {
    id: '1',
    title: 'Eyelash Extension',
    subtitle: 'Classic & Volume',
    image: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=600&q=80',
    price: 'From AED 199',
    link: '/category/personal-care',
  },
  {
    id: '2',
    title: 'Gel Nails',
    subtitle: 'Long-lasting shine',
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80',
    price: 'From AED 129',
    link: '/category/nails',
  },
  {
    id: '3',
    title: 'Hair Color',
    subtitle: 'Balayage & Highlights',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80',
    price: 'From AED 299',
    link: '/category/hair',
  },
  {
    id: '4',
    title: 'Bridal Makeup',
    subtitle: 'Your perfect day',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80',
    price: 'From AED 599',
    link: '/category/makeup',
  },
];

const CategorySpotlight: React.FC<CategorySpotlightProps> = ({ categorySlug, title }) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-16 px-4 bg-white relative overflow-hidden">
      {/* Decorative blur */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-nilin-blush/30 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-nilin-peach/40 blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm text-nilin-charcoal">NILIN Certified</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif text-nilin-charcoal mb-2">
              {title || 'Beauty Studio'}
            </h2>
            <p className="text-nilin-warmGray">By NILIN Certified Artists</p>
          </div>

          <div className="hidden md:flex gap-3">
            <button
              onClick={() => scroll('left')}
              className="glass w-12 h-12 rounded-full flex items-center justify-center hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('right')}
              className="glass w-12 h-12 rounded-full flex items-center justify-center hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5 text-nilin-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Cards Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {SERVICES.map((service) => (
            <button
              key={service.id}
              onClick={() => navigate(service.link)}
              className="flex-shrink-0 group"
            >
              <div className="relative w-[260px] md:w-[300px] rounded-3xl overflow-hidden shadow-lg card-3d">
                {/* Image */}
                <div className="aspect-[3/4] relative">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* Verified Badge */}
                  <div className="absolute top-4 left-4">
                    <span className="glass rounded-full px-3 py-1.5 text-xs font-medium text-nilin-charcoal flex items-center gap-1 backdrop-blur-md">
                      <Sparkles className="w-3 h-3 text-nilin-coral" />
                      Verified
                    </span>
                  </div>

                  {/* Price */}
                  <div className="absolute top-4 right-4">
                    <span className="glass rounded-full px-3 py-1.5 text-xs font-semibold text-nilin-charcoal backdrop-blur-md">
                      {service.price}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-left">
                    <h3 className="text-xl font-medium text-white mb-1">{service.title}</h3>
                    <p className="text-sm text-white/80 mb-4">{service.subtitle}</p>

                    <div className="flex items-center gap-2 text-white/0 group-hover:text-white transition-all duration-300">
                      <span className="text-sm font-medium">Book Now</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Mobile View All */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/search')}
            className="btn-3d inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-nilin-rose to-nilin-coral text-white"
          >
            View All Services
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default CategorySpotlight;
