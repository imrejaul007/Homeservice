import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star, CheckCircle, Clock } from 'lucide-react';

// Slide data for the hero slider
const SLIDES = [
  {
    id: 1,
    headline: 'Smart Services',
    subheadline: 'Delivered to Your Door.',
    description: 'Premium Beauty Services at Your Doorstep in Dubai',
    accentColor: 'from-nilin-coral to-nilin-rose',
    bgGradient: 'from-nilin-blush via-nilin-peach to-nilin-cream',
    features: ['Same-day booking', 'Top-rated professionals', 'Premium products'],
  },
  {
    id: 2,
    headline: 'Trusted Experts',
    subheadline: 'At Your Fingertips.',
    description: 'Verified professionals with background checks & quality assurance',
    accentColor: 'from-nilin-rose to-nilin-coral',
    bgGradient: 'from-nilin-cream via-nilin-blush to-nilin-peach',
    features: ['Background verified', '5-star rated', 'Insured & certified'],
  },
  {
    id: 3,
    headline: 'Book in Seconds',
    subheadline: 'Get Service Today.',
    description: 'Flexible scheduling with 24/7 support available',
    accentColor: 'from-nilin-coral to-nilin-rose',
    bgGradient: 'from-nilin-peach via-nilin-cream to-nilin-blush',
    features: ['Instant confirmation', 'Easy rescheduling', 'Secure payments'],
  },
];

// Animated floating badge component
const FloatingBadge: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => (
  <div
    className="absolute glass-nilin rounded-full px-4 py-2 shadow-nilin-warm animate-nilin-float"
    style={{ animationDelay: `${delay}s`, animationDuration: '4s' }}
  >
    {children}
  </div>
);

