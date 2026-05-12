import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

const SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop',
    title: 'Beauty at Your Doorstep',
    subtitle: 'Premium services from verified professionals',
    cta: 'Book Now',
    ctaLink: '/search',
  },
  {
    image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1400&q=80&fit=crop',
    title: 'Bridal & Special Occasions',
    subtitle: 'Look stunning for every moment',
    cta: 'Explore',
    ctaLink: '/category/makeup',
  },
  {
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1400&q=80&fit=crop',
    title: 'Relax & Rejuvenate',
    subtitle: 'Premium spa treatments at home',
    cta: 'View Services',
    ctaLink: '/category/massage-body',
  },
];

const QUICK_PICKS = [
  { label: 'Hair Styling', link: '/service/hair/haircut-styling' },
  { label: 'Bridal Makeup', link: '/service/makeup/bridal-makeup' },
  { label: 'Spa Massage', link: '/service/massage-body/swedish-massage' },
  { label: 'Nail Art', link: '/service/nails/gel-nails' },
];

const HeroCarousel: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative h-[400px] md:h-[500px] overflow-hidden">
      {SLIDES.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-nilin-charcoal/80 via-nilin-charcoal/40 to-transparent" />
        </div>
      ))}

      <div className="absolute inset-0 flex items-end pb-8 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm text-nilin-charcoal">NILIN Premium</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif text-white mb-3">
              {SLIDES[currentSlide].title}
            </h2>
            <p className="text-lg text-white/80 mb-6">{SLIDES[currentSlide].subtitle}</p>
            <button
              onClick={() => navigate(SLIDES[currentSlide].ctaLink)}
              className="btn-3d px-6 py-3 rounded-full text-white bg-gradient-to-r from-nilin-rose to-nilin-coral"
            >
              {SLIDES[currentSlide].cta}
            </button>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {QUICK_PICKS.map((pick, i) => (
              <button
                key={i}
                onClick={() => navigate(pick.link)}
                className="glass-btn px-4 py-2 rounded-full text-sm text-nilin-charcoal"
              >
                {pick.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentSlide ? 'w-8 bg-nilin-coral' : 'w-2 bg-white/50'
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroCarousel;
