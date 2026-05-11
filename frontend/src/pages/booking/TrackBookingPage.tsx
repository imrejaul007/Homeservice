import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Package, Clock, Calendar, MapPin, CheckCircle, AlertCircle, Loader2, User } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';

interface TrackingData {
  bookingNumber: string;
  status: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    note?: string;
  }>;
  service: { name: string };
  provider: { name: string };
  scheduledDate: string;
  scheduledTime: string;
  pricing: {
    basePrice?: number;
    tax?: number;
    total?: number;
    totalAmount?: number;
    currency: string;
  };
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const statusColors: Record<string, string> = {
  pending: 'text-yellow-600 bg-yellow-50',
  confirmed: 'text-blue-600 bg-blue-50',
  in_progress: 'text-purple-600 bg-purple-50',
  completed: 'text-green-600 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
  rejected: 'text-red-600 bg-red-50',
};

const TrackBookingPage: React.FC = () => {
  const { bookingNumber: urlBookingNumber } = useParams<{ bookingNumber: string }>();
  const navigate = useNavigate();
  const [bookingNumber, setBookingNumber] = useState(urlBookingNumber || '');
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (urlBookingNumber) {
      fetchTracking(urlBookingNumber);
    }
  }, [urlBookingNumber]);

  const fetchTracking = async (number: string) => {
    try {
      setLoading(true);
      setError(null);
      setTracking(null);

      const response = await fetch(`http://localhost:5000/api/bookings/track/${number}`);
      const data = await response.json();

      if (response.ok) {
        setTracking(data.data);
      } else {
        setError(data.message || 'Booking not found');
      }
    } catch (err) {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingNumber.trim()) {
      navigate(`/track/${bookingNumber.trim()}`);
      fetchTracking(bookingNumber.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavigationHeader />

      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#E8E5FF]/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-700" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Booking</h1>
            <p className="text-gray-600">Enter your booking number to check the status</p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={bookingNumber}
                  onChange={(e) => setBookingNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. RZ-20260212-A1B2"
                  className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-[#E8E5FF] focus:border-[#E8E5FF]"
                />
              </div>
              <button
                type="submit"
                disabled={!bookingNumber.trim() || loading}
                className="px-6 py-3.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Track'}
              </button>
            </div>
          </form>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-8">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
              <p className="text-red-700 font-medium">{error}</p>
              <p className="text-red-500 text-sm mt-1">Please check the booking number and try again.</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Looking up your booking...</p>
            </div>
          )}

          {/* Tracking Results */}
          {tracking && !loading && (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              {/* Status Banner */}
              <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Booking Number</p>
                  <p className="text-lg font-bold text-gray-900">{tracking.bookingNumber}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${statusColors[tracking.status] || 'text-gray-600 bg-gray-100'}`}>
                  {statusLabels[tracking.status] || tracking.status}
                </span>
              </div>

              {/* Booking Details */}
              <div className="p-6 space-y-4">
                <h3 className="font-semibold text-gray-900 text-lg">{tracking.service.name}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 text-gray-700">
                    <Calendar className="w-5 h-5 text-nilin-primary" />
                    <span>{new Date(tracking.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <Clock className="w-5 h-5 text-nilin-primary" />
                    <span>{tracking.scheduledTime}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <User className="w-5 h-5 text-nilin-primary" />
                    <span>Provider: {tracking.provider.name}</span>
                  </div>
                </div>

                {/* Pricing */}
                <div className="border-t pt-4 mt-4">
                  <div className="space-y-2">
                    {tracking.pricing.basePrice != null && (
                      <div className="flex justify-between text-gray-600">
                        <span>Service Fee</span>
                        <span>{tracking.pricing.currency} {tracking.pricing.basePrice.toFixed(2)}</span>
                      </div>
                    )}
                    {tracking.pricing.tax != null && (
                      <div className="flex justify-between text-gray-600">
                        <span>Tax (VAT)</span>
                        <span>{tracking.pricing.currency} {tracking.pricing.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>{tracking.pricing.currency} {(tracking.pricing.total ?? tracking.pricing.totalAmount ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Timeline */}
              {tracking.statusHistory && tracking.statusHistory.length > 0 && (
                <div className="px-6 pb-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Status Timeline</h4>
                  <div className="space-y-4">
                    {tracking.statusHistory.map((entry, index) => (
                      <div key={index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-nilin-primary' : 'bg-gray-300'}`} />
                          {index < tracking.statusHistory.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="pb-4">
                          <p className="font-medium text-gray-900">
                            {statusLabels[entry.status] || entry.status}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(entry.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          {entry.note && (
                            <p className="text-sm text-gray-600 mt-1">{entry.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TrackBookingPage;
