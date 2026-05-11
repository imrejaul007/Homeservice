import React, { useRef } from 'react';
import { Play, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Reel {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  likes: string;
  category: string;
  link: string;
}

const REELS: Reel[] = [
  {
    id: '1',
    title: 'Bridal Glow Up',
    subtitle: 'Full bridal transformation',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=600&q=80&fit=crop',
    likes: '12.4K',
    category: 'Makeup',
    link: '/service/makeup/bridal-makeup',
  },
  {
    id: '2',
    title: 'Balayage Magic',
    subtitle: 'Dark to honey blonde',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=600&q=80&fit=crop',
    likes: '8.7K',
    category: 'Hair',
    link: '/service/hair/hair-coloring',
  },
  {
    id: '3',
    title: 'Nail Art Inspo',
    subtitle: 'Chrome & marble designs',
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=600&q=80&fit=crop',
    likes: '15.2K',
    category: 'Nails',
    link: '/service/nails/nail-art',
  },
  {
    id: '4',
    title: 'Glass Skin Facial',
    subtitle: 'Korean skincare routine',
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=600&q=80&fit=crop',
    likes: '9.1K',
    category: 'Skin',
    link: '/service/skin-aesthetics/facial-cleanup',
  },
  {
    id: '5',
    title: 'Deep Tissue Relief',
    subtitle: 'Home spa experience',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=600&q=80&fit=crop',
    likes: '6.3K',
    category: 'Massage',
    link: '/service/massage-body/deep-tissue',
  },
  {
    id: '6',
    title: 'Brow Lamination',
    subtitle: 'Fluffy brows in 30 min',
    image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=600&q=80&fit=crop',
    likes: '11.8K',
    category: 'Personal Care',
    link: '/service/personal-care/eyebrow-shaping',
  },
  {
    id: '7',
    title: 'Gel Extensions',
    subtitle: 'Natural & lasting length',
    image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=400&h=600&q=80&fit=crop',
    likes: '7.5K',
    category: 'Nails',
    link: '/service/nails/nail-extensions',
  },
  {
    id: '8',
    title: 'Party Glam',
    subtitle: 'Red carpet ready look',
    image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&h=600&q=80&fit=crop',
    likes: '13.6K',
    category: 'Makeup',
    link: '/service/makeup/party-makeup',
  },
];

const CuratedReels: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -320 : 320,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="py-8 md:py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 mb-5 md:mb-6">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">Trending on NILIN</h2>
            <p className="text-sm text-gray-500 mt-0.5 hidden md:block">
              See what's popular — transformations, inspo, and real results
            </p>
          </div>
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

        {/* Reels scroll */}
        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {REELS.map((reel) => (
            <div
              key={reel.id}
              onClick={() => navigate(reel.link)}
              className="flex-shrink-0 w-[150px] md:w-[180px] cursor-pointer group"
            >
              {/* Reel card — portrait ratio */}
              <div className="relative h-[220px] md:h-[270px] rounded-2xl overflow-hidden">
                <img
                  src={reel.image}
                  alt={reel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center border border-white/40">
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </div>
                </div>

                {/* Category pill */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white text-[10px] font-semibold rounded-full border border-white/20">
                    {reel.category}
                  </span>
                </div>

                {/* Likes */}
                <div className="absolute top-2.5 right-2.5">
                  <div className="flex items-center gap-1 text-white/90">
                    <Heart className="w-3 h-3 fill-white" />
                    <span className="text-[10px] font-semibold">{reel.likes}</span>
                  </div>
                </div>

                {/* Bottom content */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-white font-bold text-sm leading-tight mb-0.5">
                    {reel.title}
                  </h3>
                  <p className="text-white/70 text-[11px]">
                    {reel.subtitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CuratedReels;
