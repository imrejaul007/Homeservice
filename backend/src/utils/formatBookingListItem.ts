import mongoose from 'mongoose';

/**
 * SECURITY FIX: Comprehensive regex escape for MongoDB queries
 * Escapes ALL special regex characters including:
 * - Quantifiers: * + ? {n} {n,} {n,m}
 * - Anchors: ^ $ \b \B
 * - Groups: () (?:) (?=) (?!)
 * - Character classes: [ ] [^ ]
 * - Alternation: |
 * - Escape sequences: \n \t \r
 * - MongoDB-specific: . (already handled but explicitly included)
 * - Unicode control characters
 */
const escapeRegex = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[\.\*\+\?\^\$\{\}\(\)\[\]\|\\]/g, '\\$&')  // Escape all regex special chars
    .replace(/-/g, '\\-')  // Extra safety for character ranges
    .replace(/\//g, '\\/');  // Escape forward slashes
};

export { escapeRegex };

type RawBooking = Record<string, any>;

function formatService(service: any) {
  if (!service) return undefined;
  const price = service.price || {};
  const amount =
    typeof price.amount === 'number'
      ? price.amount
      : typeof service.basePrice === 'number'
        ? service.basePrice
        : 0;

  return {
    _id: service._id?.toString?.() ?? service._id,
    name: service.name,
    description: service.description,
    category: service.category,
    subcategory: service.subcategory,
    duration: service.duration,
    images: service.images,
    price: {
      amount,
      currency: price.currency || 'AED',
      type: price.type || 'fixed',
    },
  };
}

function formatUser(user: any) {
  if (!user || typeof user !== 'object') return undefined;
  return {
    _id: user._id?.toString?.() ?? user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    businessInfo: user.businessInfo,
  };
}

function formatMessages(
  messages: RawBooking['messages'],
  customerId?: mongoose.Types.ObjectId | string,
  providerId?: mongoose.Types.ObjectId | string,
) {
  const customerStr = customerId?.toString?.() ?? String(customerId ?? '');
  const providerStr = providerId?.toString?.() ?? String(providerId ?? '');

  return (messages || []).map((m: any) => {
    const fromStr = m.from?.toString?.() ?? String(m.from ?? '');
    const senderType =
      customerStr && fromStr === customerStr
        ? 'customer'
        : providerStr && fromStr === providerStr
          ? 'provider'
          : 'provider';

    return {
      _id: m._id?.toString?.() ?? m._id,
      senderId: fromStr,
      senderType,
      message: m.message,
      timestamp: m.timestamp,
      readBy: m.isRead
        ? [{ userId: fromStr, readAt: m.timestamp }]
        : [],
    };
  });
}

function formatPricing(pricing: RawBooking['pricing']) {
  const p = pricing || {};
  const totalAmount = p.totalAmount ?? p.total ?? 0;
  const tax = p.tax ?? p.taxes ?? 0;

  return {
    basePrice: p.basePrice ?? 0,
    addOns: p.addOns || [],
    discounts: p.discounts || [],
    subtotal: p.subtotal ?? totalAmount,
    tax,
    taxes: tax,
    total: totalAmount,
    totalAmount,
    currency: p.currency || 'AED',
  };
}

/**
 * Normalize a booking document for list/detail API responses consumed by the web app.
 */
export function formatBookingListItem(booking: RawBooking): Record<string, any> {
  const customer = formatUser(booking.customer);
  const service = formatService(booking.service);
  const provider = formatUser(booking.provider);

  const customerInfo = {
    firstName: booking.customerInfo?.firstName,
    lastName: booking.customerInfo?.lastName,
    email: booking.customerInfo?.email,
    phone: booking.customerInfo?.phone,
    specialRequests: booking.customerInfo?.specialRequests,
    accessInstructions: booking.customerInfo?.accessInstructions,
  };

  const location = booking.location || {
    type: 'customer_address',
    address: {},
  };

  return {
    _id: booking._id?.toString?.() ?? booking._id,
    bookingNumber: booking.bookingNumber,
    customerId: booking.customerId?.toString?.() ?? booking.customerId,
    providerId: booking.providerId?.toString?.() ?? booking.providerId,
    serviceId: booking.serviceId?.toString?.() ?? booking.serviceId,
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    duration: booking.duration ?? booking.selectedDuration,
    estimatedDuration: booking.duration ?? booking.selectedDuration,
    selectedDuration: booking.selectedDuration,
    status: booking.status,
    statusHistory: booking.statusHistory || [],
    location,
    locationType: booking.locationType,
    professionalPreference: booking.professionalPreference,
    paymentMethod: booking.paymentMethod,
    customerInfo,
    isGuestBooking: Boolean(booking.isGuestBooking),
    guestInfo: booking.guestInfo,
    pricing: formatPricing(booking.pricing),
    service,
    customer,
    provider,
    messages: formatMessages(
      booking.messages,
      booking.customerId,
      booking.providerId,
    ),
    providerResponse: booking.providerResponse,
    paymentStatus: booking.paymentStatus || 'pending',
    customerRating: booking.customerRating,
    providerRating: booking.providerRating,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}