// Phone mockup content component with enhanced animations
const PhoneMockup: React.FC<{ slideIndex: number }> = ({ slideIndex }) => (
  <div className="relative w-56 h-[420px] bg-white rounded-[2.5rem] shadow-2xl border-[8px] border-gray-900 overflow-hidden transform hover:scale-105 transition-transform duration-500">
    {/* Notch */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-10" />

    {/* Screen Content */}
    <div className="h-full pt-8 pb-4 px-3 bg-gradient-to-b from-white to-gray-50 overflow-hidden">
      {/* Status Bar */}
      <div className="flex justify-between items-center mb-3 text-[10px] text-gray-500 px-1">
        <span className="font-medium">9:41</span>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" />
          </svg>
          <div className="w-5 h-2.5 border border-gray-400 rounded-sm relative">
            <div className="absolute inset-0.5 right-1 bg-green-500 rounded-sm" />
            <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-1 bg-gray-400" />
          </div>
        </div>
      </div>

      {/* App Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-lg font-bold bg-gradient-to-r from-nilin-coral to-nilin-rose bg-clip-text text-transparent font-serif">
          Nilin
        </span>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      </div>

      {/* Category Icons Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: '💇', label: 'Hair', bg: 'bg-gradient-to-br from-nilin-coral/30 to-rose-200' },
          { icon: '💅', label: 'Nails', bg: 'bg-gradient-to-br from-nilin-rose/30 to-purple-200' },
          { icon: '💆', label: 'Massage', bg: 'bg-gradient-to-br from-amber-100 to-orange-200' },
          { icon: '💄', label: 'Makeup', bg: 'bg-gradient-to-br from-rose-100 to-pink-200' },
          { icon: '✨', label: 'Facial', bg: 'bg-gradient-to-br from-nilin-cream to-yellow-200' },
          { icon: '👁️', label: 'Eyes', bg: 'bg-gradient-to-br from-green-100 to-emerald-200' },
        ].map((cat, i) => (
          <div
            key={i}
            className="flex flex-col items-center transform hover:scale-110 transition-transform duration-300"
          >
            <div
              className={`w-11 h-11 rounded-xl ${cat.bg} flex items-center justify-center text-lg mb-1 shadow-sm`}
            >
              {cat.icon}
            </div>
            <span className="text-[9px] text-gray-600 font-medium">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* Animated Recent Section */}
      <div className="bg-gradient-to-r from-nilin-coral/20 to-nilin-rose/20 rounded-xl p-2.5 border border-nilin-coral/20 animate-nilin-in">
        <div className="text-[10px] font-semibold text-nilin-coral mb-2">Recent Booking</div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-nilin-coral/30 to-nilin-rose/30 flex items-center justify-center text-base shadow-sm">
            💅
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-gray-900">Beauty Service</div>
            <div className="text-[9px] text-gray-500">Today, 2:00 PM</div>
          </div>
          <div className="w-6 h-6 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <ChevronRight className="w-3 h-3 text-nilin-coral" />
          </div>
        </div>
      </div>

      {/* Bottom Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-gray-300 rounded-full" />
    </div>
  </div>
);

// Parallax hook
const useParallax = (speed: number = 0.5) => {
  const [offset, setOffset] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const scrolled = window.scrollY;
        const elementTop = scrolled + rect.top;
        const viewportHeight = window.innerHeight;

        if (rect.bottom > 0 && rect.top < viewportHeight) {
          const progress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
          setOffset((progress - 0.5) * speed * 80);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return { ref, offset };
};

const HeroSlider: React.FC = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const { ref: parallaxRef, offset } = useParallax(0.2);

  // Auto-advance slides with smooth transition
  useEffect(() => {
    if (!isAutoPlaying || isAnimating) return;

    const timer = setInterval(() => {
      goToSlide((currentSlide + 1) % SLIDES.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [isAutoPlaying, currentSlide, isAnimating]);

  const goToSlide = (index: number) => {
    if (isAnimating || index === currentSlide) return;
    setIsAnimating(true);
    setIsAutoPlaying(false);

    // Smooth transition out
    setTimeout(() => {
      setCurrentSlide(index);
      setContentKey((k) => k + 1);
      // Transition in
      setTimeout(() => {
        setIsAnimating(false);
        setIsAutoPlaying(true);
      }, 50);
    }, 400);
  };

  const nextSlide = () => {
    goToSlide((currentSlide + 1) % SLIDES.length);
  };

  const prevSlide = () => {
    goToSlide((currentSlide - 1 + SLIDES.length) % SLIDES.length);
  };

  const slide = SLIDES[currentSlide];

  return (
    <section
      ref={parallaxRef}
      className="relative overflow-hidden min-h-[600px] md:min-h-[700px]"
    >
      {/* Animated Gradient Background */}
      <div className="absolute inset-0">
        {/* Base gradient layers */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient} transition-all duration-1000 ease-in-out`}
        />

        {/* Warm coral accent orbs */}
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-40 transition-all duration-1000"
          style={{
            background: 'radial-gradient(circle, rgba(232, 180, 168, 0.6) 0%, transparent 70%)',
            transform: `translate(${offset * 0.3}px, ${-offset * 0.2}px)`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl opacity-30 transition-all duration-1000"
          style={{
            background: 'radial-gradient(circle, rgba(212, 168, 154, 0.5) 0%, transparent 70%)',
            transform: `translate(${-offset * 0.2}px, ${offset * 0.3}px)`,
          }}
        />

        {/* Floating decorative elements */}
        <div
          className="absolute top-20 left-20 w-4 h-4 rounded-full bg-nilin-coral/40 animate-nilin-float"
          style={{ animationDuration: '5s' }}
        />
        <div
          className="absolute top-40 right-32 w-3 h-3 rounded-full bg-nilin-rose/50 animate-nilin-float"
          style={{ animationDuration: '4s', animationDelay: '1s' }}
        />
        <div
          className="absolute bottom-32 left-1/4 w-2 h-2 rounded-full bg-nilin-coral/60 animate-nilin-float"
          style={{ animationDuration: '6s', animationDelay: '2s' }}
        />
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left relative z-10">
            {/* Animated headline container */}
            <div
              key={contentKey}
              className={`transition-all duration-700 ease-out ${
                isAnimating
                  ? 'opacity-0 translate-y-8 scale-95'
                  : 'opacity-100 translate-y-0 scale-100'
              }`}
            >
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 glass-nilin rounded-full px-4 py-2 mb-6 animate-nilin-in"
                style={{ animationDelay: '0.1s' }}
              >
                <Star className="w-4 h-4 text-nilin-coral fill-nilin-coral" />
                <span className="text-xs font-medium text-nilin-warm-gray">
                  Dubai's Premium Beauty Service
                </span>
              </div>

              {/* NILIN Typography - Cormorant Garamond for headings */}
              <h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-nilin-charcoal leading-[1.1] tracking-tight mb-4 font-serif"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                }}
              >
                {slide.headline}
                <br />
                <span
                  className={`bg-gradient-to-r ${slide.accentColor} bg-clip-text text-transparent`}
                >
                  {slide.subheadline}
                </span>
              </h1>

              {/* Glass description container */}
              <div className="glass-nilin rounded-2xl px-6 py-4 mb-8 max-w-md mx-auto lg:mx-0 animate-nilin-in" style={{ animationDelay: '0.2s' }}>
                <p className="text-nilin-warm-gray text-base md:text-lg leading-relaxed">
                  {slide.description}
                </p>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start mb-8 animate-nilin-in" style={{ animationDelay: '0.3s' }}>
                {slide.features.map((feature, index) => (
                  <div
                    key={feature}
                    className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4 text-nilin-coral" />
                    <span className="text-sm text-nilin-charcoal font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-nilin-in"
                style={{ animationDelay: '0.4s' }}
              >
                {/* Primary CTA with glass effect */}
                <button
                  onClick={() => navigate('/search')}
                  className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl overflow-hidden shadow-nilin-warm-lg transition-all duration-500 hover:scale-105 hover:shadow-nilin-glow"
                >
                  {/* Animated background */}
                  <span className="absolute inset-0 bg-gradient-to-r from-nilin-coral to-nilin-rose" />
                  <span className="absolute inset-0 bg-gradient-to-r from-nilin-rose to-nilin-coral opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                  <span className="relative z-10 text-white font-medium tracking-wide">
                    Book a Service
                  </span>
                </button>

                {/* Secondary CTA with glass */}
                <button
                  onClick={() => navigate('/register/provider')}
                  className="group glass-nilin-strong inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-medium text-nilin-charcoal hover:bg-white/80 transition-all duration-300 hover:scale-105"
                >
                  <span>Join as Professional</span>
                  <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Content - Phone Mockup with parallax */}
          <div
            className="hidden lg:flex justify-center lg:justify-end relative z-10"
            style={{
              transform: `translateY(${offset * -0.15}px)`,
            }}
          >
            <PhoneMockup slideIndex={currentSlide} />

            {/* Floating badges around phone */}
            <FloatingBadge delay={0}>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-nilin-coral" />
                <span className="text-xs font-medium text-nilin-charcoal">24/7 Support</span>
              </div>
            </FloatingBadge>

            <FloatingBadge delay={1.5}>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-nilin-coral fill-nilin-coral" />
                <span className="text-xs font-medium text-nilin-charcoal">5-Star Rated</span>
              </div>
            </FloatingBadge>

            <FloatingBadge delay={3}>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-nilin-success" />
                <span className="text-xs font-medium text-nilin-charcoal">Verified</span>
              </div>
            </FloatingBadge>
          </div>
        </div>

        {/* Slider Navigation Dots */}
        <div className="flex justify-center gap-3 mt-10 lg:mt-12 relative z-20">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`relative h-2.5 rounded-full transition-all duration-500 ${
                index === currentSlide
                  ? 'w-10 bg-gradient-to-r from-nilin-coral to-nilin-rose shadow-nilin-warm'
                  : 'w-2.5 bg-nilin-rose/30 hover:bg-nilin-rose/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            >
              {/* Active indicator pulse */}
              {index === currentSlide && (
                <span className="absolute inset-0 rounded-full animate-ping opacity-50 bg-nilin-coral" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Arrow Navigation - Glass buttons */}
      <button
        onClick={prevSlide}
        className="hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 p-3 rounded-full glass-nilin-strong hover:bg-white/90 shadow-nilin transition-all duration-300 hover:scale-110 z-20 group"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6 text-nilin-charcoal transition-transform duration-300 group-hover:-translate-x-1" />
      </button>
      <button
        onClick={nextSlide}
        className="hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 p-3 rounded-full glass-nilin-strong hover:bg-white/90 shadow-nilin transition-all duration-300 hover:scale-110 z-20 group"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6 text-nilin-charcoal transition-transform duration-300 group-hover:translate-x-1" />
      </button>

      {/* Progress indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-nilin-rose/10">
        <div
          key={`progress-${currentSlide}`}
          className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose"
          style={{
            animation: 'progress 6s linear forwards',
          }}
        />
      </div>

      {/* Custom styles for animations */}
      <style>{`
        @keyframes nilin-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-nilin-in {
          animation: nilin-in 0.6s ease-out forwards;
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
};

export default HeroSlider;
