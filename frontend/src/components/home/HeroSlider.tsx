import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Slide data for the hero slider
const SLIDES = [
  {
    id: 1,
    headline: 'Smart Services',
    subheadline: 'Delivered to Your Door.',
    description: 'Premium Beauty Services at Your Doorstep in Dubai',
    accentColor: 'from-nilin-primary to-nilin-secondary',
  },
  {
    id: 2,
    headline: 'Trusted Experts',
    subheadline: 'At Your Fingertips.',
    description: 'Verified professionals · Background checked · Quality assured',
    accentColor: 'from-nilin-secondary to-nilin-accent',
  },
  {
    id: 3,
    headline: 'Book in Seconds',
    subheadline: 'Get Service Today.',
    description: 'Same-day booking · Flexible scheduling · 24/7 support',
    accentColor: 'from-nilin-accent to-nilin-primary',
  },
];

// Phone mockup content component
const PhoneMockup: React.FC = () => (
  <div className="relative w-56 h-[420px] bg-white rounded-[2.5rem] shadow-2xl border-[8px] border-gray-900 overflow-hidden">
    {/* Notch */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-10" />

    {/* Screen Content */}
    <div className="h-full pt-8 pb-4 px-3 bg-gradient-to-b from-white to-gray-50 overflow-hidden">
      {/* Status Bar */}
      <div className="flex justify-between items-center mb-3 text-[10px] text-gray-500 px-1">
        <span className="font-medium">9:41</span>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"/>
          </svg>
          <div className="w-5 h-2.5 border border-gray-400 rounded-sm relative">
            <div className="absolute inset-0.5 right-1 bg-green-500 rounded-sm" />
            <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-1 bg-gray-400" />
          </div>
        </div>
      </div>

      {/* App Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-lg font-bold bg-gradient-to-r from-nilin-primary to-nilin-secondary bg-clip-text text-transparent">Nilin</span>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-nilin-pink to-nilin-lavender flex items-center justify-center">
          <svg className="w-4 h-4 text-nilin-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </div>

      {/* Category Icons Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: '💇', label: 'Hair', bg: 'bg-gradient-to-br from-nilin-pink to-pink-200' },
          { icon: '💅', label: 'Nails', bg: 'bg-gradient-to-br from-nilin-lavender to-purple-200' },
          { icon: '💆', label: 'Massage', bg: 'bg-gradient-to-br from-nilin-blue to-blue-200' },
          { icon: '💄', label: 'Makeup', bg: 'bg-gradient-to-br from-rose-100 to-pink-200' },
          { icon: '✨', label: 'Facial', bg: 'bg-gradient-to-br from-nilin-cream to-yellow-200' },
          { icon: '👁️', label: 'Eyes', bg: 'bg-gradient-to-br from-green-100 to-emerald-200' },
        ].map((cat, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className={`w-11 h-11 rounded-xl ${cat.bg} flex items-center justify-center text-lg mb-1 shadow-sm`}>
              {cat.icon}
            </div>
            <span className="text-[9px] text-gray-600 font-medium">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* Recent Section */}
      <div className="bg-gradient-to-r from-nilin-lavender/50 to-nilin-pink/50 rounded-xl p-2.5 border border-purple-100">
        <div className="text-[10px] font-semibold text-nilin-primary mb-2">Recent Booking</div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-nilin-lavender to-purple-200 flex items-center justify-center text-base shadow-sm">
            💅
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-gray-900">Beauty Service</div>
            <div className="text-[9px] text-gray-500">Today, 2:00 PM</div>
          </div>
          <div className="w-6 h-6 rounded-full bg-nilin-primary/10 flex items-center justify-center">
            <ChevronRight className="w-3 h-3 text-nilin-primary" />
          </div>
        </div>
      </div>

      {/* Bottom Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-gray-300 rounded-full" />
    </div>
  </div>
);

const HeroSlider: React.FC = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const slide = SLIDES[currentSlide];

  return (
    <section className="relative overflow-hidden">
      {/* Pastel Stripe Background */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 bg-gradient-to-b from-nilin-pink to-pink-100" />
        <div className="flex-1 bg-gradient-to-b from-nilin-lavender to-purple-100" />
        <div className="flex-1 bg-gradient-to-b from-nilin-cream to-yellow-100" />
        <div className="flex-1 bg-gradient-to-b from-nilin-blue to-blue-100" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-white/30 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-nilin-primary/10 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4 transition-all duration-500">
              {slide.headline}
              <br />
              <span className={`bg-gradient-to-r ${slide.accentColor} bg-clip-text text-transparent`}>
                {slide.subheadline}
              </span>
            </h1>
            <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-8 transition-all duration-500">
              {slide.description}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <button
                onClick={() => navigate('/search')}
                className="px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-nilin-primary to-nilin-secondary text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-nilin-primary/30 transition-all text-sm sm:text-base"
              >
                Book a Service
              </button>
              <button
                onClick={() => navigate('/register/provider')}
                className="px-6 sm:px-8 py-3 sm:py-3.5 bg-white/80 backdrop-blur-sm text-gray-900 border-2 border-gray-200 rounded-xl font-semibold hover:bg-white hover:border-nilin-primary hover:text-nilin-primary transition-all text-sm sm:text-base"
              >
                Join as Professional
              </button>
            </div>
          </div>

          {/* Right Content - Phone Mockup (Desktop Only) */}
          <div className="hidden lg:flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>

        {/* Slider Navigation Dots */}
        <div className="flex justify-center gap-2 mt-6 lg:mt-8">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'bg-gradient-to-r from-nilin-primary to-nilin-secondary w-8'
                  : 'bg-gray-400/50 w-2.5 hover:bg-gray-500'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Arrow Navigation - Desktop Only */}
      <button
        onClick={prevSlide}
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 hover:bg-white shadow-lg hover:shadow-xl transition-all z-10 border border-gray-100"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-5 h-5 text-nilin-primary" />
      </button>
      <button
        onClick={nextSlide}
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 hover:bg-white shadow-lg hover:shadow-xl transition-all z-10 border border-gray-100"
        aria-label="Next slide"
      >
        <ChevronRight className="w-5 h-5 text-nilin-primary" />
      </button>
    </section>
  );
};

export default HeroSlider;
