import React, { useMemo } from 'react';
import { Calendar, CheckCircle, Clock, Star, AlertCircle, XCircle, MessageSquare, CreditCard } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';

// =============================================================================
// NILIN Customer Dashboard - Booking Timeline Component
// Visual timeline for booking history
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface BookingTimelineEvent {
  id: string;
  type: 'created' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled' | 'reviewed' | 'payment';
  title: string;
  description?: string;
  timestamp: Date;
  metadata?: {
    providerName?: string;
    serviceName?: string;
    amount?: number;
    rating?: number;
    message?: string;
    oldDate?: Date;
    newDate?: Date;
  };
}

export interface BookingTimelineProps {
  /** Timeline events */
  events: BookingTimelineEvent[];
  /** Current status */
  currentStatus: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  /** Show detailed information */
  showDetails?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface EventIconProps {
  type: BookingTimelineEvent['type'];
  completed: boolean;
  current: boolean;
}

const EventIcon: React.FC<EventIconProps> = ({ type, completed, current }) => {
  const baseClasses = 'w-8 h-8 rounded-full flex items-center justify-center';

  if (completed) {
    return (
      <div className={cn(baseClasses, 'bg-green-100 text-green-600')}>
        <CheckCircle className="h-5 w-5" />
      </div>
    );
  }

  if (current) {
    return (
      <div className={cn(baseClasses, 'bg-nilin-coral text-white ring-4 ring-nilin-coral/20')}>
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
      </div>
    );
  }

  // Pending/Future states
  const iconMap: Record<string, React.ReactNode> = {
    created: <Calendar className="h-4 w-4" />,
    confirmed: <CheckCircle className="h-4 w-4" />,
    in_progress: <Clock className="h-4 w-4" />,
    completed: <CheckCircle className="h-4 w-4" />,
    cancelled: <XCircle className="h-4 w-4" />,
    rescheduled: <Calendar className="h-4 w-4" />,
    reviewed: <Star className="h-4 w-4" />,
    payment: <CreditCard className="h-4 w-4" />,
  };

  return (
    <div className={cn(baseClasses, 'bg-gray-100 text-gray-400')}>
      {iconMap[type]}
    </div>
  );
};

interface TimelineItemProps {
  event: BookingTimelineEvent;
  isFirst: boolean;
  isLast: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  showDetails?: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  event,
  isFirst,
  isLast,
  isCompleted,
  isCurrent,
  showDetails = true,
}) => {
  const getEventTitle = (): string => {
    switch (event.type) {
      case 'created':
        return 'Booking Created';
      case 'confirmed':
        return 'Booking Confirmed';
      case 'in_progress':
        return 'Service In Progress';
      case 'completed':
        return 'Service Completed';
      case 'cancelled':
        return 'Booking Cancelled';
      case 'rescheduled':
        return 'Booking Rescheduled';
      case 'reviewed':
        return 'Review Submitted';
      case 'payment':
        return 'Payment Processed';
      default:
        return event.title;
    }
  };

  const getEventColor = (): string => {
    if (isCompleted) return 'text-green-600';
    if (isCurrent) return 'text-nilin-coral';
    if (event.type === 'cancelled') return 'text-red-500';
    return 'text-gray-400';
  };

  return (
    <div className="relative">
      {/* Connector Lines */}
      {!isFirst && (
        <div
          className={cn(
            'absolute left-4 top-0 w-0.5 h-4',
            isCompleted || isCurrent ? 'bg-green-400' : 'bg-gray-200'
          )}
        />
      )}
      {!isLast && (
        <div
          className={cn(
            'absolute left-4 top-10 w-0.5 bottom-0',
            isCompleted ? 'bg-green-400' : 'bg-gray-200'
          )}
        />
      )}

      {/* Content */}
      <div className="relative flex items-start gap-4 pb-8 last:pb-0">
        {/* Icon */}
        <EventIcon type={event.type} completed={isCompleted} current={isCurrent} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className={cn(
                'font-medium',
                getEventColor(),
                !isCompleted && !isCurrent && 'text-gray-500'
              )}>
                {getEventTitle()}
              </h4>

              {showDetails && event.description && (
                <p className="text-sm text-nilin-warmGray mt-0.5">
                  {event.description}
                </p>
              )}

              {/* Metadata */}
              {showDetails && event.metadata && (
                <div className="mt-2 space-y-1">
                  {event.metadata.providerName && (
                    <p className="text-xs text-nilin-warmGray">
                      Provider: {event.metadata.providerName}
                    </p>
                  )}
                  {event.metadata.serviceName && (
                    <p className="text-xs text-nilin-warmGray">
                      Service: {event.metadata.serviceName}
                    </p>
                  )}
                  {event.metadata.amount && (
                    <p className="text-xs text-nilin-warmGray">
                      Amount: {event.metadata.amount.toLocaleString()} AED
                    </p>
                  )}
                  {event.metadata.rating && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            'h-3 w-3',
                            star <= event.metadata!.rating!
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-300'
                          )}
                        />
                      ))}
                    </div>
                  )}
                  {event.metadata.message && (
                    <div className="flex items-start gap-2 mt-1 p-2 bg-nilin-blush/20 rounded-lg">
                      <MessageSquare className="h-3 w-3 text-nilin-warmGray flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-nilin-charcoal">
                        "{event.metadata.message}"
                      </p>
                    </div>
                  )}
                  {event.type === 'rescheduled' && event.metadata.oldDate && event.metadata.newDate && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-500 line-through">
                        {event.metadata.oldDate.toLocaleDateString('en-AE', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-600">
                        {event.metadata.newDate.toLocaleDateString('en-AE', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timestamp */}
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-medium text-nilin-charcoal">
                {event.timestamp.toLocaleTimeString('en-AE', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              <p className="text-xs text-nilin-warmGray">
                {event.timestamp.toLocaleDateString('en-AE', {
                  day: 'numeric',
                  month: 'short'
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Default Booking Timeline
// =============================================================================

export const getDefaultBookingTimeline = (
  bookingId: string,
  serviceName: string,
  providerName: string,
  createdAt: Date
): BookingTimelineEvent[] => {
  const now = new Date();
  const scheduledDate = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  return [
    {
      id: `${bookingId}-created`,
      type: 'created',
      title: 'Booking Created',
      description: `Booking request for ${serviceName}`,
      timestamp: createdAt,
      metadata: {
        serviceName,
        providerName,
      },
    },
    {
      id: `${bookingId}-payment`,
      type: 'payment',
      title: 'Payment Processed',
      description: 'Payment was successfully processed',
      timestamp: new Date(createdAt.getTime() + 1 * 60 * 1000),
    },
    {
      id: `${bookingId}-confirmed`,
      type: 'confirmed',
      title: 'Booking Confirmed',
      description: `${providerName} confirmed the booking`,
      timestamp: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
      metadata: {
        providerName,
      },
    },
    {
      id: `${bookingId}-scheduled`,
      type: 'in_progress',
      title: 'Scheduled',
      description: `Service scheduled for ${scheduledDate.toLocaleDateString('en-AE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      })}`,
      timestamp: scheduledDate,
    },
  ];
};

// =============================================================================
// Main Component
// =============================================================================

export const BookingTimeline: React.FC<BookingTimelineProps> = ({
  events,
  currentStatus,
  showDetails = true,
  compact = false,
  className,
}) => {
  // Sort events by timestamp
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [events]);

  // Determine completed/current states
  const eventStates = useMemo(() => {
    const statusOrder: Record<string, number> = {
      created: 0,
      payment: 1,
      confirmed: 2,
      in_progress: 3,
      completed: 4,
      reviewed: 5,
    };

    const currentIndex = statusOrder[currentStatus] ?? 0;

    return sortedEvents.map((event, index) => {
      const eventOrder = statusOrder[event.type] ?? 0;
      return {
        ...event,
        isCompleted: eventOrder < currentIndex,
        isCurrent: eventOrder === currentIndex,
      };
    });
  }, [sortedEvents, currentStatus]);

  // Loading State
  if (events.length === 0) {
    return (
      <div className={cn('p-4 bg-white rounded-xl border border-nilin-blush/30', className)}>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  // Compact Mode - Horizontal
  if (compact) {
    return (
      <div className={cn('overflow-x-auto', className)}>
        <div className="flex items-center gap-0 min-w-max p-4">
          {eventStates.map((event, index) => (
            <React.Fragment key={event.id}>
              {/* Event */}
              <div className="flex flex-col items-center px-2">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  event.isCompleted && 'bg-green-100 text-green-600',
                  event.isCurrent && 'bg-nilin-coral text-white',
                  !event.isCompleted && !event.isCurrent && 'bg-gray-100 text-gray-400'
                )}>
                  {event.isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : event.isCurrent ? (
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>
                <span className={cn(
                  'text-xs mt-2 max-w-[80px] text-center',
                  event.isCompleted && 'text-green-600',
                  event.isCurrent && 'text-nilin-coral font-medium',
                  !event.isCompleted && !event.isCurrent && 'text-gray-400'
                )}>
                  {event.type.charAt(0).toUpperCase() + event.type.slice(1).replace('_', ' ')}
                </span>
              </div>

              {/* Connector */}
              {index < eventStates.length - 1 && (
                <div className={cn(
                  'w-8 h-0.5 mx-1',
                  eventStates[index + 1].isCompleted ? 'bg-green-400' : 'bg-gray-200'
                )} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // Full Mode - Vertical
  return (
    <div className={cn('p-4 bg-white rounded-xl border border-nilin-blush/30', className)}>
      <h3 className="font-semibold text-nilin-charcoal mb-4">Booking History</h3>

      <div>
        {eventStates.map((event, index) => (
          <TimelineItem
            key={event.id}
            event={event}
            isFirst={index === 0}
            isLast={index === eventStates.length - 1}
            isCompleted={event.isCompleted}
            isCurrent={event.isCurrent}
            showDetails={showDetails}
          />
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default BookingTimeline;
