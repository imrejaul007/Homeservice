import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';

interface AvailabilitySlot {
  time: string;
  isAvailable: boolean;
}

interface AvailabilityPreviewProps {
  providerId: string;
  serviceId: string;
  duration: number;
  selectedDate: string;
  /** Prefer parent-fetched slots so preview matches the main time grid */
  availabilitySlots?: AvailabilitySlot[];
  isLoadingSlots?: boolean;
  onSlotSelect?: (time: string) => void;
}

const AvailabilityPreview: React.FC<AvailabilityPreviewProps> = ({
  providerId,
  serviceId,
  duration,
  selectedDate,
  availabilitySlots,
  isLoadingSlots = false,
  onSlotSelect
}) => {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usesParentSlots = availabilitySlots !== undefined;

  useEffect(() => {
    if (usesParentSlots) {
      setSlots(availabilitySlots);
      setError(null);
      return;
    }

    const fetchAvailability = async () => {
      if (!providerId || !selectedDate) return;

      setLoading(true);
      setError(null);

      try {
        const response = await api.get(`/availability/provider/${providerId}/slots`, {
          params: {
            date: selectedDate,
            duration,
            serviceId,
            days: 1
          }
        });

        if (response.data.success) {
          const raw = response.data.data?.slots || [];
          const normalized: AvailabilitySlot[] = raw.map((s: string | AvailabilitySlot) =>
            typeof s === 'string' ? { time: s, isAvailable: true } : s
          );
          setSlots(normalized);
        } else {
          setError('Failed to load availability');
        }
      } catch (err: unknown) {
        console.error('Failed to fetch availability:', err);
        const message =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : undefined;
        setError(message || 'Failed to load availability');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [providerId, selectedDate, duration, serviceId, usesParentSlots, availabilitySlots]);

  const showLoading = usesParentSlots ? isLoadingSlots : loading;
  const bookableSlots = slots.filter((s) => s.isAvailable);
  const availableCount = bookableSlots.length;
  const morningSlots = bookableSlots.filter((s) => {
    const hour = parseInt(s.time.split(':')[0], 10);
    return hour < 12;
  });
  const afternoonSlots = bookableSlots.filter((s) => {
    const hour = parseInt(s.time.split(':')[0], 10);
    return hour >= 12 && hour < 18;
  });
  const eveningSlots = bookableSlots.filter((s) => {
    const hour = parseInt(s.time.split(':')[0], 10);
    return hour >= 18;
  });

  if (!selectedDate) {
    return (
      <div className="bg-nilin-cream/50 rounded-xl p-6 text-center">
        <Calendar className="w-8 h-8 text-nilin-warmGray mx-auto mb-2" />
        <p className="text-sm text-nilin-warmGray">Select a date to view availability</p>
      </div>
    );
  }

  if (showLoading) {
    return (
      <div className="bg-nilin-cream/50 rounded-xl p-8 text-center">
        <Loader2 className="w-8 h-8 text-nilin-coral mx-auto mb-2 animate-spin" />
        <p className="text-sm text-nilin-warmGray">Loading availability...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (bookableSlots.length === 0) {
    return (
      <div className="bg-nilin-cream/50 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-nilin-warmGray mx-auto mb-2" />
        <p className="text-sm text-nilin-warmGray">No slots available for this date</p>
        <p className="text-xs text-nilin-warmGray mt-1">Try another date or a shorter service window</p>
      </div>
    );
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  return (
    <div className="bg-white rounded-xl border border-nilin-border p-4">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-nilin-border">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-nilin-charcoal">
            {availableCount} {availableCount === 1 ? 'slot' : 'slots'} available
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-nilin-warmGray">
          <Clock className="w-3 h-3" />
          <span>{duration} min per slot</span>
        </div>
      </div>

      {morningSlots.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wide mb-2">
            Morning
          </h4>
          <div className="flex flex-wrap gap-2">
            {morningSlots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                onClick={() => onSlotSelect?.(slot.time)}
                className="px-3 py-1.5 text-sm bg-nilin-cream hover:bg-nilin-coral hover:text-white rounded-lg transition-colors"
              >
                {formatTime(slot.time)}
              </button>
            ))}
          </div>
        </div>
      )}

      {afternoonSlots.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wide mb-2">
            Afternoon
          </h4>
          <div className="flex flex-wrap gap-2">
            {afternoonSlots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                onClick={() => onSlotSelect?.(slot.time)}
                className="px-3 py-1.5 text-sm bg-nilin-cream hover:bg-nilin-coral hover:text-white rounded-lg transition-colors"
              >
                {formatTime(slot.time)}
              </button>
            ))}
          </div>
        </div>
      )}

      {eveningSlots.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wide mb-2">
            Evening
          </h4>
          <div className="flex flex-wrap gap-2">
            {eveningSlots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                onClick={() => onSlotSelect?.(slot.time)}
                className="px-3 py-1.5 text-sm bg-nilin-cream hover:bg-nilin-coral hover:text-white rounded-lg transition-colors"
              >
                {formatTime(slot.time)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityPreview;
