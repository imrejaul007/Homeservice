import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Building,
  DollarSign,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  Download,
  MessageSquare,
  Ban,
  CalendarClock,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Star,
  MoreVertical,
  Check,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { AdminPagination } from '../../components/admin/AdminPagination';
import type {
  Booking,
  BookingStatus,
  BookingFilters,
  BookingStats,
} from '../../types/booking.types';
import { formatBookingStatus } from '../../types/booking.types';

// ============================================
// Types (extended for admin view)
// ============================================

interface AdminBookingStats {
  total: number;
  pending: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShows: number;
  refunded: number;
  totalRevenue: number;
}

// Extend BookingFilters for admin-specific filters
interface AdminBookingFilters extends Omit<BookingFilters, 'status'> {
  status?: BookingStatus | BookingStatus[] | 'all';
  customerSearch?: string;
  providerSearch?: string;
}

// ============================================
// Helper Functions
// ============================================

const getStatusColor = (status: BookingStatus): string => {
  const colors: Record<BookingStatus, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
    in_progress: 'bg-sky-100 text-sky-700 border-sky-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
    no_show: 'bg-red-100 text-red-700 border-red-200',
    refunded: 'bg-purple-100 text-purple-700 border-purple-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };
  return colors[status] || colors.pending;
};

const getStatusIcon = (status: BookingStatus): React.ReactNode => {
  const icons: Record<BookingStatus, React.ReactNode> = {
    pending: <Clock className="w-3 h-3" />,
    confirmed: <CheckCircle className="w-3 h-3" />,
    in_progress: <CalendarClock className="w-3 h-3" />,
    completed: <Check className="w-3 h-3" />,
    cancelled: <XCircle className="w-3 h-3" />,
    no_show: <AlertTriangle className="w-3 h-3" />,
    refunded: <RotateCcw className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
  };
  return icons[status] || icons.pending;
};

// ============================================
// Status Badge Component
// ============================================

const StatusBadge: React.FC<{ status: BookingStatus }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
    {getStatusIcon(status)}
    {formatBookingStatus(status)}
  </span>
);

// ============================================
// Stats Card Component
// ============================================

