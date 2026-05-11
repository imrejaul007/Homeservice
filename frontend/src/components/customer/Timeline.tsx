import React from 'react';
import { Check, Clock, AlertCircle, XCircle } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'pending' | 'cancelled';
}

interface TimelineProps {
  events: TimelineEvent[];
}

const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const getIcon = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="h-5 w-5 text-white" />;
      case 'current':
        return <Clock className="h-5 w-5 text-white" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-white" />;
      case 'pending':
      default:
        return <AlertCircle className="h-5 w-5 text-white" />;
    }
  };

  const getStatusConfig = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'completed':
        return {
          dot: 'bg-green-500 border-green-500',
          line: 'bg-green-500',
          title: 'text-gray-900',
          desc: 'text-gray-600',
        };
      case 'current':
        return {
          dot: 'bg-blue-500 border-blue-500 ring-4 ring-blue-100',
          line: 'bg-gray-300',
          title: 'text-gray-900 font-semibold',
          desc: 'text-gray-700',
        };
      case 'cancelled':
        return {
          dot: 'bg-red-500 border-red-500',
          line: 'bg-gray-300',
          title: 'text-gray-500 line-through',
          desc: 'text-gray-400',
        };
      case 'pending':
      default:
        return {
          dot: 'bg-gray-300 border-gray-300',
          line: 'bg-gray-300',
          title: 'text-gray-500',
          desc: 'text-gray-400',
        };
    }
  };

  return (
    <div className="relative">
      {events.map((event, index) => {
        const config = getStatusConfig(event.status);
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="relative pb-8 last:pb-0">
            {/* Connecting Line */}
            {!isLast && (
              <div
                className={`absolute left-4 top-10 w-0.5 h-full ${config.line}`}
                style={{ height: 'calc(100% - 2rem)' }}
              />
            )}

            {/* Event Item */}
            <div className="relative flex items-start gap-4">
              {/* Status Dot with Icon */}
              <div className={`
                relative z-10 flex items-center justify-center
                w-9 h-9 rounded-full border-2
                ${config.dot}
                flex-shrink-0
              `}>
                {getIcon(event.status)}
              </div>

              {/* Event Content */}
              <div className="flex-1 pt-1">
                <h4 className={`text-sm font-medium ${config.title}`}>
                  {event.title}
                </h4>
                {event.description && (
                  <p className={`text-sm mt-1 ${config.desc}`}>
                    {event.description}
                  </p>
                )}
                {event.timestamp && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(event.timestamp).toLocaleString('en-AE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Default timeline for booking flow
export const defaultBookingTimeline: TimelineEvent[] = [
  {
    id: '1',
    title: 'Booking Placed',
    description: 'Your booking request has been received',
    status: 'completed',
  },
  {
    id: '2',
    title: 'Confirmed',
    description: 'Provider confirmed your booking',
    status: 'completed',
  },
  {
    id: '3',
    title: 'Service in Progress',
    description: 'Provider is working on your service',
    status: 'current',
  },
  {
    id: '4',
    title: 'Completed',
    description: 'Service has been completed',
    status: 'pending',
  },
];

export default Timeline;
