import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';

const SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop',
    title: 'Beauty services at your doorstep',
    subtitle: 'Professional stylists & therapists, verified and rated',
    cta: 'Book Now',
    ctaLink: '/search',
  },
  {
    image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1400&q=80&fit=crop',
    title: 'Bridal & Event Packages',
    subtitle: 'Look stunning on your special day with expert artists',
    cta: 'Explore',
    ctaLink: '/category/makeup',
  },
  {
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1400&q=80&fit=crop',
    title: 'Relax & Rejuvenate at Home',
    subtitle: 'Premium massage & spa treatments in your comfort zone',
    cta: 'Book a Massage',
    ctaLink: '/category/massage-body',
  },
];

const QUICK_PICKS = [
  { label: 'Bridal Makeup', link: '/service/makeup/bridal-makeup' },
  { label: 'Swedish Massage', link: '/service/massage-body/swedish-massage' },
  { label: 'Gel Nails', link: '/service/nails/gel-nails' },
  { label: 'Hair Styling', link: '/service/hair/haircut-styling' },
];

const HeroCarousel: React.FC = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <section className="relative min-h-[400px] md:min-h-[480px] overflow-hidden">
      {/* Slides */}
      {SLIDES.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
        </div>
      ))}

      {/* Content overlay */}
      <div className="relative z-20 flex flex-col justify-center h-full min-h-[400px] md:min-h-[480px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-xl">
            {/* Slide text */}
            {SLIDES.map((slide, index) => (
              <div
                key={index}
                className={`transition-all duration-500 ${
                  index === currentSlide
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 absolute'
                }`}
              >
                {index === currentSlide && (
                  <>
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 leading-tight">
                      {slide.title}
                    </h1>
                    <p className="text-base md:text-lg text-white/80 mb-6">
                      {slide.subtitle}
                    </p>
                  </>
                )}
              </div>
            ))}

            {/* Search bar */}
            <form onSubmit={handleSearch} className="mb-5">
              <div className="relative max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for a service..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white rounded-full text-sm text-gray-900 placeholder-gray-400 shadow-xl focus:outline-none focus:ring-2 focus:ring-nilin-primary/30"
                />
              </div>
            </form>

            {/* Quick-pick chips */}
            <div className="flex flex-wrap gap-2">
              {QUICK_PICKS.map((pick) => (
                <button
                  key={pick.label}
                  onClick={() => navigate(pick.link)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-sm rounded-full hover:bg-white/30 transition-colors border border-white/20"
                >
                  {pick.label}
                  <ChevronRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'w-8 bg-white'
                : 'w-2 bg-white/50 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroCarousel;
