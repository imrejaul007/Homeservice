import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useHeroSlides } from '@/hooks/useHeroSlides';

const HeroCarousel: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const { slides } = useHeroSlides();

  useEffect(() => {
    if (slides.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const activeSlide = slides[currentSlide] ?? slides[0];
  if (!activeSlide) return null;

  return (
    <section className="relative h-[360px] sm:h-[400px] md:h-[500px] overflow-hidden">
      {slides.map((slide, index) => (
        <div
          key={`${slide.title}-${index}`}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-nilin-charcoal/80 via-nilin-charcoal/40 to-transparent" />
        </div>
      ))}

      <div className="absolute inset-0 flex items-end pb-6 sm:pb-8 md:pb-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto w-full">
          <div className="max-w-xl min-w-0">
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm text-nilin-charcoal truncate">{activeSlide.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-white mb-3 break-words">
              {activeSlide.title}
            </h2>
            <p className="text-base sm:text-lg text-white/80 mb-6">{activeSlide.subtitle}</p>
            <button
              onClick={() => navigate(activeSlide.ctaLink)}
              className="btn-3d min-h-11 px-6 py-3 rounded-full text-white bg-gradient-to-r from-nilin-rose to-nilin-coral"
            >
              {activeSlide.cta}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;
