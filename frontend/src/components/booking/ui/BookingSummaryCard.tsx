import React from 'react';
import { Calendar, Clock, MapPin, Briefcase } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface BookingSummaryCardProps {
  serviceName: string;
  date: string;
  time: string;
  duration: number;
  locationType: 'at_home' | 'hotel';
  price: number;
  currency?: string;
  discountAmount?: number;
  discountCode?: string;
}

const BookingSummaryCard: React.FC<BookingSummaryCardProps> = ({
  serviceName,
  date,
  time,
  duration,
  locationType,
  price,
  currency = 'AED',
  discountAmount,
  discountCode,
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
    <div className="card-nilin rounded-2xl p-4 transition-all duration-300 hover:shadow-nilin-warm">
      {/* Service Info */}
      <div className="flex items-start gap-3 pb-4 border-b border-nilin-border/30">
        <div className="w-12 h-12 bg-gradient-to-br from-nilin-blush/40 to-nilin-peach/30 rounded-xl flex items-center justify-center shadow-nilin-warm transition-all duration-300">
          <Briefcase className="w-5 h-5 text-nilin-rose" />
        </div>
        <div>
          <h3 className="font-semibold text-nilin-charcoal">{serviceName}</h3>
          <div className="flex items-center gap-1 mt-1 text-sm text-nilin-warmGray">
            <Calendar className="w-3.5 h-3.5 text-nilin-rose" />
            <span>{formatDate(date)}, {formatTime(time)} - {getEndTime(time, duration)}</span>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 py-3 border-b border-nilin-border/30">
        <MapPin className="w-4 h-4 text-nilin-rose" />
        <span className="text-nilin-charcoal">{locationLabel}</span>
        <span className="ml-auto px-2 py-0.5 bg-gradient-to-r from-nilin-blush/40 to-nilin-peach/30 text-nilin-coral text-xs rounded-full card-nilin transition-all duration-300">
          Scheduled
        </span>
      </div>

      {/* Price */}
      <div className="pt-3">
        {discountAmount && discountAmount > 0 ? (
          <>
            <div className="flex justify-between items-center">
              <span className="text-nilin-warmGray">Original price:</span>
              <span className="text-sm text-nilin-warmGray line-through">{formatPrice(price)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-nilin-warmGray">Discount:</span>
              <span className="text-sm text-green-600 font-medium">-{formatPrice(discountAmount)}</span>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-nilin-border">
              <span className="text-nilin-charcoal font-medium">Final price:</span>
              <span className="text-lg font-bold text-nilin-coral">{formatPrice(Math.max(0, price - discountAmount))}</span>
            </div>
            {discountCode && (
              <p className="text-xs text-green-600 mt-1">Code: {discountCode} applied</p>
            )}
          </>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-nilin-warmGray">Total service price:</span>
            <span className="text-lg font-bold text-nilin-coral">{formatPrice(price)}</span>
          </div>
        )}
        <p className="text-xs text-nilin-lightGray mt-2 card-nilin p-2 rounded-lg transition-all duration-300">
          No charges will be made now. Payment is processed only after the service is completed.
        </p>
      </div>
    </div>
  );
};

export default BookingSummaryCard;
