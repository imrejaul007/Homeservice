import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronLeft, ChevronRight, Clock, MapPin, Star, Heart, ArrowRight } from 'lucide-react';
import { searchApi } from '../../services/searchApi';
import { useAuthStore } from '../../stores/authStore';
import { favoritesApi } from '../../services/favoritesApi';
import { toast } from 'react-hot-toast';
import type { Service } from '../../types/service';
import { usePriceConversion, formatPrice } from '../../utils/priceConverter';

// -------------------------------------------------
// ------------------ Utilities --------------------
// -------------------------------------------------

const wrap = (n: number, max: number) => (n + max) % max;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Vec2 {
  x: number;
  y: number;
}

const vec2 = (x = 0, y = 0): Vec2 => ({ x, y });

// -------------------------------------------------
// ------------------ RAF Class --------------------
// -------------------------------------------------

type RafCallback = (state: { id: string }) => void;

class RafManager {
  private rafId = 0;
  private callbacks: Array<{ callback: RafCallback; id: string }> = [];
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    this.raf();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private raf = () => {
    this.callbacks.forEach(({ callback, id }) => callback({ id }));
    this.rafId = requestAnimationFrame(this.raf);
  };

  add(callback: RafCallback, id?: string): string {
    const callbackId = id || Math.random().toString(36).substr(2, 9);
    this.callbacks.push({ callback, id: callbackId });
    return callbackId;
  }

  remove(id: string) {
    this.callbacks = this.callbacks.filter((cb) => cb.id !== id);
  }
}

const raf = new RafManager();

// -------------------------------------------------
// ------------------ Category Placeholders --------
// -------------------------------------------------

const CATEGORY_IMAGES: Record<string, string> = {
  hair: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop',
  makeup: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=600&q=80&fit=crop',
  nails: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80&fit=crop',
  skincare: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80&fit=crop',
  skin: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80&fit=crop',
  spa: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80&fit=crop',
  massage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80&fit=crop',
  facial: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80&fit=crop',
  body: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80&fit=crop',
  default: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop',
};

const getCategoryImage = (category: string): string => {
  const cat = category?.toLowerCase() || '';
  for (const [key, image] of Object.entries(CATEGORY_IMAGES)) {
    if (key !== 'default' && cat.includes(key)) return image;
  }
  return CATEGORY_IMAGES.default;
};

// -------------------------------------------------
// ------------------ Types --------------------
// -------------------------------------------------

interface ServiceSlide {
  service: Service;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  price: string;
  rating: number;
  reviewCount: number;
  duration: string;
  location: string;
  providerName: string;
  category: string;
  isFavorite: boolean;
  providerId: string;
}

interface ParallaxServiceSliderProps {
  limit?: number;
}

// -------------------------------------------------
// ------------------ Component --------------------
// -------------------------------------------------

