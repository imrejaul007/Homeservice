import React from 'react';
import { Check, Loader2 } from 'lucide-react';
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
      <div className="card-nilin flex flex-col items-center justify-center py-12 rounded-xl bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20 transition-all duration-300">
        <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
        <p className="text-nilin-warmGray mt-3 text-sm">Loading available times...</p>
      </div>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <div className="card-nilin text-center py-8 rounded-xl transition-all duration-300">
        <p className="text-nilin-warmGray">No available time slots for this date.</p>
        <p className="text-nilin-lightGray text-sm mt-1">Please select a different date.</p>
      </div>
    );
  }

  const availableSlots = slots.filter(slot => slot.isAvailable);

  if (availableSlots.length === 0) {
    return (
      <div className="card-nilin text-center py-8 rounded-xl bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20 transition-all duration-300">
        <p className="text-nilin-warmGray">All time slots are booked for this date.</p>
        <p className="text-nilin-lightGray text-sm mt-1">Please select a different date.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {slots.map((slot) => {
        const isSelected = selectedTime === slot.time;
        const isDisabled = !slot.isAvailable;

        return (
          <button
            key={slot.time}
            onClick={() => !isDisabled && onTimeSelect(slot.time)}
            disabled={isDisabled}
            className={cn(
              "relative py-3 px-2 rounded-xl text-sm font-medium transition-all duration-300",
              isSelected
                ? 'bg-nilin-coral text-white shadow-nilin-warm ring-2 ring-nilin-coral/30'
                : isDisabled
                  ? 'bg-nilin-muted/50 text-nilin-lightGray cursor-not-allowed border-2 border-nilin-border/30'
                  : 'card-nilin border-2 border-nilin-border bg-nilin-blush/30 hover:bg-nilin-peach/50 hover:border-nilin-coral hover:shadow-nilin-warm'
            )
            }
          >
            {formatTime(slot.time)}
            {isSelected && (
              <Check className="absolute top-1 right-1 w-4 h-4 text-white" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TimeSlotGrid;
