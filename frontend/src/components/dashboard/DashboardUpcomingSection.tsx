import React from 'react';
import { Calendar, Clock, ArrowRight, User } from 'lucide-react';
import type { BookingSummary } from '../../services/customerDashboardApi';
import { PriceDisplay } from '../common/PriceDisplay';

interface DashboardUpcomingSectionProps {
  bookings: BookingSummary[];
  loading?: boolean;
  onViewBooking: (id: string) => void;
  onViewAll: () => void;
}

const formatUpcomingDate = (date: Date | string): string => {
  const d = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const UpcomingCardSkeleton = () => (
  <div className="min-w-[260px] rounded-2xl border border-nilin-border/40 bg-white p-4 animate-pulse">
    <div className="h-4 w-3/4 bg-nilin-border/30 rounded mb-2" />
    <div className="h-3 w-1/2 bg-nilin-border/20 rounded mb-3" />
    <div className="h-8 w-24 bg-nilin-border/25 rounded" />
  </div>
);

const DashboardUpcomingSection: React.FC<DashboardUpcomingSectionProps> = ({
  bookings,
  loading = false,
  onViewBooking,
  onViewAll,
}) => {
  if (!loading && bookings.length === 0) return null;

  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div>
          <h2 className="text-lg md:text-xl font-serif text-nilin-charcoal">Upcoming</h2>
          <p className="text-xs text-nilin-warmGray mt-0.5">Your next scheduled appointments</p>
        </div>
        {!loading && bookings.length > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm font-medium text-nilin-coral hover:text-nilin-rose flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-nilin-coral/5"
          >
            View all <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
        {loading ? (
          <>
            <UpcomingCardSkeleton />
            <UpcomingCardSkeleton />
            <UpcomingCardSkeleton />
          </>
        ) : (
          bookings.map((booking) => (
            <button
              key={booking._id}
              type="button"
              onClick={() => onViewBooking(booking._id)}
              className="min-w-[260px] max-w-[300px] snap-start flex-shrink-0 text-left rounded-2xl border border-nilin-border/40 bg-white p-4 shadow-sm hover:shadow-md hover:border-nilin-coral/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-nilin-charcoal text-[15px] line-clamp-1 group-hover:text-nilin-coral transition-colors">
                  {booking.serviceName}
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-nilin-coral bg-nilin-coral/10 px-2 py-0.5 rounded-full flex-shrink-0">
                  {booking.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                </span>
              </div>

              {booking.serviceCategory && (
                <p className="text-xs text-nilin-warmGray mb-3">{booking.serviceCategory}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-nilin-warmGray mb-3">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatUpcomingDate(booking.scheduledDate)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {booking.scheduledTime}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-nilin-border/30">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-nilin-coral/10 flex items-center justify-center flex-shrink-0">
                    {booking.providerAvatar ? (
                      <img src={booking.providerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-nilin-coral" />
                    )}
                  </div>
                  <span className="text-xs text-nilin-charcoal truncate">{booking.providerName}</span>
                </div>
                <PriceDisplay
                  price={booking.totalAmount || 0}
                  originalCurrency={booking.currency || 'AED'}
                  size="sm"
                  className="text-sm flex-shrink-0"
                />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default DashboardUpcomingSection;