const ParallaxServiceSlider: React.FC<ParallaxServiceSliderProps> = ({ limit = 6 }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { convert, currency, format } = usePriceConversion();
  const [services, setServices] = useState<ServiceSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaderProgress, setLoaderProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [wrapSlideIndex, setWrapSlideIndex] = useState<number | null>(null);
  const [wrapPhase, setWrapPhase] = useState<'to-next' | 'to-previous' | null>(null);

  const slideRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const rafIds = useRef<Set<string>>(new Set());
  const isAnimatingRef = useRef(false);

  const TRANSITION_MS = 850;

  // Apply tilt effect to each slide
  useEffect(() => {
    if (!isLoaded) return;

    rafIds.current.forEach(id => raf.remove(id));
    rafIds.current.clear();

    slideRefs.current.forEach((slideEl) => {
      if (!slideEl) return;

      const slideInner = slideEl.querySelector('.slide__inner') as HTMLElement | null;
      if (!slideInner) return;

      let lerpAmount = 0.06;
      const rotDeg = { current: vec2(), target: vec2() };
      const bgPos = { current: vec2(), target: vec2() };

      const ticker = () => {
        rotDeg.current.x = lerp(rotDeg.current.x, rotDeg.target.x, lerpAmount);
        rotDeg.current.y = lerp(rotDeg.current.y, rotDeg.target.y, lerpAmount);
        bgPos.current.x = lerp(bgPos.current.x, bgPos.target.x, lerpAmount);
        bgPos.current.y = lerp(bgPos.current.y, bgPos.target.y, lerpAmount);

        slideInner.style.setProperty('--rotX', rotDeg.current.y.toFixed(2) + 'deg');
        slideInner.style.setProperty('--rotY', rotDeg.current.x.toFixed(2) + 'deg');
        slideInner.style.setProperty('--bgPosX', bgPos.current.x.toFixed(2) + '%');
        slideInner.style.setProperty('--bgPosY', bgPos.current.y.toFixed(2) + '%');
      };

      const rafId = raf.add(ticker);
      rafIds.current.add(rafId);

      const onMouseMove = (e: MouseEvent) => {
        lerpAmount = 0.1;
        const rect = slideInner.getBoundingClientRect();
        const ox = (e.clientX - rect.left - rect.width * 0.5) / (Math.PI * 3);
        const oy = -(e.clientY - rect.top - rect.height * 0.5) / (Math.PI * 4);
        rotDeg.target.x = ox;
        rotDeg.target.y = oy;
        bgPos.target.x = -ox * 0.3;
        bgPos.target.y = oy * 0.3;
      };

      const onMouseLeave = () => {
        lerpAmount = 0.06;
        rotDeg.target.x = 0;
        rotDeg.target.y = 0;
        bgPos.target.x = 0;
        bgPos.target.y = 0;
      };

      slideEl.addEventListener('mousemove', onMouseMove);
      slideEl.addEventListener('mouseleave', onMouseLeave);

      slideEl._cleanup = () => {
        slideEl.removeEventListener('mousemove', onMouseMove);
        slideEl.removeEventListener('mouseleave', onMouseLeave);
        raf.remove(rafId);
        rafIds.current.delete(rafId);
      };
    });

    raf.start();

    return () => {
      slideRefs.current.forEach(el => el._cleanup?.());
      rafIds.current.forEach(id => raf.remove(id));
      rafIds.current.clear();
    };
  }, [services, isLoaded]);

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await searchApi.searchServices({ limit, sortBy: 'popularity' });
        if (response.success && response.data.services) {
          const mappedServices: ServiceSlide[] = response.data.services.map((service) => {
            const rawPrice =
              (service as any).pricing?.currentPrice ??
              (typeof service.price === 'number' ? service.price : service.price?.amount || 0);
            const rating =
              typeof service.rating === 'number'
                ? service.rating
                : (service.rating?.average || 0);
            const reviewCount =
              service.reviewCount ||
              (typeof service.rating === 'object' ? service.rating?.count : 0) ||
              0;

            const categoryImage = getCategoryImage(service.category || '');
            const serviceImage = service.image || service.images?.[0] || categoryImage;

            return {
              service,
              title: service.title || service.name || 'Service',
              subtitle: service.category || 'Beauty Service',
              description: service.description?.slice(0, 60) + '...' || 'Professional service at your doorstep',
              image: serviceImage,
              price: format(convert(rawPrice, 'USD'), currency),
              rating,
              reviewCount,
              duration: service.duration ? `${service.duration} min` : '60 min',
              location: service.provider?.location || 'Dubai',
              providerName: service.provider?.businessName || (service as any).providerName || 'NILIN Pro',
              category: service.category || 'Service',
              isFavorite: false,
              providerId: service.provider?._id || (service as any).providerId || '',
            };
          });
          setServices(mappedServices);
        }
      } catch (err) {
        console.error('Error fetching services:', err);
        setError('Failed to load services');
      } finally {
        setIsLoading(false);
      }
    };

    fetchServices();
  }, [limit, convert, format, currency]);

  // Image loading
  useEffect(() => {
    if (isLoading || !services.length) return;

    let loadedCount = 0;
    const totalImages = services.length;

    const checkAllLoaded = () => {
      loadedCount++;
      const progress = Math.round((loadedCount / totalImages) * 100);
      setLoaderProgress(progress);

      if (loadedCount >= totalImages) {
        setTimeout(() => setIsLoaded(true), 300);
      }
    };

    services.forEach((slide) => {
      const img = new Image();
      img.onload = checkAllLoaded;
      img.onerror = checkAllLoaded;
      img.src = slide.image;
    });

    const timeout = setTimeout(() => setIsLoaded(true), 3000);
    return () => clearTimeout(timeout);
  }, [isLoading, services]);

  const navigateSlide = useCallback(
    (direction: 1 | -1) => {
      if (services.length === 0 || isAnimatingRef.current) return;

      isAnimatingRef.current = true;

      const currentSlide = document.querySelector('.slide[data-current]') as HTMLElement | null;
      const prevSlide = document.querySelector('.slide[data-previous]') as HTMLElement | null;
      const nextSlide = document.querySelector('.slide[data-next]') as HTMLElement | null;
      const newIndex = wrap(currentIndex + direction, services.length);

      if (direction === 1) {
        const oldPrevIndex = wrap(currentIndex - 1, services.length);
        if (currentSlide) currentSlide.style.zIndex = '30';
        if (prevSlide) prevSlide.style.zIndex = '5';
        if (nextSlide) nextSlide.style.zIndex = '20';

        setWrapSlideIndex(oldPrevIndex);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setWrapPhase('to-next');
            setCurrentIndex(newIndex);
          });
        });
      } else {
        const oldNextIndex = wrap(currentIndex + 1, services.length);
        if (prevSlide) prevSlide.style.zIndex = '20';
        if (currentSlide) currentSlide.style.zIndex = '10';
        if (nextSlide) nextSlide.style.zIndex = '5';

        setWrapSlideIndex(oldNextIndex);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setWrapPhase('to-previous');
            setCurrentIndex(newIndex);
          });
        });
      }

      setTimeout(() => {
        setWrapSlideIndex(null);
        setWrapPhase(null);
        document.querySelectorAll('.slide').forEach((el) => {
          (el as HTMLElement).style.zIndex = '';
        });
        isAnimatingRef.current = false;
      }, TRANSITION_MS);
    },
    [currentIndex, services.length]
  );

  const handleToggleFavorite = async (e: React.MouseEvent, serviceId: string, providerId: string) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/services/${serviceId}` } });
      return;
    }

    try {
      if (favorites.has(serviceId)) {
        await favoritesApi.removeFavorite(providerId);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(serviceId);
          return next;
        });
        toast.success('Removed from favorites');
      } else {
        await favoritesApi.addFavorite(providerId);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.add(serviceId);
          return next;
        });
        toast.success('Added to favorites');
      }
    } catch (err: any) {
      console.error('Failed to toggle favorite:', err);
      toast.error('Failed to update favorites');
    }
  };

  const prevIndex = services.length > 0 ? wrap(currentIndex - 1, services.length) : 0;
  const nextIndex = services.length > 0 ? wrap(currentIndex + 1, services.length) : 0;

  if (!isLoading && services.length === 0) {
    return null;
  }

  const currentService = services[currentIndex];

  return (
    <section className="py-10 px-0 bg-nilin-cream relative overflow-hidden">
      {/* Loader Overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-nilin-cream transition-opacity duration-500">
          <div className="text-center">
            <div className="text-5xl md:text-7xl font-serif font-bold text-nilin-charcoal mb-4">
              {loaderProgress}%
            </div>
            <div className="w-48 h-1 bg-nilin-coral/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-nilin-coral transition-all duration-300 rounded-full"
                style={{ width: `${loaderProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-nilin-coral/30 to-nilin-rose/30 flex items-center justify-center shadow-lg">
              <Sparkles className="w-7 h-7 text-nilin-coral" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-nilin-charcoal mb-1">
                Services For You
              </h2>
              <p className="text-nilin-warmGray">Discover what's trending in your area</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/search')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-nilin-charcoal text-white font-semibold hover:bg-nilin-charcoal/90 transition-all duration-200 shadow-lg group"
          >
            Explore All Services
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nilin-coral"></div>
          </div>
        )}

        {/* Parallax Slider */}
        {!isLoading && services.length > 0 && (
          <div className="relative">
            {/* Background Slides */}
            {services.map((slide, index) => {
              const isCurrent = index === currentIndex;
              const isPrev = index === prevIndex;
              const isNext = index === nextIndex;
              const isVisible = isCurrent || isPrev || isNext;

              if (!isVisible) return null;

              return (
                <div
                  key={`bg-${slide.service._id || index}`}
                  className="slide__bg"
                  data-current={isCurrent ? '' : undefined}
                  data-previous={isPrev ? '' : undefined}
                  data-next={isNext ? '' : undefined}
                  style={{
                    '--bg': `url(${slide.image})`,
                    '--dir': isNext ? 1 : isPrev ? -1 : 0,
                  } as React.CSSProperties}
                />
              );
            })}

            {/* Slider Container */}
            <div className="slider">
              {/* Prev Button */}
              <button
                onClick={() => navigateSlide(-1)}
                className="slider--btn slider--btn__prev absolute left-0 md:left-8 z-20 w-14 h-14 rounded-full bg-white border border-nilin-border/30 flex items-center justify-center hover:shadow-lg hover:border-nilin-coral/50 transition-all duration-200 shadow-nilin"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              {/* Slides Wrapper */}
              <div className="slides__wrapper">
                <div className="slides">
                  {services.map((slide, index) => {
                    const isCurrent = index === currentIndex;
                    const isPrev = index === prevIndex;
                    const isNext = index === nextIndex;
                    const isWrappingToNext =
                      index === wrapSlideIndex && wrapPhase === 'to-next';
                    const isWrappingToPrev =
                      index === wrapSlideIndex && wrapPhase === 'to-previous';
                    const isVisible =
                      isCurrent ||
                      isPrev ||
                      isNext ||
                      isWrappingToNext ||
                      isWrappingToPrev;

                    if (!isVisible) return null;

                    return (
                      <div
                        key={slide.service._id || index}
                        ref={(el) => {
                          if (el) slideRefs.current.set(index, el);
                          else slideRefs.current.delete(index);
                        }}
                        className="slide"
                        data-current={isCurrent ? '' : undefined}
                        data-previous={isPrev ? '' : undefined}
                        data-next={isNext ? '' : undefined}
                        data-wrap-to-next={isWrappingToNext ? '' : undefined}
                        data-wrap-to-previous={isWrappingToPrev ? '' : undefined}
                        onClick={() => {
                          if (isNext) navigateSlide(1);
                          else if (isPrev) navigateSlide(-1);
                          else navigate(`/services/${slide.service._id}`);
                        }}
                      >
                        <div className="slide__inner relative w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-white">
                          <div className="slide--image__wrapper absolute inset-0">
                            <img
                              src={slide.image}
                              alt={slide.title}
                              className="slide--image w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                          </div>

                          <div className="absolute top-4 left-4 right-4 z-30 flex justify-between items-center gap-2">
                            <span className="px-3 py-1 bg-white/95 backdrop-blur-md text-nilin-charcoal text-xs font-semibold rounded-full shadow-lg capitalize">
                              {slide.category}
                            </span>

                            {slide.rating > 0 && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/95 backdrop-blur-md rounded-full shadow-lg">
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                <span className="text-xs font-bold text-nilin-charcoal">
                                  {slide.rating.toFixed(1)}
                                </span>
                                {slide.reviewCount > 0 && (
                                  <span className="text-[10px] text-nilin-warmGray">
                                    ({slide.reviewCount})
                                  </span>
                                )}
                              </div>
                            )}

                            <button
                              onClick={(e) =>
                                handleToggleFavorite(e, slide.service._id || '', slide.providerId)
                              }
                              className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
                                favorites.has(slide.service._id || '')
                                  ? 'bg-red-500 text-white'
                                  : 'bg-white/90 text-gray-600 hover:bg-white hover:text-red-500'
                              }`}
                            >
                              <Heart
                                className={`w-4 h-4 ${favorites.has(slide.service._id || '') ? 'fill-current' : ''}`}
                              />
                            </button>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
                            <h3 className="text-lg font-bold text-white mb-1 line-clamp-1 drop-shadow-lg">
                              {slide.title}
                            </h3>
                            <p className="text-white/80 text-xs mb-3">
                              by {slide.providerName}
                            </p>
                            <div className="flex items-center justify-between text-white/70 text-xs mb-4">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {slide.duration}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {slide.location}
                                </span>
                              </div>
                              <span className="text-lg font-bold bg-gradient-to-r from-nilin-coral to-nilin-rose bg-clip-text text-transparent">
                                {slide.price}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/book/${slide.service._id}`, {
                                  state: { service: slide.service },
                                });
                              }}
                              className="w-full px-4 py-2.5 bg-white text-nilin-charcoal text-sm font-bold rounded-xl hover:bg-nilin-blush transition-all duration-200 shadow-lg"
                            >
                              Book Now
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next Button */}
              <button
                onClick={() => navigateSlide(1)}
                className="slider--btn slider--btn__next absolute right-0 md:right-8 z-20 w-14 h-14 rounded-full bg-white border border-nilin-border/30 flex items-center justify-center hover:shadow-lg hover:border-nilin-coral/50 transition-all duration-200 shadow-nilin"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            {/* Dot Indicators */}
            <div className="flex justify-center gap-2 mt-1">
              {services.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'w-8 bg-nilin-coral'
                      : 'w-2 bg-nilin-charcoal/20 hover:bg-nilin-charcoal/40'
                  }`}
                />
              ))}
            </div>

            {/* Text Info - BELOW the dots */}
            <div className="text-info-section mt-6">
              {currentService && (
                <div className="text-center animate-fade-in">
                  <h3 className="text-2xl md:text-3xl font-serif font-bold text-nilin-charcoal uppercase tracking-wider">
                    {currentService.title.toUpperCase()}
                  </h3>
                  <p className="text-lg text-nilin-warmGray mt-2">
                    {currentService.subtitle}
                  </p>
                  <p className="text-sm text-nilin-lightGray mt-2 max-w-md mx-auto">
                    {currentService.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="text-center py-12">
            <p className="text-nilin-warmGray">{error}</p>
          </div>
        )}
      </div>

      {/* CSS - Matching reference structure */}
      <style>{`
        /* ------------------------------------------------ */
        /* -------------------- SLIDER -------------------- */
        /* ------------------------------------------------ */

        .slider {
          --slide-width: min(30vw, 360px);
          width: calc(3 * var(--slide-width));
          height: calc(var(--slide-width) * 4 / 3 * 1.22);
          margin: 0 auto;
          display: flex;
          align-items: center;
          position: relative;
        }

        .slider--btn {
          --size: 40px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          opacity: 0.7;
          transition: opacity 250ms cubic-bezier(0.215, 0.61, 0.355, 1);
          z-index: 999;
        }

        .slider--btn:hover {
          opacity: 1;
        }

        .slides__wrapper {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
        }

        .slides__wrapper > * {
          grid-area: 1 / -1;
        }

        .slides {
          width: 100%;
          height: 100%;
          pointer-events: none;
          display: grid;
          place-items: center;
          margin: 0;
        }

        .slides > * {
          grid-area: 1 / -1;
        }

        /* ------------------------------------------------ */
        /* -------------------- SLIDE --------------------- */
        /* ------------------------------------------------ */

        .slide {
          --slide-width: min(30vw, 360px);
          --slide-tx: 0px;
          --slide-tz: 0;
          --slide-scale: 1;
          --slide-rotY: 0;
          --slide-transition-duration: 800ms;
          --slide-transition-easing: ease;

          width: var(--slide-width);
          height: auto;
          aspect-ratio: 3 / 4;
          user-select: none;
          perspective: 800px;

          transform: perspective(1000px)
            translate3d(var(--slide-tx), 0, var(--slide-tz))
            rotateY(var(--slide-rotY))
            scale(var(--slide-scale));
          transition: transform var(--slide-transition-duration)
            var(--slide-transition-easing);
        }

        .slide[data-current] {
          --slide-scale: 1.2;
          --slide-tz: 0px;
          --slide-tx: 0px;
          --slide-rotY: 0;
          pointer-events: auto;
          z-index: 20;
        }

        .slide[data-next] {
          --slide-tx: calc(1 * var(--slide-width) * 1.07);
          --slide-rotY: -45deg;
          z-index: 10;
        }

        .slide[data-previous] {
          --slide-tx: calc(-1 * var(--slide-width) * 1.07);
          --slide-rotY: 45deg;
          z-index: 25;
        }

        .slide[data-wrap-to-next] {
          --slide-tx: calc(1 * var(--slide-width) * 1.07);
          --slide-rotY: -45deg;
          --slide-scale: 1;
          z-index: 5;
          pointer-events: none;
        }

        .slide[data-wrap-to-previous] {
          --slide-tx: calc(-1 * var(--slide-width) * 1.07);
          --slide-rotY: 45deg;
          --slide-scale: 1;
          z-index: 5;
          pointer-events: none;
        }

        .slide[data-wrap-to-next] .slide--image,
        .slide[data-wrap-to-previous] .slide--image {
          filter: brightness(0.5);
        }

        .slide:not([data-current]) {
          --slide-scale: 1;
          --slide-tz: 0;
          pointer-events: none;
        }

        .slide[data-current] .slide--image {
          filter: brightness(0.8);
        }

        .slide:not([data-current]) .slide--image {
          filter: brightness(0.5);
        }

        .slide__inner {
          --rotX: 0;
          --rotY: 0;
          --bgPosX: 0%;
          --bgPosY: 0%;

          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transform: rotateX(var(--rotX)) rotateY(var(--rotY));
        }

        .slide--image__wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .slide--image {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 50%;
          left: 50%;
          object-fit: cover;
          transform: translate(-50%, -50%) scale(1.25)
            translate3d(var(--bgPosX), var(--bgPosY), 0);
          transition: filter var(--slide-transition-duration)
            var(--slide-transition-easing);
        }

        /* ------------------------------------------------ */
        /* -------------------- SLIDE BG ------------------- */
        /* ------------------------------------------------ */

        .slide__bg {
          position: fixed;
          inset: -20%;
          background-image: var(--bg);
          background-size: cover;
          background-position: center center;
          z-index: -1;
          pointer-events: none;
          transition: opacity var(--slide-transition-duration) ease,
            transform var(--slide-transition-duration) ease;
        }

        .slide__bg::before {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(253, 251, 249, 0.95);
        }

        .slide__bg:not([data-current]) {
          opacity: 0;
        }

        .slide__bg[data-previous] {
          transform: translateX(-10%);
        }

        .slide__bg[data-next] {
          transform: translateX(10%);
        }

        /* Text Info Section - Below dots */
        .text-info-section {
          text-align: center;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .slider {
            --slide-width: min(68vw, 300px);
            width: 100%;
            height: calc(var(--slide-width) * 4 / 3 * 1.22);
            min-height: unset;
          }

          .slide {
            --slide-width: min(68vw, 300px);
          }
        }
      `}</style>
    </section>
  );
};

declare global {
  interface HTMLElement {
    _cleanup?: () => void;
  }
}

export default ParallaxServiceSlider;