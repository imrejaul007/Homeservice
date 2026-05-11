import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
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

interface BookingDetailProps {
  userType: 'customer' | 'provider';
  className?: string;
}

const BookingDetail: React.FC<BookingDetailProps> = ({ userType, className }) => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'details';

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
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load booking details
  useEffect(() => {
    if (bookingId) {
      getBooking(bookingId);
    }
  }, [bookingId, getBooking]);

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
            reason: 'customer_request',
            notes: 'Cancelled by customer'
          });
          break;
      }
      setShowActionMenu(false);
    } catch (error) {
      console.error(`Failed to ${action} booking:`, error);
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
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const formatDateTime = (date: string, time: string) => {
    const bookingDate = new Date(`${date}T${time}`);
    return {
      date: bookingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: bookingDate.toLocaleTimeString('en-US', {
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
    }

    return actions;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentBooking) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Booking not found</h3>
        <p className="text-gray-500">The booking you're looking for doesn't exist or you don't have access to it.</p>
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
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              Booking #{bookingService.formatBookingNumber(currentBooking.bookingNumber)}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                bookingService.getStatusColor(currentBooking.status)
              )}>
                {getStatusIcon(currentBooking.status)}
                {bookingService.getStatusLabel(currentBooking.status)}
              </div>
              <span className="text-sm text-gray-500">
                Created {new Date(currentBooking.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          {availableActions.length > 0 && (
            <div className="flex items-center gap-2">
              {availableActions.map((action) => {
                const getActionColor = (actionType: string) => {
                  switch (actionType) {
                    case 'accept':
                      return 'bg-green-500 hover:bg-green-600 text-white';
                    case 'start':
                      return 'bg-blue-500 hover:bg-blue-600 text-white';
                    case 'complete':
                      return 'bg-purple-500 hover:bg-purple-600 text-white';
                    case 'reject':
                    case 'cancel':
                      return 'bg-red-500 hover:bg-red-600 text-white';
                    default:
                      return 'bg-gray-500 hover:bg-gray-600 text-white';
                  }
                };

                return (
                  <button
                    key={action}
                    onClick={() => handleBookingAction(action)}
                    disabled={actionLoading === action}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium",
                      getActionColor(action),
                      actionLoading === action && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {actionLoading === action ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      getStatusIcon(action as any)
                    )}
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                    {action === 'complete' && ' Service'}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <Link
              to={`/${userType}/bookings/${currentBooking._id}`}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm",
                activeTab === 'details'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Details
            </Link>
            <Link
              to={`/${userType}/bookings/${currentBooking._id}?tab=messages`}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm flex items-center",
                activeTab === 'messages'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <MessageCircle className="h-4 w-4 inline mr-2" />
              Messages
              {currentBooking.messages.length > 0 && (
                <span className="ml-1 bg-gray-200 text-gray-700 text-xs rounded-full px-2 py-0.5">
                  {currentBooking.messages.length}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="text-sm text-red-700 mt-1">
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-green-800">Service Completed</h3>
                  <p className="text-sm text-green-700 mt-1">
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-blue-800">Service In Progress</h3>
                  <p className="text-sm text-blue-700 mt-1">
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
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">
                  {currentBooking.service?.name || 'Service'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {currentBooking.service?.description || 'No description available'}
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{date}</p>
                      <p className="text-sm text-gray-600">{time}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{(currentBooking as any).duration || currentBooking.estimatedDuration || (currentBooking as any).selectedDuration || currentBooking.service?.duration || '—'} minutes</p>
                      <p className="text-sm text-gray-600">Estimated duration</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {currentBooking.location.type === 'customer_address' && 'Customer Address'}
                        {currentBooking.location.type === 'provider_location' && 'Provider Location'}
                        {currentBooking.location.type === 'online' && 'Online/Virtual'}
                      </p>
                      {currentBooking.location.address && (
                        <div className="text-sm text-gray-600">
                          <p>{currentBooking.location.address.street}</p>
                          <p>
                            {currentBooking.location.address.city}, {currentBooking.location.address.state} {currentBooking.location.address.zipCode}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {currentBooking.customerInfo.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{currentBooking.customerInfo.phone}</p>
                        <p className="text-sm text-gray-600">Contact number</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                {/* Provider/Customer Info */}
                {userType === 'customer' && currentBooking.provider && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-3">Service Provider</h4>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
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
                        <p className="font-medium text-gray-900">
                          {currentBooking.provider.firstName} {currentBooking.provider.lastName}
                        </p>
                        {currentBooking.provider.businessInfo?.businessName && (
                          <p className="text-sm text-gray-600">
                            {currentBooking.provider.businessInfo.businessName}
                          </p>
                        )}
                        {currentBooking.provider.phone && (
                          <p className="text-sm text-gray-600">{currentBooking.provider.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {userType === 'provider' && currentBooking.customer && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-3">Customer</h4>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
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
                        <p className="font-medium text-gray-900">
                          {currentBooking.customer.firstName} {currentBooking.customer.lastName}
                        </p>
                        <p className="text-sm text-gray-600">{currentBooking.customer.email}</p>
                        {currentBooking.customer.phone && (
                          <p className="text-sm text-gray-600">{currentBooking.customer.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pricing Breakdown */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Pricing Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Base Service:</span>
                      <span>{formatPrice(currentBooking.pricing.basePrice || currentBooking.service?.price.amount || 0, currentBooking.pricing.currency)}</span>
                    </div>

                    {currentBooking.pricing.addOns.length > 0 && (
                      <>
                        {currentBooking.pricing.addOns.map((addon, index) => (
                          <div key={index} className="flex justify-between text-gray-600">
                            <span>{addon.name}:</span>
                            <span>{formatPrice(addon.price, currentBooking.pricing.currency)}</span>
                          </div>
                        ))}
                      </>
                    )}

                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>{formatPrice(currentBooking.pricing.subtotal, currentBooking.pricing.currency)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Taxes:</span>
                      <span>{formatPrice(currentBooking.pricing.taxes, currentBooking.pricing.currency)}</span>
                    </div>

                    <div className="flex justify-between border-t pt-2 font-semibold text-lg">
                      <span>Total:</span>
                      <span>{formatPrice(currentBooking.pricing.totalAmount || currentBooking.pricing.total || 0, currentBooking.pricing.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Requests & Instructions */}
            {(currentBooking.customerInfo.specialRequests || currentBooking.customerInfo.accessInstructions || currentBooking.location.notes) && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">Additional Information</h4>
                <div className="space-y-4">
                  {currentBooking.customerInfo.specialRequests && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Special Requests:</h5>
                      <p className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
                        {currentBooking.customerInfo.specialRequests}
                      </p>
                    </div>
                  )}

                  {currentBooking.customerInfo.accessInstructions && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Access Instructions:</h5>
                      <p className="text-sm text-gray-600 p-3 bg-yellow-50 rounded-lg">
                        {currentBooking.customerInfo.accessInstructions}
                      </p>
                    </div>
                  )}

                  {currentBooking.location.notes && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Location Notes:</h5>
                      <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                        {currentBooking.location.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status History */}
          {currentBooking.statusHistory.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>
              <div className="space-y-3">
                {currentBooking.statusHistory.map((status, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      status.status === 'completed' ? "bg-green-500" :
                      status.status === 'cancelled' ? "bg-red-500" :
                      "bg-blue-500"
                    )} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 capitalize">
                        {status.status.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(status.timestamp).toLocaleString()}
                      </p>
                      {status.notes && (
                        <p className="text-sm text-gray-600 mt-1">{status.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="bg-white border border-gray-200 rounded-lg">
          {/* Messages List */}
          <div className="p-6 max-h-96 overflow-y-auto border-b border-gray-200">
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
                        "max-w-xs lg:max-w-md px-4 py-2 rounded-lg",
                        isOwnMessage
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-900"
                      )}>
                        <p className="text-sm">{message.message}</p>
                        <p className={cn(
                          "text-xs mt-1",
                          isOwnMessage ? "text-blue-100" : "text-gray-500"
                        )}>
                          {new Date(message.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || isSubmitting}
                className={cn(
                  "px-4 py-2 bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2",
                  (!newMessage.trim() || isSubmitting)
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-blue-600"
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
    </div>
  );
};

export default BookingDetail;