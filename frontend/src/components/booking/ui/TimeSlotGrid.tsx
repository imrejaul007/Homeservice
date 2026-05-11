import React from 'react';
import { Check, Loader2 } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-nilin-primary animate-spin" />
        <p className="text-gray-500 mt-3 text-sm">Loading available times...</p>
      </div>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No available time slots for this date.</p>
        <p className="text-gray-400 text-sm mt-1">Please select a different date.</p>
      </div>
    );
  }

  const availableSlots = slots.filter(slot => slot.isAvailable);

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">All time slots are booked for this date.</p>
        <p className="text-gray-400 text-sm mt-1">Please select a different date.</p>
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
            className={`
              relative py-3 px-2 rounded-xl text-sm font-medium transition-all
              ${isSelected
                ? 'bg-nilin-primary text-white shadow-md'
                : isDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-nilin-primary hover:bg-nilin-primary/5'
              }
            `}
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
