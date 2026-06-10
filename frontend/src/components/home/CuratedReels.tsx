import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ArrowRight, Sparkles } from 'lucide-react';

const TRENDING = [
  {
    id: '1',
    title: 'Bridal Glam',
    subtitle: 'Flawless bridal look',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&q=80',
    likes: '12.8K',
    category: 'Makeup',
    link: '/category/makeup',
  },
  {
    id: '2',
    title: 'Balayage',
    subtitle: 'Sun-kissed highlights',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
    likes: '8.7K',
    category: 'Hair',
    link: '/category/hair',
  },
  {
    id: '3',
    title: 'Chrome Nails',
    subtitle: 'Metallic perfection',
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80',
    likes: '15.2K',
    category: 'Nails',
    link: '/category/nails',
  },
  {
    id: '4',
    title: 'Glass Skin',
    subtitle: 'Korean beauty glow',
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80',
    likes: '9.1K',
    category: 'Skincare',
    link: '/category/skin-aesthetics',
  },
  {
    id: '5',
    title: 'Deep Tissue',
    subtitle: 'Ultimate relaxation',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
    likes: '6.3K',
    category: 'Massage',
    link: '/category/massage-body',
  },
  {
    id: '6',
    title: 'Brow Art',
    subtitle: 'Fluffy perfect brows',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80',
    likes: '11.8K',
    category: 'Brows',
    link: '/category/personal-care',
  },
];

const CuratedReels: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft >= scrollWidth - clientWidth - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: 320, behavior: 'smooth' });
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-16 px-4 bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream relative overflow-hidden">
      {/* Decorative blur */}
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-nilin-coral/20 blur-3xl" />
      <div className="absolute bottom-10 right-10 w-56 h-56 rounded-full bg-nilin-rose/20 blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm text-nilin-charcoal">@NILIN.trending</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif text-nilin-charcoal mb-2">
              Trending Now
            </h2>
            <p className="text-nilin-warmGray">Real results, real transformations</p>
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

        {/* Auto-scrolling Cards */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {TRENDING.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.link)}
              className="flex-shrink-0 group"
            >
              {/* Large Card */}
              <div className="relative w-[280px] md:w-[320px] aspect-[4/5] rounded-3xl overflow-hidden shadow-xl card-3d">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Category Badge */}
                <div className="absolute top-4 left-4">
                  <span className="glass rounded-full px-4 py-2 text-sm font-medium text-nilin-charcoal backdrop-blur-md">
                    {item.category}
                  </span>
                </div>

                {/* Likes */}
                <div className="absolute top-4 right-4">
                  <span className="glass rounded-full px-3 py-2 flex items-center gap-1.5 backdrop-blur-md">
                    <Heart className="w-4 h-4 text-nilin-coral fill-nilin-coral" />
                    <span className="text-sm font-semibold text-nilin-charcoal">{item.likes}</span>
                  </span>
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 text-left">
                  <h3 className="text-xl font-medium text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-white/80 mb-4">{item.subtitle}</p>

                  <div className="flex items-center gap-2 text-white/0 group-hover:text-white transition-all duration-300">
                    <span className="text-sm font-medium">Explore</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Mobile View All */}
        <div className="md:hidden text-center mt-8">
          <button
            onClick={() => navigate('/search')}
            className="btn-3d inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-nilin-rose to-nilin-coral text-white"
          >
            View All
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default CuratedReels;
