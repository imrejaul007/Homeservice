import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, User, Phone, MoreVertical, Eye, Edit, X } from 'lucide-react';

export interface Booking {
  _id: string;
  service: {
    _id: string;
    title: string;
    category?: string;
  };
  provider: {
    _id: string;
    name: string;
    phone?: string;
  };
  customer?: {
    _id: string;
    name: string;
  };
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  totalPrice: number;
  location?: {
    address?: string;
  };
}

interface BookingCardProps {
  booking: Booking;
  showActions?: boolean;
  onView?: (bookingId: string) => void;
  onReschedule?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  showActions = true,
  onView,
  onReschedule,
  onCancel
}) => {
  const navigate = useNavigate();

  const handleView = () => {
    if (onView) {
      onView(booking._id);
    } else {
      navigate(`/customer/bookings/${booking._id}`);
    }
  };

  const handleReschedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReschedule) {
      onReschedule(booking._id);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCancel) {
      onCancel(booking._id);
    }
  };

  // Status configuration
  const statusConfig = {
    pending: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-200',
      label: 'Pending',
    },
    confirmed: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      label: 'Confirmed',
    },
    in_progress: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-200',
      label: 'In Progress',
    },
    completed: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      label: 'Completed',
    },
    cancelled: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200',
      label: 'Cancelled',
    },
  };

  const status = statusConfig[booking.status];

  return (
    <div
      onClick={handleView}
      className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer group"
    >
      {/* Header with Status */}
      <div className="p-4 border-b border-gray-100 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {booking.service.title}
            </h3>
            {booking.service.category && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {booking.service.category}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">Booking ID: #{booking._id.slice(-8)}</p>
        </div>
        <span className={`${status.bg} ${status.text} ${status.border} border px-3 py-1 rounded-full text-xs font-semibold`}>
          {status.label}
        </span>
      </div>

      {/* Booking Details Grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date & Time */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gradient-nilin-primary rounded-lg">
            <Calendar className="h-5 w-5 text-gray-700" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Date & Time</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(booking.scheduledDate).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-600">{booking.scheduledTime}</p>
          </div>
        </div>

        {/* Provider */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gradient-nilin-secondary rounded-lg">
            <User className="h-5 w-5 text-gray-700" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Provider</p>
            <p className="text-sm font-medium text-gray-900">{booking.provider.name}</p>
            {booking.provider.phone && (
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {booking.provider.phone}
              </p>
            )}
          </div>
        </div>

        {/* Location */}
        {booking.location?.address && (
          <div className="flex items-start gap-3 sm:col-span-2">
            <div className="p-2 bg-gradient-nilin-tertiary rounded-lg">
              <MapPin className="h-5 w-5 text-gray-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Location</p>
              <p className="text-sm text-gray-900">{booking.location.address}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with Price and Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Total Price</p>
          <p className="text-xl font-bold text-gray-900">AED {booking.totalPrice}</p>
        </div>

        {showActions && booking.status !== 'cancelled' && booking.status !== 'completed' && (
          <div className="flex gap-2">
            <button
              onClick={handleView}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-1"
            >
              <Eye className="h-4 w-4" />
              View
            </button>
            {booking.status === 'pending' && onReschedule && (
              <button
                onClick={handleReschedule}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <Edit className="h-4 w-4" />
                Reschedule
              </button>
            )}
            {onCancel && (booking.status === 'pending' || booking.status === 'confirmed') && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingCard;
