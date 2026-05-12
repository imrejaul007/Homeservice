import React, { useRef } from 'react';
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

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative">
      {/* Scroll Left Button */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 glass w-8 h-8 rounded-full flex items-center justify-center shadow-nilin transition-all hover:bg-nilin-blush/30 float-3d"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-5 h-5 text-nilin-warmGray" />
      </button>

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
                "flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl transition-all card-3d",
                isSelected
                  ? 'bg-gradient-to-br from-nilin-rose to-nilin-coral text-white shadow-nilin-warm shimmer'
                  : 'glass text-nilin-charcoal hover:bg-nilin-blush/30 border border-nilin-border/30 hover:border-glow'
              )}
            >
              <span className={cn(
                "text-xs font-medium",
                isSelected ? 'text-white/90' : 'text-nilin-warmGray'
              )}>
                {dayName}
              </span>
              <span className={cn(
                "text-xl font-semibold mt-1",
                isSelected ? 'text-white' : 'text-nilin-charcoal'
              )}>
                {dayNumber}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 glass w-8 h-8 rounded-full flex items-center justify-center shadow-nilin transition-all hover:bg-nilin-blush/30 float-3d"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-5 h-5 text-nilin-warmGray" />
      </button>
    </div>
  );
};

export default DateCarousel;
