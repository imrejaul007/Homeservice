import React from 'react';
import { Check, Loader2, Clock } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface TimeSlot {
  time: string;
  isAvailable: boolean;
}

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedTime: string;
  onTimeSelect: (time: string) => void;
  isLoading?: boolean;
}

const TimeSlotGrid: React.FC<TimeSlotGridProps> = ({
  slots,
  selectedTime,
  onTimeSelect,
  isLoading = false
}) => {
  // Convert 24-hour time to 12-hour format with AM/PM
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  if (isLoading) {
    return (
      <div
        className="bg-white border-2 border-nilin-border/50 rounded-xl flex flex-col items-center justify-center py-12 transition-all duration-300"
        aria-busy="true"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" aria-hidden="true" />
        <p className="text-nilin-warmGray mt-3 text-sm font-medium">Loading available times...</p>
        <span className="sr-only">Loading time slots, please wait</span>
      </div>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <div className="bg-white border-2 border-nilin-border/50 text-center py-8 rounded-xl transition-all duration-300">
        <Clock className="w-10 h-10 text-nilin-warmGray mx-auto mb-2" />
        <p className="text-nilin-charcoal font-medium">No available time slots</p>
        <p className="text-nilin-warmGray text-sm mt-1">Please select a different date.</p>
      </div>
    );
  }

  const availableSlots = slots.filter(slot => slot.isAvailable);

  if (availableSlots.length === 0) {
    return (
      <div className="bg-white border-2 border-nilin-border/50 text-center py-8 rounded-xl transition-all duration-300">
        <Clock className="w-10 h-10 text-nilin-warmGray mx-auto mb-2" />
        <p className="text-nilin-charcoal font-medium">All time slots are booked</p>
        <p className="text-nilin-warmGray text-sm mt-1">Please select a different date.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {slots.map((slot) => {
        const isSelected = selectedTime === slot.time;
        const isDisabled = !slot.isAvailable;

        return (
          <button
            key={slot.time}
            onClick={() => !isDisabled && onTimeSelect(slot.time)}
            disabled={isDisabled}
            className={cn(
              "relative flex flex-col items-center justify-center py-3 px-2 rounded-xl text-sm font-semibold transition-all duration-200 min-h-[56px]",
              isSelected
                ? 'bg-gradient-to-br from-nilin-coral to-nilin-rose text-white shadow-lg ring-2 ring-nilin-coral/30'
                : isDisabled
                  ? 'bg-gray-100 text-nilin-lightGray cursor-not-allowed border border-gray-200'
                  : 'bg-white border-2 border-nilin-border/50 text-nilin-charcoal hover:border-nilin-coral hover:shadow-md'
            )}
          >
            <span className={cn(
              "text-base",
              isSelected ? 'text-white' : isDisabled ? 'text-nilin-lightGray' : 'text-nilin-charcoal'
            )}>
              {formatTime(slot.time)}
            </span>
            {isSelected && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                <Check className="w-3 h-3 text-nilin-coral" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TimeSlotGrid;