const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
  onClick?: () => void;
}> = ({ title, value, icon, iconBg, iconColor, subtitle, onClick }) => (
  <button
    onClick={onClick}
    className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all text-left w-full ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${iconBg}`}>
        <div className={iconColor}>{icon}</div>
      </div>
    </div>
  </button>
);

// ============================================
// Booking Detail Modal
// ============================================

const BookingDetailModal: React.FC<{
  booking: Booking;
  onClose: () => void;
  onRefresh: () => void;
}> = ({ booking, onClose, onRefresh }) => {
  type DetailTab = 'overview' | 'customer' | 'provider' | 'service' | 'history';
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/bookings/${booking._id}/cancel`, { reason: cancelReason });
      toast.success('Booking cancelled successfully');
      setShowCancelModal(false);
      onRefresh();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkNoShow = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/admin/bookings/${booking._id}/status`, { status: 'no_show' });
      toast.success('Booking marked as no-show');
      onRefresh();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to mark as no-show');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessRefund = async () => {
    setActionLoading(true);
    try {
      await api.post('/admin/bookings/batch-refund', {
        bookingIds: [booking._id],
        reason: 'Admin-initiated refund from booking management',
        refundPolicy: 'full',
      });
      toast.success('Refund processed successfully');
      onRefresh();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to process refund');
    } finally {
      setActionLoading(false);
    }
  };

  const canCancel = ['pending', 'confirmed', 'in_progress'].includes(booking.status);
  const canReschedule = ['pending', 'confirmed'].includes(booking.status);
  const canMarkNoShow = ['confirmed', 'in_progress'].includes(booking.status);
  const canRefund = ['completed', 'cancelled', 'no_show'].includes(booking.status);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-nilin-coral/5 via-nilin-rose/5 to-transparent p-6 border-b border-gray-100">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nilin-coral via-nilin-rose to-nilin-coral/50"></div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-nilin-coral" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Booking</p>
                <h2 className="text-xl font-bold text-gray-900">{booking.bookingNumber}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={booking.status} />
                  <span className="text-sm text-gray-500">
                    {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })} at {booking.scheduledTime}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close booking details"
              className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Booking details tabs" className="flex bg-gray-50 border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'customer', label: 'Customer' },
            { id: 'provider', label: 'Provider' },
            { id: 'service', label: 'Service' },
            { id: 'history', label: 'History' },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`booking-tab-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id as DetailTab)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                activeTab === tab.id
                  ? 'border-nilin-coral text-nilin-coral bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Amount Card */}
              <div className="bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10 rounded-2xl p-6 border border-nilin-coral/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total Amount</p>
                    <p className="text-4xl font-bold text-gray-900 mt-1">
                      {booking.totalAmount.currency} {booking.totalAmount.amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                    <DollarSign className="w-8 h-8 text-nilin-coral" />
                  </div>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Scheduled */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Scheduled Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 ml-13">{booking.scheduledTime}</p>
                </div>

                {/* Created */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(booking.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              {booking.address && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Service Location</p>
                      <p className="font-medium text-gray-900">{booking.address.label}</p>
                      <p className="text-sm text-gray-600">{booking.address.address}</p>
                      <p className="text-sm text-gray-500">{booking.address.city}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {booking.notes && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-amber-600 font-medium mb-1">Notes</p>
                      <p className="text-sm text-gray-700">{booking.notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cancellation Reason */}
              {booking.cancellationReason && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-600 font-medium mb-1">Cancellation Reason</p>
                      <p className="text-sm text-gray-700">{booking.cancellationReason}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'customer' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-nilin-coral/10 flex items-center justify-center overflow-hidden">
                    {booking.customer.avatar ? (
                      <img src={booking.customer.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-nilin-coral font-bold text-xl">
                        {booking.customer.firstName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {booking.customer.firstName} {booking.customer.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">Customer</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{booking.customer.email}</p>
                    </div>
                  </div>
                  {booking.customer.phone && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="font-medium text-gray-900">{booking.customer.phone}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-nilin-coral text-white text-sm font-medium rounded-xl hover:bg-nilin-rose transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    Message
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                    <User className="w-4 h-4" />
                    View Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'provider' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-nilin-coral/10 flex items-center justify-center overflow-hidden">
                    {booking.provider.avatar ? (
                      <img src={booking.provider.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building className="w-8 h-8 text-nilin-coral" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {booking.provider.businessName ||
                        `${booking.provider.firstName || ''} ${booking.provider.lastName || ''}`.trim() ||
                        'Provider'}
                    </h3>
                    <p className="text-sm text-gray-500">Service Provider</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{booking.provider.email}</p>
                    </div>
                  </div>
                  {booking.provider.phone && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="font-medium text-gray-900">{booking.provider.phone}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-nilin-coral text-white text-sm font-medium rounded-xl hover:bg-nilin-rose transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    Message
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                    <Building className="w-4 h-4" />
                    View Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'service' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-nilin-coral/10 flex items-center justify-center">
                    <Calendar className="w-8 h-8 text-nilin-coral" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{booking.service.name}</h3>
                    <p className="text-sm text-gray-500">{booking.service.category}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {booking.service.price.currency} {booking.service.price.amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500">Duration</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {booking.service.duration} {booking.service.durationUnit}
                    </p>
                  </div>
                </div>

                <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                  <Eye className="w-4 h-4" />
                  View Full Service Details
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Status History</h3>
              {booking.statusHistory && booking.statusHistory.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-4">
                    {booking.statusHistory.map((history, index) => (
                      <div key={index} className="relative flex items-start gap-4 pl-10">
                        <div className="absolute left-2.5 w-3 h-3 rounded-full bg-nilin-coral border-2 border-white shadow"></div>
                        <div className="flex-1 bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-1">
                            <StatusBadge status={history.status} />
                            <span className="text-xs text-gray-500">
                              {new Date(history.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {history.note && (
                            <p className="text-sm text-gray-600 mt-2">{history.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No status history available</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 flex-wrap">
            {canReschedule && (
              <button
                type="button"
                disabled
                title="Reschedule is not available — no admin reschedule API yet"
                className="px-4 py-2.5 bg-blue-600/50 text-white text-sm font-medium rounded-xl cursor-not-allowed flex items-center gap-2"
              >
                <CalendarClock className="w-4 h-4" />
                Reschedule
              </button>
            )}
            {canMarkNoShow && (
              <button
                onClick={handleMarkNoShow}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Mark No-Show
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 flex items-center gap-2 transition-colors"
              >
                <Ban className="w-4 h-4" />
                Cancel
              </button>
            )}
            {canRefund && (
              <button
                onClick={handleProcessRefund}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Process Refund
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Cancel Booking</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason for cancellation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Please provide a reason..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim() || actionLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <CalendarClock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Reschedule Booking</h3>
                  <p className="text-sm text-gray-500">Select new date and time</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="flex-1 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={!newDate || !newTime || actionLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Export Handler
// ============================================

const useExportHandler = (filters: AdminBookingFilters) => {
  return useCallback(async () => {
    try {
      toast.loading('Generating export...', { id: 'export' });
      const response = await api.post('/admin/bookings/export', filters, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bookings-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Export downloaded', { id: 'export' });
    } catch (err) {
      console.error('Error exporting bookings:', err);
      toast.error('Failed to export bookings', { id: 'export' });
    }
  }, [filters]);
};

// ============================================
// Filter Bar Component
// ============================================

const FilterBar: React.FC<{
  filters: AdminBookingFilters;
  onFiltersChange: (filters: AdminBookingFilters) => void;
  onClearFilters: () => void;
}> = ({ filters, onFiltersChange, onClearFilters }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [customerSearch, setCustomerSearch] = useState(filters.customerSearch || '');
  const [providerSearch, setProviderSearch] = useState(filters.providerSearch || '');

  const handleSearch = () => {
    onFiltersChange({ ...filters, search: searchValue || undefined });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const statuses: Array<{ value: BookingStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const activeFiltersCount = [
    filters.status && filters.status !== 'all',
    filters.customerSearch,
    filters.providerSearch,
    filters.serviceId,
    filters.startDate,
    filters.endDate,
    filters.minAmount,
    filters.maxAmount,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
      <div className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Main Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by booking number..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
            />
          </div>

          {/* Quick filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                activeFiltersCount > 0
                  ? 'border-nilin-coral bg-nilin-coral/10 text-nilin-coral'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-nilin-coral text-white text-xs rounded-full">
                  {activeFiltersCount}
                </span>
              )}
              {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={onClearFilters}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
              >
                Clear All
              </button>
            )}

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status || 'all'}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      status: e.target.value as BookingStatus | 'all',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                >
                  {statuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                <input
                  type="text"
                  placeholder="Customer name or email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                />
              </div>

              {/* Provider Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                <input
                  type="text"
                  placeholder="Provider name..."
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                />
              </div>

              {/* Date Range */}
              <div className="md:col-span-2 lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) =>
                      onFiltersChange({ ...filters, startDate: e.target.value || undefined })
                    }
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) =>
                      onFiltersChange({ ...filters, endDate: e.target.value || undefined })
                    }
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                  />
                </div>
              </div>

              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Min Amount</label>
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  value={filters.minAmount || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      minAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Amount</label>
                <input
                  type="number"
                  placeholder="1000.00"
                  min="0"
                  value={filters.maxAmount || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      maxAmount: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                />
              </div>

              {/* Apply Button */}
              <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setCustomerSearch('');
                    setProviderSearch('');
                    onFiltersChange({
                      ...filters,
                      customerSearch: undefined,
                      providerSearch: undefined,
                    });
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear Search Fields
                </button>
                <button
                  onClick={() => {
                    onFiltersChange({
                      ...filters,
                      customerSearch: customerSearch || undefined,
                      providerSearch: providerSearch || undefined,
                    });
                  }}
                  className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const BookingManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  // State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminBookingStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [filters, setFilters] = useState<AdminBookingFilters>({ status: 'all' });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load bookings from API
  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', '20');
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      if (filters.status && filters.status !== 'all') {
        params.append('status', Array.isArray(filters.status) ? filters.status.join(',') : filters.status);
      }
      if (filters.search) params.append('search', filters.search);
      if (filters.customerSearch) params.append('customerSearch', filters.customerSearch);
      if (filters.providerSearch) params.append('providerSearch', filters.providerSearch);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.minAmount) params.append('minPrice', filters.minAmount.toString());
      if (filters.maxAmount) params.append('maxPrice', filters.maxAmount.toString());

      const response = await api.get(`/admin/bookings?${params.toString()}`);
      const data = response.data.data;

      setBookings(data.bookings || []);
      setPagination({
        page: data.page || 1,
        pages: data.totalPages || 1,
        total: data.total || 0,
        limit: 20,
      });

      // Update stats from response if available
      if (data.stats) {
        setStats({
          total: data.stats.total || 0,
          pending: data.stats.pending || 0,
          confirmed: data.stats.confirmed || 0,
          inProgress: data.stats.in_progress || 0,
          completed: data.stats.completed || 0,
          cancelled: data.stats.cancelled || 0,
          noShows: data.stats.no_show || 0,
          refunded: data.stats.refunded || 0,
          totalRevenue: data.stats.revenue || 0,
        });
      }
    } catch (error) {
      const err = error as { message?: string };
      toast.error(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, sortBy, sortOrder]);

  // Load stats separately
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const response = await api.get('/admin/bookings/stats');
      const data = response.data.data;
      setStats({
        total: data.total || 0,
        pending: data.pending || 0,
        confirmed: data.confirmed || 0,
        inProgress: data.inProgress || data.in_progress || 0,
        completed: data.completed || 0,
        cancelled: data.cancelled || 0,
        noShows: data.noShows || data.no_show || 0,
        refunded: data.refunded || 0,
        totalRevenue: data.revenue || data.totalRevenue || 0,
      });
      setStatsError(null);
    } catch (error) {
      const err = error as { message?: string; response?: { status?: number } };
      const isNetworkError = !navigator.onLine || err.response?.status === 0;
      const errorMessage = isNetworkError
        ? 'Connection error. Please check your internet connection.'
        : (err.message || 'Failed to load statistics');
      setStatsError(errorMessage);
      if (isNetworkError) {
        toast.error('Connection error. Please check your internet connection and try again');
      } else {
        toast.error('Failed to load statistics. Use the retry button to refresh.');
      }
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    const bookingId = searchParams.get('bookingId');
    if (!bookingId) return;

    const match = bookings.find((b) => b._id === bookingId);
    if (match) {
      setSelectedBooking(match);
      return;
    }

    if (!loading) {
      api.get(`/admin/bookings/${bookingId}`)
        .then((response) => {
          if (response.data?.data) {
            setSelectedBooking(response.data.data);
          }
        })
        .catch(() => undefined);
    }
  }, [searchParams, bookings, loading]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleFiltersChange = (newFilters: AdminBookingFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({ status: 'all' });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const filterByStatus = (status: BookingStatus | 'all') => {
    handleFiltersChange({ ...filters, status });
  };

  const handleExport = useExportHandler(filters);

  const handleOpenChat = async (booking: Booking) => {
    try {
      const response = await api.post('/chat/rooms', {
        bookingId: booking._id,
        participants: [
          { userId: booking.customer._id, role: 'customer' },
          { userId: booking.provider._id, role: 'provider' }
        ]
      });

      if (response.data?.success) {
        toast.success('Chat room opened');
        // Navigate to chat or open chat modal
        window.open(`/chat/${response.data.data.roomId}`, '_blank');
      }
    } catch (err) {
      console.error('Error opening chat:', err);
      toast.error('Failed to open chat');
    }
  };

  return (
    <AdminPageShell
      title="Booking Management"
      subtitle="Monitor and manage all service bookings across the platform"
      wideLayout
    >
      <div className="space-y-6">
        {/* Skip Link */}
        <a
          href="#bookings-table"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:ring-2 focus:ring-white"
        >
          Skip to bookings table
        </a>

        {/* Stats Cards */}
        {statsError && !statsLoading ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Unable to load statistics</p>
                <p className="text-xs text-red-600 mt-0.5">{statsError}</p>
              </div>
            </div>
            <button
              onClick={loadStats}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              aria-label="Retry loading statistics"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Bookings"
            value={stats?.total.toLocaleString() || '0'}
            icon={<Calendar className="w-5 h-5" />}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
          <StatCard
            title="Pending"
            value={stats?.pending || 0}
            icon={<Clock className="w-5 h-5" />}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            onClick={() => filterByStatus('pending')}
          />
          <StatCard
            title="In Progress"
            value={stats?.inProgress || 0}
            icon={<CalendarClock className="w-5 h-5" />}
            iconBg="bg-sky-100"
            iconColor="text-sky-600"
            onClick={() => filterByStatus('in_progress')}
          />
          <StatCard
            title="Completed"
            value={stats?.completed || 0}
            icon={<CheckCircle className="w-5 h-5" />}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            onClick={() => filterByStatus('completed')}
          />
          <StatCard
            title="Cancelled"
            value={stats?.cancelled || 0}
            icon={<XCircle className="w-5 h-5" />}
            iconBg="bg-gray-100"
            iconColor="text-gray-600"
            onClick={() => filterByStatus('cancelled')}
          />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="No Shows"
            value={stats?.noShows || 0}
            icon={<AlertTriangle className="w-5 h-5" />}
            iconBg="bg-red-100"
            iconColor="text-red-600"
            onClick={() => filterByStatus('no_show')}
          />
          <StatCard
            title="Refunded"
            value={stats?.refunded || 0}
            icon={<RotateCcw className="w-5 h-5" />}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            onClick={() => filterByStatus('refunded')}
          />
          <StatCard
            title="Confirmed"
            value={stats?.confirmed || 0}
            icon={<Check className="w-5 h-5" />}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            onClick={() => filterByStatus('confirmed')}
          />
          <StatCard
            title="Total Revenue"
            value={`AED ${((stats?.totalRevenue || 0) / 1000).toFixed(1)}K`}
            icon={<DollarSign className="w-5 h-5" />}
            iconBg="bg-nilin-coral/10"
            iconColor="text-nilin-coral"
          />
        </div>
        </>
        )}

        {/* Filters */}
        <FilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
        />

        {/* Bookings Table */}
        {loading ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-nilin-coral mx-auto mb-4" />
            <p className="text-gray-500">Loading bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          (() => {
            // Distinguish "no data" vs "filters narrowed everything away".
            const hasActiveFilters = activeFiltersCount > 0;
            const hasAnyBookings = (stats?.total ?? 0) > 0;
            if (hasActiveFilters) {
              return (
                <div className="bg-white rounded-xl p-12 text-center">
                  <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No bookings match your filters
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Try adjusting or clearing your filters to see more results.
                  </p>
                  <button
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white text-sm font-medium rounded-xl hover:bg-nilin-rose transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                  >
                    <X className="w-4 h-4" />
                    Clear all filters
                  </button>
                </div>
              );
            }
            if (hasAnyBookings) {
              return (
                <div className="bg-white rounded-xl p-12 text-center">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No bookings on this page
                  </h3>
                  <p className="text-gray-500">
                    Try a different page or check back later.
                  </p>
                </div>
              );
            }
            return (
              <div className="bg-white rounded-xl p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings yet</h3>
                <p className="text-gray-500">
                  New bookings will appear here once customers start booking services.
                </p>
              </div>
            );
          })()
        ) : (
          <>
            <div id="bookings-table" className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Booking #
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Service
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Date / Time
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bookings.map((booking) => (
                      <tr
                        key={booking._id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-nilin-coral">
                            {booking.bookingNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-nilin-coral/10 flex items-center justify-center">
                              {booking.customer.avatar ? (
                                <img
                                  src={booking.customer.avatar}
                                  alt=""
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-nilin-coral font-semibold text-sm">
                                  {booking.customer.firstName.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {booking.customer.firstName} {booking.customer.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{booking.customer.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {booking.provider.businessName ||
                              `${booking.provider.firstName || ''} ${booking.provider.lastName || ''}`.trim() ||
                              'Provider'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">{booking.service.name}</p>
                          <p className="text-xs text-gray-500">{booking.service.category}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">
                            {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-gray-500">{booking.scheduledTime}</p>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={booking.status} />
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {booking.totalAmount.currency} {booking.totalAmount.amount.toFixed(2)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-nilin-coral"
                              aria-label="View booking details"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleOpenChat(booking)}
                              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-nilin-coral"
                              aria-label="Message about booking"
                            >
                              <MessageSquare className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <AdminPagination
              page={pagination.page}
              totalPages={pagination.pages}
              total={pagination.total}
              pageSize={pagination.limit}
              onPageChange={handlePageChange}
              showPageNumbers
              showTotal
              className="mt-6 bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              ariaLabel="Booking list pagination"
            />
          </>
        )}
      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onRefresh={loadBookings}
        />
      )}
    </AdminPageShell>
  );
};

export default BookingManagement;
