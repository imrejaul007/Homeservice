import React from 'react';
import { Calendar, Clock, MapPin, Briefcase } from 'lucide-react';

interface BookingSummaryCardProps {
  serviceName: string;
  date: string;
  time: string;
  duration: number;
  locationType: 'at_home' | 'hotel';
  price: number;
  currency?: string;
}

const BookingSummaryCard: React.FC<BookingSummaryCardProps> = ({
  serviceName,
  date,
  time,
  duration,
  locationType,
  price,
  currency = 'AED'
}) => {
  // Format date to display
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (d.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Format time to 12-hour
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Calculate end time
  const getEndTime = (startTime: string, durationMin: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + durationMin;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    return formatTime(`${endHours}:${endMins.toString().padStart(2, '0')}`);
  };

  const formatPrice = (amount: number) => {
    if (currency === 'AED') {
      return `AED ${amount.toLocaleString('en-AE')}`;
    }
    return `$${amount.toLocaleString('en-US')}`;
  };

  const locationLabel = locationType === 'at_home' ? 'Home' : 'Hotel';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Service Info */}
      <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 bg-nilin-primary/10 rounded-lg flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-nilin-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">{serviceName}</h3>
          <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(date)}, {formatTime(time)} - {getEndTime(time, duration)}</span>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 py-3 border-b border-gray-100">
        <MapPin className="w-4 h-4 text-gray-400" />
        <span className="text-gray-700">{locationLabel}</span>
        <span className="ml-auto px-2 py-0.5 bg-nilin-primary/10 text-nilin-primary text-xs rounded-full">
          Scheduled
        </span>
      </div>

      {/* Price */}
      <div className="pt-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total service price:</span>
          <span className="text-lg font-bold text-gray-800">{formatPrice(price)}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          No charges will be made now. Payment is processed only after the service is completed.
        </p>
      </div>
    </div>
  );
};

export default BookingSummaryCard;
