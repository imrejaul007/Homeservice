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
  <div className="min-w-[260px] dash-card p-4 animate-pulse">
    <div className="h-4 w-3/4 bg-[var(--dash-surface-raised)] rounded mb-2" />
    <div className="h-3 w-1/2 bg-[var(--dash-surface-raised)] rounded mb-3" />
    <div className="h-8 w-24 bg-[var(--dash-surface-raised)] rounded" />
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
    <div className="mb-[var(--dash-spacing-32)]">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div>
          <h2 className="dash-section-title normal-case font-light tracking-tight">Upcoming</h2>
          <p className="dash-section-subtitle">Your next scheduled appointments</p>
        </div>
        {!loading && bookings.length > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className="dash-btn-ghost flex items-center gap-1 px-3 py-1.5 rounded-[var(--dash-radius-pill)] hover:bg-[var(--dash-surface-raised)]"
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
              className="min-w-[260px] max-w-[300px] snap-start flex-shrink-0 text-left dash-card p-4 hover:bg-[var(--dash-surface-raised)] transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium text-[var(--dash-text)] text-[15px] line-clamp-1">
                  {booking.serviceName}
                </h3>
                <span className="dash-badge text-[10px] py-0.5 flex-shrink-0">
                  {booking.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                </span>
              </div>

              {booking.serviceCategory && (
                <p className="text-[11px] text-[var(--dash-text-muted)] mb-3">{booking.serviceCategory}</p>
              )}

              <div className="flex items-center gap-3 text-[11px] text-[var(--dash-text-muted)] mb-3">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatUpcomingDate(booking.scheduledDate)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {booking.scheduledTime}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t dash-divider">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[var(--dash-accent-wash)] flex items-center justify-center flex-shrink-0">
                    {booking.providerAvatar ? (
                      <img src={booking.providerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-[var(--dash-text)]" />
                    )}
                  </div>
                  <span className="text-[12px] text-[var(--dash-text)] truncate">{booking.providerName}</span>
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
