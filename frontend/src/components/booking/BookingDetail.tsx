import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  Star,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Send,
  User,
  CreditCard,
  FileText,
  Edit,
  MoreHorizontal
} from 'lucide-react';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import type { Booking } from '../../services/BookingService';
import bookingService from '../../services/BookingService';
import { cn, formatPrice } from '../../lib/utils';
import ExperienceSubmissionForm from '../experience/ExperienceSubmissionForm';
import { experienceApi } from '../../services/experienceApi';
import { useToastActions } from '../common/Toast';
import { CANCELLATION_REASONS } from '../../constants/booking';

interface BookingDetailProps {
  userType: 'customer' | 'provider';
  className?: string;
}

const BookingDetail: React.FC<BookingDetailProps> = ({ userType, className }) => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'details';
  const navigate = useNavigate();
  const toast = useToastActions();

  // Use browser locale for date/time formatting with fallback
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

  const { user } = useAuthStore();
  const {
    currentBooking,
    getBooking,
    addBookingMessage,
    markMessagesRead,
    acceptBooking,
    rejectBooking,
    startBooking,
    completeBooking,
    cancelBooking,
    isLoading,
    isSubmitting,
    errors
  } = useBookingStore();

  const [newMessage, setNewMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showExperienceForm, setShowExperienceForm] = useState(false);
  const [hasExperience, setHasExperience] = useState(false);
  const [checkingExperience, setCheckingExperience] = useState(false);

  // Load booking details
  useEffect(() => {
    if (bookingId) {
      getBooking(bookingId);
    }
  }, [bookingId, getBooking]);

  // Check if user has submitted an experience for this booking
  useEffect(() => {
    if (bookingId && currentBooking?.status === 'completed' && userType === 'customer') {
      checkExperienceSubmission();
    }
  }, [bookingId, currentBooking?.status, userType]);

  const checkExperienceSubmission = async () => {
    if (!bookingId) return;
    setCheckingExperience(true);
    try {
      const response = await experienceApi.checkExperienceExists(bookingId);
      setHasExperience(response.data.exists);
    } catch (error) {
      console.error('Error checking experience submission:', error);
      setHasExperience(false);
    } finally {
      setCheckingExperience(false);
    }
  };

  // Mark messages as read when viewing messages tab
  useEffect(() => {
    if (currentBooking && activeTab === 'messages' && user) {
      const unreadMessages = currentBooking.messages.filter(
        message => !message.readBy.some(read => read.userId === user.id)
      );

      if (unreadMessages.length > 0) {
        markMessagesRead(currentBooking._id);
      }
    }
  }, [currentBooking, activeTab, user, markMessagesRead]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentBooking) return;

    try {
      await addBookingMessage(currentBooking._id, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message', 'Please try again');
    }
  };

  const handleBookingAction = async (action: string) => {
    if (!currentBooking) return;

    setActionLoading(action);
    try {
      switch (action) {
        case 'accept':
          await acceptBooking(currentBooking._id);
          break;
        case 'reject':
          await rejectBooking(currentBooking._id, {
            reason: 'unavailable',
            notes: 'Provider rejected the booking'
          });
          break;
        case 'start':
          await startBooking(currentBooking._id);
          break;
        case 'complete':
          await completeBooking(currentBooking._id);
          break;
        case 'cancel':
          await cancelBooking(currentBooking._id, {
            reason: CANCELLATION_REASONS.CUSTOMER_REQUEST,
            notes: 'Cancelled by customer'
          });
          break;
        case 'reschedule':
          // Navigate to reschedule page using React Router for proper SPA navigation
          navigate(`/${userType}/bookings/${currentBooking._id}/reschedule`);
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} booking:`, error);
      toast.error(`Failed to ${action} booking. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: Booking['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5" />;
      case 'confirmed':
        return <CheckCircle className="h-5 w-5" />;
      case 'in_progress':
        return <AlertCircle className="h-5 w-5" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5" />;
      case 'no_show':
        return <XCircle className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  // Action icons mapping - fixed type mismatch at line 298
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'accept':
        return <CheckCircle className="h-4 w-4" />;
      case 'reject':
        return <XCircle className="h-4 w-4" />;
      case 'start':
        return <AlertCircle className="h-4 w-4" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancel':
        return <XCircle className="h-4 w-4" />;
      case 'reschedule':
        return <Clock className="h-4 w-4" />;
      default:
        return <MoreHorizontal className="h-4 w-4" />;
    }
  };

  const formatDateTime = (date: string, time: string) => {
    const bookingDate = new Date(`${date}T${time}`);
    return {
      date: bookingDate.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: bookingDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const getAvailableActions = (): string[] => {
    if (!currentBooking) return [];

    const actions: string[] = [];

    if (userType === 'provider') {
      switch (currentBooking.status) {
        case 'pending':
          actions.push('accept', 'reject');
          break;
        case 'confirmed':
          actions.push('start');
          break;
        case 'in_progress':
          actions.push('complete');
          break;
      }
    } else {
      // Customer actions
      if (bookingService.canCancelBooking(currentBooking)) {
        actions.push('cancel');
      }
      // Add reschedule action for customers with pending/confirmed bookings
      if (bookingService.canRescheduleBooking(currentBooking)) {
        actions.push('reschedule');
      }
    }

    return actions;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
      </div>
    );
  }

  if (!currentBooking) {
    return (
      <div className="glass text-center py-12 rounded-xl gradient-3d">
        <AlertCircle className="h-16 w-16 text-nilin-rose/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-nilin-charcoal mb-2">Booking not found</h3>
        <p className="text-nilin-warmGray">The booking you're looking for doesn't exist or you don't have access to it.</p>
      </div>
    );
  }

  const { date, time } = formatDateTime(currentBooking.scheduledDate, currentBooking.scheduledTime);
  const availableActions = getAvailableActions();

  return (
    <div className={cn("max-w-4xl mx-auto", className)}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link
            to={`/${userType}/bookings`}
            className="glass-btn p-2 hover:bg-nilin-blush/30 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-nilin-warmGray" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-nilin-charcoal font-serif">
              Booking #{bookingService.formatBookingNumber(currentBooking.bookingNumber)}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium glass",
                bookingService.getStatusColor(currentBooking.status)
              )}>
                {getStatusIcon(currentBooking.status)}
                {bookingService.getStatusLabel(currentBooking.status)}
              </div>
              <span className="text-sm text-nilin-warmGray">
                Created {new Date(currentBooking.createdAt).toLocaleDateString(locale)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          {availableActions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {availableActions.map((action) => {
                const getActionColor = (actionType: string) => {
                  switch (actionType) {
                    case 'accept':
                      return 'bg-nilin-success hover:bg-nilin-success/90 text-white';
                    case 'start':
                      return 'bg-gradient-to-r from-nilin-rose to-nilin-coral hover:shadow-nilin-warm text-white';
                    case 'complete':
                      return 'bg-nilin-success hover:bg-nilin-success/90 text-white';
                    case 'reject':
                    case 'cancel':
                      return 'bg-nilin-error hover:bg-nilin-error/90 text-white';
                    case 'reschedule':
                      return 'bg-blue-500 hover:bg-blue-600 text-white';
                    default:
                      return 'bg-nilin-warmGray hover:bg-nilin-charcoal text-white';
                  }
                };

                return (
                  <button
                    key={action}
                    onClick={() => handleBookingAction(action)}
                    disabled={actionLoading === action}
                    aria-label={`${action.charAt(0).toUpperCase() + action.slice(1)} booking`}
                    className={cn(
                      "btn-3d flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium",
                      getActionColor(action),
                      actionLoading === action && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {actionLoading === action ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      getActionIcon(action)
                    )}
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                    {action === 'complete' && ' Service'}
                  </button>
                );
              })}
            </div>
          )}

          {/* Share Experience Button */}
          {userType === 'customer' && currentBooking.status === 'completed' && !checkingExperience && (
            <div className="flex items-center gap-2">
              {hasExperience ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-nilin-success/10 text-nilin-success rounded-xl text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Experience Shared
                </div>
              ) : (
                <button
                  onClick={() => setShowExperienceForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl hover:shadow-nilin-warm transition-all text-sm font-medium btn-3d"
                >
                  <Star className="h-4 w-4" />
                  Share Experience
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="glass border-b border-nilin-border/30 rounded-t-xl">
          <nav className="flex space-x-8 px-4">
            <Link
              to={`/${userType}/bookings/${currentBooking._id}`}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm transition-all",
                activeTab === 'details'
                  ? "border-nilin-coral text-nilin-coral"
                  : "border-transparent text-nilin-warmGray hover:text-nilin-charcoal hover:border-nilin-border"
              )}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Details
            </Link>
            <Link
              to={`/${userType}/bookings/${currentBooking._id}?tab=messages`}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm flex items-center transition-all",
                activeTab === 'messages'
                  ? "border-nilin-coral text-nilin-coral"
                  : "border-transparent text-nilin-warmGray hover:text-nilin-charcoal hover:border-nilin-border"
              )}
            >
              <MessageCircle className="h-4 w-4 inline mr-2" />
              Messages
              {currentBooking.messages.length > 0 && (
                <span className="ml-1 glass bg-nilin-blush text-nilin-charcoal text-xs rounded-full px-2 py-0.5">
                  {currentBooking.messages.length}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="glass mb-6 p-4 rounded-xl bg-nilin-error/10 border border-nilin-error/20">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-nilin-error mr-2" />
            <div>
              <h3 className="text-sm font-medium text-nilin-error">Error</h3>
              <div className="text-sm text-nilin-error/80 mt-1">
                {errors.map((error, index) => (
                  <p key={index}>{error.message}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Completed Booking Notice */}
          {currentBooking.status === 'completed' && (
            <div className="glass p-4 rounded-xl bg-nilin-success/10 border border-nilin-success/20">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-nilin-success mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-nilin-success">Service Completed</h3>
                  <p className="text-sm text-nilin-success/80 mt-1">
                    This service has been successfully completed.
                    {currentBooking.providerResponse?.completedAt && (
                      <span className="ml-1">
                        Completed on {new Date(currentBooking.providerResponse.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* In Progress Notice */}
          {currentBooking.status === 'in_progress' && (
            <div className="glass p-4 rounded-xl gradient-3d">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-nilin-rose mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-nilin-charcoal">Service In Progress</h3>
                  <p className="text-sm text-nilin-warmGray mt-1">
                    This service is currently being performed.
                    {currentBooking.providerResponse?.arrivalTime && (
                      <span className="ml-1">
                        Started at {new Date(currentBooking.providerResponse.arrivalTime).toLocaleTimeString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Service Information */}
          <div className="glass glass-blur rounded-xl p-6 gradient-3d card-3d">
            <h2 className="text-lg font-semibold text-nilin-charcoal mb-4 font-serif">Service Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-nilin-charcoal mb-2">
                  {currentBooking.service?.name || 'Service'}
                </h3>
                <p className="text-nilin-warmGray mb-4">
                  {currentBooking.service?.description || 'No description available'}
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 neu-light p-3 rounded-xl">
                    <Calendar className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <p className="font-medium text-nilin-charcoal">{date}</p>
                      <p className="text-sm text-nilin-warmGray">{time}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 neu-light p-3 rounded-xl">
                    <Clock className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <p className="font-medium text-nilin-charcoal">{(currentBooking as any).duration || currentBooking.estimatedDuration || (currentBooking as any).selectedDuration || currentBooking.service?.duration || '—'} minutes</p>
                      <p className="text-sm text-nilin-warmGray">Estimated duration</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 neu-light p-3 rounded-xl">
                    <MapPin className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <p className="font-medium text-nilin-charcoal">
                        {currentBooking.location.type === 'customer_address' && 'Customer Address'}
                        {currentBooking.location.type === 'provider_location' && 'Provider Location'}
                        {currentBooking.location.type === 'online' && 'Online/Virtual'}
                      </p>
                      {currentBooking.location.address && (
                        <div className="text-sm text-nilin-warmGray">
                          <p>{currentBooking.location.address.street}</p>
                          <p>
                            {currentBooking.location.address.city}, {currentBooking.location.address.state} {currentBooking.location.address.zipCode}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {currentBooking.customerInfo.phone && (
                    <div className="flex items-center gap-3 neu-light p-3 rounded-xl">
                      <Phone className="h-5 w-5 text-nilin-rose" />
                      <div>
                        <p className="font-medium text-nilin-charcoal">{currentBooking.customerInfo.phone}</p>
                        <p className="text-sm text-nilin-warmGray">Contact number</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                {/* Provider/Customer Info */}
                {userType === 'customer' && currentBooking.provider && (
                  <div className="mb-6">
                    <h4 className="font-medium text-nilin-charcoal mb-3">Service Provider</h4>
                    <div className="flex items-center gap-3 p-3 neu-light rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-br from-nilin-rose to-nilin-coral rounded-full flex items-center justify-center shadow-nilin-warm">
                        {currentBooking.provider.avatar ? (
                          <img
                            src={currentBooking.provider.avatar}
                            alt="Provider"
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <User className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-nilin-charcoal">
                          {currentBooking.provider.firstName} {currentBooking.provider.lastName}
                        </p>
                        {currentBooking.provider.businessInfo?.businessName && (
                          <p className="text-sm text-nilin-warmGray">
                            {currentBooking.provider.businessInfo.businessName}
                          </p>
                        )}
                        {currentBooking.provider.phone && (
                          <p className="text-sm text-nilin-warmGray">{currentBooking.provider.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {userType === 'provider' && currentBooking.customer && (
                  <div className="mb-6">
                    <h4 className="font-medium text-nilin-charcoal mb-3">Customer</h4>
                    <div className="flex items-center gap-3 p-3 neu-light rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-br from-nilin-success to-nilin-success/70 rounded-full flex items-center justify-center shadow-nilin-warm">
                        {currentBooking.customer.avatar ? (
                          <img
                            src={currentBooking.customer.avatar}
                            alt="Customer"
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <User className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-nilin-charcoal">
                          {currentBooking.customer.firstName} {currentBooking.customer.lastName}
                        </p>
                        <p className="text-sm text-nilin-warmGray">{currentBooking.customer.email}</p>
                        {currentBooking.customer.phone && (
                          <p className="text-sm text-nilin-warmGray">{currentBooking.customer.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pricing Breakdown */}
                <div className="glass p-4 rounded-xl gradient-3d">
                  <h4 className="font-medium text-nilin-charcoal mb-3">Pricing Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-nilin-warmGray">Base Service:</span>
                      <span className="text-nilin-charcoal">{new Intl.NumberFormat(locale, { style: 'currency', currency: currentBooking.pricing.currency }).format(currentBooking.pricing.basePrice || currentBooking.service?.price.amount || 0)}</span>
                    </div>

                    {currentBooking.pricing.addOns?.length > 0 && (
                      <>
                        {currentBooking.pricing.addOns.map((addon, index) => (
                          <div key={index} className="flex justify-between text-nilin-warmGray">
                            <span>{addon.name}:</span>
                            <span className="text-nilin-charcoal">{new Intl.NumberFormat(locale, { style: 'currency', currency: currentBooking.pricing.currency }).format(addon.price)}</span>
                          </div>
                        ))}
                      </>
                    )}

                    <div className="flex justify-between border-t border-nilin-border/30 pt-2">
                      <span className="text-nilin-warmGray">Subtotal:</span>
                      <span className="text-nilin-charcoal">{new Intl.NumberFormat(locale, { style: 'currency', currency: currentBooking.pricing.currency }).format(currentBooking.pricing.subtotal)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-nilin-warmGray">Taxes:</span>
                      <span className="text-nilin-charcoal">{new Intl.NumberFormat(locale, { style: 'currency', currency: currentBooking.pricing.currency }).format(currentBooking.pricing.tax)}</span>
                    </div>

                    <div className="flex justify-between border-t border-nilin-border/30 pt-2 font-semibold text-lg">
                      <span className="text-nilin-charcoal">Total:</span>
                      <span className="text-nilin-coral">{new Intl.NumberFormat(locale, { style: 'currency', currency: currentBooking.pricing.currency }).format(currentBooking.pricing.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Requests & Instructions */}
            {(currentBooking.customerInfo.specialRequests || currentBooking.customerInfo.accessInstructions || currentBooking.location.notes) && (
              <div className="mt-6 pt-6 border-t border-nilin-border/30">
                <h4 className="font-medium text-nilin-charcoal mb-3">Additional Information</h4>
                <div className="space-y-4">
                  {currentBooking.customerInfo.specialRequests && (
                    <div>
                      <h5 className="text-sm font-medium text-nilin-warmGray mb-1">Special Requests:</h5>
                      <p className="text-sm text-nilin-charcoal p-3 neu-light rounded-xl">
                        {currentBooking.customerInfo.specialRequests}
                      </p>
                    </div>
                  )}

                  {currentBooking.customerInfo.accessInstructions && (
                    <div>
                      <h5 className="text-sm font-medium text-nilin-warmGray mb-1">Access Instructions:</h5>
                      <p className="text-sm text-nilin-charcoal p-3 neu-light rounded-xl">
                        {currentBooking.customerInfo.accessInstructions}
                      </p>
                    </div>
                  )}

                  {currentBooking.location.notes && (
                    <div>
                      <h5 className="text-sm font-medium text-nilin-warmGray mb-1">Location Notes:</h5>
                      <p className="text-sm text-nilin-charcoal p-3 neu-light rounded-xl">
                        {currentBooking.location.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status History */}
          {currentBooking.statusHistory?.length > 0 && (
            <div className="glass glass-blur rounded-xl p-6 gradient-3d card-3d">
              <h2 className="text-lg font-semibold text-nilin-charcoal mb-4 font-serif">Status History</h2>
              <div className="space-y-3">
                {currentBooking.statusHistory.map((status, index) => {
                  // Try to get user name from booking participants
                  const isProvider = currentBooking.provider?._id === status.updatedBy;
                  const isCustomer = currentBooking.customer?._id === status.updatedBy;
                  const updatedByName = isProvider
                    ? `${currentBooking.provider.firstName} ${currentBooking.provider.lastName}`
                    : isCustomer
                      ? `${currentBooking.customer.firstName} ${currentBooking.customer.lastName}`
                      : status.updatedBy;

                  return (
                    <div key={index} className="flex items-center gap-3 p-3 neu-light rounded-xl">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        status.status === 'completed' ? "bg-nilin-success" :
                        status.status === 'cancelled' ? "bg-nilin-error" :
                        "bg-nilin-coral"
                      )} />
                      <div className="flex-1">
                        <p className="font-medium text-nilin-charcoal capitalize">
                          {status.status.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-nilin-warmGray">
                          {new Date(status.timestamp).toLocaleString(locale)}
                        </p>
                        {status.notes && (
                          <p className="text-sm text-nilin-warmGray mt-1">{status.notes}</p>
                        )}
                        {updatedByName !== status.updatedBy && (
                          <p className="text-xs text-nilin-warmGray mt-1">by {updatedByName}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="glass glass-blur rounded-xl gradient-3d">
          {/* Messages List */}
          <div className="p-6 max-h-96 overflow-y-auto border-b border-nilin-border/30">
            {currentBooking.messages.length > 0 ? (
              <div className="space-y-4">
                {currentBooking.messages.map((message) => {
                  const isOwnMessage = user && message.senderType === userType;

                  return (
                    <div
                      key={message._id}
                      className={cn(
                        "flex",
                        isOwnMessage ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-xs lg:max-w-md px-4 py-2 rounded-xl",
                        isOwnMessage
                          ? "bg-gradient-to-r from-nilin-rose to-nilin-coral text-white"
                          : "glass text-nilin-charcoal"
                      )}>
                        <p
                          className="text-sm"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.message) }}
                        />
                        <p className={cn(
                          "text-xs mt-1",
                          isOwnMessage ? "text-white/80" : "text-nilin-warmGray"
                        )}>
                          {new Date(message.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-nilin-warmGray">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 text-nilin-rose/50" />
                <p>No messages yet</p>
                <p className="text-sm">Start a conversation about this booking</p>
              </div>
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="glass-input flex-1 px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans border-glow"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || isSubmitting}
                className={cn(
                  "btn-3d px-4 py-3 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl transition-all flex items-center gap-2",
                  (!newMessage.trim() || isSubmitting)
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:shadow-nilin-warm"
                )}
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Experience Submission Modal */}
      {showExperienceForm && (
        <ExperienceSubmissionForm
          isOpen={showExperienceForm}
          onClose={() => setShowExperienceForm(false)}
          bookingId={currentBooking._id}
          onSuccess={() => {
            setHasExperience(true);
            checkExperienceSubmission();
          }}
        />
      )}
    </div>
  );
};

export default BookingDetail;
