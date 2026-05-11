import React, { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCategories } from '../../hooks/useCategories';

const CATEGORY_DISPLAY: Record<string, string> = {
  'hair': 'Hair',
  'makeup': 'Makeup',
  'nails': 'Nails',
  'skin-aesthetics': 'Skin & Aesthetics',
  'massage-body': 'Massage & Body',
  'personal-care': 'Personal Care',
};

const CategoryTabs: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories } = useCategories(undefined, true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Determine active category from URL
  const activeSlug = location.pathname.startsWith('/category/')
    ? location.pathname.split('/category/')[1]?.split('/')[0]
    : location.pathname.startsWith('/service/')
      ? location.pathname.split('/service/')[1]?.split('/')[0]
      : null;

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = activeRef.current;
      const scrollLeft = tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [activeSlug]);

  const displayCategories = categories.slice(0, 6);

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto">
        <div
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayCategories.map((cat: any) => {
            const isActive = activeSlug === cat.slug;
            const displayName = CATEGORY_DISPLAY[cat.slug] || cat.name;

            return (
              <button
                key={cat.slug}
                ref={isActive ? activeRef : undefined}
                onClick={() => navigate(`/category/${cat.slug}`)}
                className={`
                  flex-shrink-0 px-4 md:px-6 py-3 text-sm font-medium whitespace-nowrap
                  transition-all duration-200 border-b-2 relative
                  ${isActive
                    ? 'text-nilin-accent border-nilin-accent font-semibold'
                    : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                  }
                `}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CategoryTabs;
