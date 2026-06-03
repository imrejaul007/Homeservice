import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface DateCarouselProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  maxDays?: number;
}

const DateCarousel: React.FC<DateCarouselProps> = ({
  selectedDate,
  onDateSelect,
  maxDays = 14
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftButton, setShowLeftButton] = useState(false);
  const [showRightButton, setShowRightButton] = useState(true);

  // Generate dates for the next maxDays days
  const dates = Array.from({ length: maxDays }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  const formatDate = (date: Date, index: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = index === 0 ? 'Today' : days[date.getDay()];
    const dayNumber = date.getDate();
    return { dayName, dayNumber };
  };

  const getDateString = (date: Date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftButton(scrollLeft > 0);
      setShowRightButton(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
      return () => {
        scrollEl.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      };
    }
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 180;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative">
      {/* Scroll Left Button */}
      {showLeftButton && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-md border border-nilin-border/50 transition-all hover:bg-nilin-blush/30"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-nilin-charcoal" />
        </button>
      )}

      {/* Date Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-10 py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {dates.map((date, index) => {
          const { dayName, dayNumber } = formatDate(date, index);
          const dateString = getDateString(date);
          const isSelected = selectedDate === dateString;

          return (
            <button
              key={dateString}
              onClick={() => onDateSelect(dateString)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center justify-center min-w-[64px] h-[72px] rounded-xl transition-all duration-200",
                isSelected
                  ? 'bg-gradient-to-br from-nilin-coral to-nilin-rose text-white shadow-lg ring-2 ring-nilin-coral/30'
                  : 'bg-white border-2 border-nilin-border/50 text-nilin-charcoal hover:border-nilin-coral/50 hover:shadow-md'
              )}
            >
              <span className={cn(
                "text-xs font-medium",
                isSelected ? 'text-white/90' : 'text-nilin-warmGray'
              )}>
                {dayName}
              </span>
              <span className={cn(
                "text-xl font-bold mt-0.5",
                isSelected ? 'text-white' : 'text-nilin-charcoal'
              )}>
                {dayNumber}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      {showRightButton && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-md border border-nilin-border/50 transition-all hover:bg-nilin-blush/30"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-nilin-charcoal" />
        </button>
      )}
    </div>
  );
};

export default DateCarousel;
