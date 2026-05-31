import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  CreditCard,
  Plus,
  Minus,
  AlertCircle,
  Check,
  ArrowLeft
} from 'lucide-react';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import type { Service } from '../../types/search';
import type { CreateBookingData, BookingAddOn, AvailableSlot } from '../../services/BookingService';
import { cn, formatPrice } from '../../lib/utils';

interface BookingFormProps {
  service: Service;
  providerId: string;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
  className?: string;
}

interface FormData {
  scheduledDate: string;
  scheduledTime: string;
  locationType: 'customer_address' | 'provider_location' | 'online';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  customerInfo: {
    phone: string;
    specialRequests: string;
    accessInstructions: string;
  };
  addOns: BookingAddOn[];
  locationNotes: string;
}

const BookingForm: React.FC<BookingFormProps> = ({
  service,
  providerId,
  onSuccess,
  onCancel,
  className
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    createBooking,
    getAvailableSlots,
    availableSlots,
    isSubmitting,
    isLoading,
    errors,
    clearErrors
  } = useBookingStore();

  const [formData, setFormData] = useState<FormData>({
    scheduledDate: '',
    scheduledTime: '',
    locationType: 'customer_address',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'AE'
    },
    customerInfo: {
      phone: '',
      specialRequests: '',
      accessInstructions: ''
    },
    addOns: [],
    locationNotes: ''
  });

  const [step, setStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Available add-ons (in real app, this would come from service data)
  const availableAddOns: BookingAddOn[] = [
    { name: 'Premium Products', price: 75, description: 'Use premium, salon-grade products for your service' },
    { name: 'Express Finish', price: 50, description: 'Priority scheduling with faster service completion' }
  ];

  // Load available slots when date changes
  useEffect(() => {
    if (formData.scheduledDate && service.duration) {
      getAvailableSlots(providerId, {
        date: formData.scheduledDate,
        duration: service.duration,
        days: 1
      });
    }
  }, [formData.scheduledDate, providerId, service.duration, getAvailableSlots]);

  // Clear errors when form data changes
  useEffect(() => {
    if (errors.length > 0) {
      clearErrors();
    }
  }, [formData, clearErrors, errors.length]);

  const handleInputChange = (field: string, value: any) => {
    const keys = field.split('.');
    setFormData(prev => {
      const newData = { ...prev };
      let current: any = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const addAddOn = (addOn: BookingAddOn) => {
    setFormData(prev => ({
      ...prev,
      addOns: [...prev.addOns, addOn]
    }));
  };

  const removeAddOn = (index: number) => {
    setFormData(prev => ({
      ...prev,
      addOns: prev.addOns.filter((_, i) => i !== index)
    }));
  };

  const validateStep = (stepNumber: number): boolean => {
    const errors: Record<string, string> = {};

    switch (stepNumber) {
      case 1:
        if (!formData.scheduledDate) {
          errors.scheduledDate = 'Please select a date';
        }
        if (!formData.scheduledTime) {
          errors.scheduledTime = 'Please select a time';
        }
        break;

      case 2:
        if (formData.locationType === 'customer_address') {
          if (!formData.address.street) {
            errors['address.street'] = 'Street address is required';
          }
          if (!formData.address.city) {
            errors['address.city'] = 'City is required';
          }
          if (!formData.address.state) {
            errors['address.state'] = 'State is required';
          }
          if (!formData.address.zipCode) {
            errors['address.zipCode'] = 'ZIP code is required';
          }
        }
        break;

      case 3:
        if (!formData.customerInfo.phone) {
          errors['customerInfo.phone'] = 'Phone number is required';
        }
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const calculateTotal = () => {
    const basePrice = service.price.amount;
    const addOnTotal = formData.addOns.reduce((sum, addon) => sum + addon.price, 0);
    const subtotal = basePrice + addOnTotal;
    const taxRate = 0.05; // FIX: 5% UAE VAT rate (was 0.08)
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    return { basePrice, addOnTotal, subtotal, tax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(step)) {
      return;
    }

    try {
      const bookingData: CreateBookingData = {
        serviceId: service._id,
        providerId,
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        location: {
          type: formData.locationType,
          address: formData.locationType === 'customer_address' ? formData.address : undefined,
          notes: formData.locationNotes || undefined
        },
        customerInfo: {
          phone: formData.customerInfo.phone,
          specialRequests: formData.customerInfo.specialRequests || undefined,
          accessInstructions: formData.customerInfo.accessInstructions || undefined
        },
        addOns: formData.addOns,
        notes: formData.customerInfo.specialRequests || undefined
      };

      const booking = await createBooking(bookingData);

      if (onSuccess) {
        onSuccess(booking._id);
      } else {
        navigate(`/customer/bookings/${booking._id}`);
      }
    } catch (error) {
      console.error('Failed to create booking:', error);
    }
  };

  const renderDateTimeStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-nilin-charcoal mb-4 font-serif">When would you like this service?</h3>

        {/* Date Selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-nilin-warmGray">Select Date</label>
            <div className="relative card-nilin p-4 rounded-xl transition-all duration-300 hover:shadow-nilin-warm">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-nilin-rose" />
              <input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={cn(
                  "w-full pl-10 pr-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 transition-all duration-300",
                  validationErrors.scheduledDate ? "border-red-400" : "border-nilin-border bg-white/80 focus:border-nilin-coral"
                )}
              />
            </div>
            {validationErrors.scheduledDate && (
              <p className="mt-1 text-sm text-nilin-error">{validationErrors.scheduledDate}</p>
            )}
          </div>

          {/* Time Selection */}
          {formData.scheduledDate && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-nilin-warmGray">Available Times</label>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-nilin-coral"></div>
                </div>
              ) : availableSlots && availableSlots.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {availableSlots.map((slot) => (
                    <button
                      key={`${slot.date}-${slot.time}`}
                      type="button"
                      onClick={() => handleInputChange('scheduledTime', slot.time)}
                      className={cn(
                        "p-3 rounded-xl text-sm font-medium transition-all duration-300",
                        formData.scheduledTime === slot.time
                          ? "bg-nilin-coral text-white shadow-nilin-warm ring-2 ring-nilin-coral/30"
                          : slot.isAvailable
                          ? "card-nilin border-2 border-nilin-border bg-nilin-blush/30 hover:bg-nilin-peach/50 hover:border-nilin-coral hover:shadow-nilin-warm"
                          : "bg-nilin-muted/50 text-nilin-lightGray cursor-not-allowed border-2 border-nilin-border/30"
                      )}
                      disabled={!slot.isAvailable}
                    >
                      <Clock className="h-4 w-4 mb-1 mx-auto" />
                      {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="card-nilin p-8 rounded-xl text-center border-2 border-nilin-border/50 transition-all duration-300 hover:shadow-nilin-warm">
                  <Calendar className="h-12 w-12 mx-auto mb-2 text-nilin-rose/50" />
                  <p className="text-nilin-charcoal">No available times for this date</p>
                  <p className="text-sm text-nilin-warmGray">Please select a different date</p>
                </div>
              )}
              {validationErrors.scheduledTime && (
                <p className="mt-1 text-sm text-nilin-error">{validationErrors.scheduledTime}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderLocationStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-nilin-charcoal mb-4 font-serif">Where should we provide this service?</h3>

        {/* Location Type Selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-nilin-warmGray">Service Location</label>
            <div className="space-y-3">
              <label className="flex items-center card-nilin p-4 rounded-xl cursor-pointer transition-all duration-300 hover:bg-nilin-blush/20 hover:shadow-nilin-warm border-2 border-transparent">
                <input
                  type="radio"
                  name="locationType"
                  value="customer_address"
                  checked={formData.locationType === 'customer_address'}
                  onChange={(e) => handleInputChange('locationType', e.target.value)}
                  className="h-4 w-4 text-nilin-coral border-nilin-border focus:ring-nilin-rose"
                />
                <span className="ml-3 text-sm text-nilin-charcoal">At my address</span>
              </label>
              <label className="flex items-center card-nilin p-4 rounded-xl cursor-pointer transition-all duration-300 hover:bg-nilin-blush/20 hover:shadow-nilin-warm border-2 border-transparent">
                <input
                  type="radio"
                  name="locationType"
                  value="provider_location"
                  checked={formData.locationType === 'provider_location'}
                  onChange={(e) => handleInputChange('locationType', e.target.value)}
                  className="h-4 w-4 text-nilin-coral border-nilin-border focus:ring-nilin-rose"
                />
                <span className="ml-3 text-sm text-nilin-charcoal">At provider's location</span>
              </label>
              <label className="flex items-center card-nilin p-4 rounded-xl cursor-pointer transition-all duration-300 hover:bg-nilin-blush/20 hover:shadow-nilin-warm border-2 border-transparent">
                <input
                  type="radio"
                  name="locationType"
                  value="online"
                  checked={formData.locationType === 'online'}
                  onChange={(e) => handleInputChange('locationType', e.target.value)}
                  className="h-4 w-4 text-nilin-coral border-nilin-border focus:ring-nilin-rose"
                />
                <span className="ml-3 text-sm text-nilin-charcoal">Online/Virtual service</span>
              </label>
            </div>
          </div>

          {/* Customer Address Form */}
          {formData.locationType === 'customer_address' && (
            <div className="space-y-4 card-nilin p-6 rounded-xl transition-all duration-300 hover:shadow-nilin-warm">
              <div>
                <label className="block text-sm font-medium text-nilin-warmGray mb-1">Street Address</label>
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) => handleInputChange('address.street', e.target.value)}
                  placeholder="123 Main Street"
                  className={cn(
                    "w-full px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 transition-all duration-300",
                    validationErrors['address.street'] ? "border-red-400" : "border-nilin-border bg-white/80 focus:border-nilin-coral"
                  )}
                />
                {validationErrors['address.street'] && (
                  <p className="mt-1 text-sm text-nilin-error">{validationErrors['address.street']}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nilin-warmGray mb-1">City</label>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    placeholder="San Francisco"
                    className={cn(
                      "w-full px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 transition-all duration-300",
                      validationErrors['address.city'] ? "border-red-400" : "border-nilin-border bg-white/80 focus:border-nilin-coral"
                    )}
                  />
                  {validationErrors['address.city'] && (
                    <p className="mt-1 text-sm text-nilin-error">{validationErrors['address.city']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-nilin-warmGray mb-1">State</label>
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    placeholder="CA"
                    className={cn(
                      "w-full px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 transition-all duration-300",
                      validationErrors['address.state'] ? "border-red-400" : "border-nilin-border bg-white/80 focus:border-nilin-coral"
                    )}
                  />
                  {validationErrors['address.state'] && (
                    <p className="mt-1 text-sm text-nilin-error">{validationErrors['address.state']}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-warmGray mb-1">ZIP Code</label>
                <input
                  type="text"
                  value={formData.address.zipCode}
                  onChange={(e) => handleInputChange('address.zipCode', e.target.value)}
                  placeholder="94102"
                  className={cn(
                    "w-full px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 transition-all duration-300",
                    validationErrors['address.zipCode'] ? "border-red-400" : "border-nilin-border bg-white/80 focus:border-nilin-coral"
                  )}
                />
                {validationErrors['address.zipCode'] && (
                  <p className="mt-1 text-sm text-nilin-error">{validationErrors['address.zipCode']}</p>
                )}
              </div>
            </div>
          )}

          {/* Location Notes */}
          <div>
            <label className="block text-sm font-medium text-nilin-warmGray mb-1">
              Special Location Instructions (Optional)
            </label>
            <textarea
              value={formData.locationNotes}
              onChange={(e) => handleInputChange('locationNotes', e.target.value)}
              placeholder="e.g., Ring doorbell twice, use side entrance, etc."
              rows={3}
              className="w-full px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderContactStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-nilin-charcoal mb-4 font-serif">Contact Information & Preferences</h3>

        <div className="space-y-4">
          {/* Phone Number */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-nilin-warmGray">Phone Number</label>
            <div className="relative card-nilin p-4 rounded-xl transition-all duration-300 hover:shadow-nilin-warm">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-nilin-rose" />
              <input
                type="tel"
                value={formData.customerInfo.phone}
                onChange={(e) => handleInputChange('customerInfo.phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
                className={cn(
                  "w-full pl-10 pr-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 transition-all duration-300",
                  validationErrors['customerInfo.phone'] ? "border-red-400" : "border-nilin-border bg-white/80 focus:border-nilin-coral"
                )}
              />
            </div>
            {validationErrors['customerInfo.phone'] && (
              <p className="mt-1 text-sm text-nilin-error">{validationErrors['customerInfo.phone']}</p>
            )}
          </div>

          {/* Special Requests */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-nilin-warmGray">Special Requests (Optional)</label>
            <textarea
              value={formData.customerInfo.specialRequests}
              onChange={(e) => handleInputChange('customerInfo.specialRequests', e.target.value)}
              placeholder="Any specific requirements or preferences for the service..."
              rows={3}
              className="w-full px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
            />
          </div>

          {/* Access Instructions */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-nilin-warmGray">Access Instructions (Optional)</label>
            <textarea
              value={formData.customerInfo.accessInstructions}
              onChange={(e) => handleInputChange('customerInfo.accessInstructions', e.target.value)}
              placeholder="How should the provider access your property? Any security codes, parking instructions, etc."
              rows={3}
              className="w-full px-3 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 font-sans border-2 border-nilin-border bg-white/80 transition-all duration-300 focus:border-nilin-coral"
            />
          </div>

          {/* Add-ons */}
          <div>
            <label className="block text-sm font-medium text-nilin-warmGray mb-3">
              Additional Services (Optional)
            </label>

            {/* Available Add-ons */}
            <div className="space-y-3">
              {availableAddOns.map((addon, index) => {
                const isSelected = formData.addOns.some(selected => selected.name === addon.name);

                return (
                  <div key={index} className="card-nilin p-4 rounded-xl border-2 border-nilin-border/50 transition-all duration-300 hover:border-nilin-coral hover:shadow-nilin-warm">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-nilin-charcoal">{addon.name}</h4>
                          <span className="text-sm font-medium text-nilin-coral">
                            {formatPrice(addon.price, service.price.currency)}
                          </span>
                        </div>
                        {addon.description && (
                          <p className="text-sm text-nilin-warmGray mt-1">{addon.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => isSelected ? removeAddOn(formData.addOns.findIndex(a => a.name === addon.name)) : addAddOn(addon)}
                        className={cn(
                          "ml-4 p-2 rounded-full transition-all duration-300 btn-nilin",
                          isSelected
                            ? "bg-nilin-coral/20 text-nilin-coral hover:bg-nilin-coral/30"
                            : "bg-nilin-blush/50 text-nilin-rose hover:bg-nilin-peach hover:text-nilin-coral"
                        )}
                      >
                        {isSelected ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Add-ons Summary */}
            {formData.addOns.length > 0 && (
              <div className="card-nilin mt-4 p-4 rounded-xl bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20">
                <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Selected Additional Services:</h4>
                <div className="space-y-1">
                  {formData.addOns.map((addon, index) => (
                    <div key={index} className="flex justify-between text-sm text-nilin-charcoal">
                      <span>{addon.name}</span>
                      <span>{formatPrice(addon.price, service.price.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => {
    const { basePrice, addOnTotal, subtotal, tax, total } = calculateTotal();

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-nilin-charcoal mb-4 font-serif">Review Your Booking</h3>

          <div className="space-y-6">
            {/* Service Summary */}
            <div className="card-nilin p-4 rounded-xl bg-gradient-to-br from-nilin-blush/30 to-nilin-peach/20 transition-all duration-300 hover:shadow-nilin-warm">
              <h4 className="font-medium text-nilin-charcoal mb-3">Service Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Service:</span>
                  <span className="font-medium text-nilin-charcoal">{service.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Duration:</span>
                  <span className="text-nilin-charcoal">{service.duration} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Date & Time:</span>
                  <span className="text-nilin-charcoal">{new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Location:</span>
                  <span className="capitalize text-nilin-charcoal">{formData.locationType.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="card-nilin p-4 rounded-xl transition-all duration-300 hover:shadow-nilin-warm">
              <h4 className="font-medium text-nilin-charcoal mb-3">Pricing</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Base Service:</span>
                  <span className="text-nilin-charcoal">{formatPrice(basePrice, service.price.currency)}</span>
                </div>
                {formData.addOns.length > 0 && (
                  <>
                    {formData.addOns.map((addon, index) => (
                      <div key={index} className="flex justify-between text-nilin-warmGray">
                        <span>{addon.name}:</span>
                        <span className="text-nilin-charcoal">{formatPrice(addon.price, service.price.currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-nilin-border/30 pt-2">
                      <span className="text-nilin-warmGray">Add-ons Subtotal:</span>
                      <span className="text-nilin-charcoal">{formatPrice(addOnTotal, service.price.currency)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t border-nilin-border/30 pt-2">
                  <span className="text-nilin-warmGray">Subtotal:</span>
                  <span className="text-nilin-charcoal">{formatPrice(subtotal, service.price.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Taxes (5%):</span>
                  <span className="text-nilin-charcoal">{formatPrice(tax, service.price.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-nilin-border/30 pt-2 font-semibold text-lg">
                  <span className="text-nilin-charcoal">Total:</span>
                  <span className="text-nilin-coral">{formatPrice(total, service.price.currency)}</span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="card-nilin p-4 rounded-xl transition-all duration-300 hover:shadow-nilin-warm">
              <h4 className="font-medium text-nilin-charcoal mb-3">Contact Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Phone:</span>
                  <span className="text-nilin-charcoal">{formData.customerInfo.phone}</span>
                </div>
                {formData.customerInfo.specialRequests && (
                  <div>
                    <span className="text-nilin-warmGray">Special Requests:</span>
                    <p className="text-nilin-charcoal mt-1">{formData.customerInfo.specialRequests}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("max-w-2xl mx-auto", className)}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="card-nilin p-2 hover:bg-nilin-blush/30 rounded-full transition-all duration-300 hover:shadow-nilin-warm"
            >
              <ArrowLeft className="h-5 w-5 text-nilin-warmGray" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-nilin-charcoal font-serif">Book Service</h1>
            <p className="text-nilin-warmGray">{service.name}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                step >= stepNumber
                  ? "bg-nilin-coral text-white shadow-nilin-warm"
                  : "card-nilin text-nilin-warmGray"
              )}>
                {step > stepNumber ? <Check className="h-4 w-4" /> : stepNumber}
              </div>
              {stepNumber < 4 && (
                <div className={cn(
                  "flex-1 h-1 mx-2 rounded-full transition-all duration-500",
                  step > stepNumber ? "bg-nilin-coral" : "bg-nilin-muted/50"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-between text-xs text-nilin-warmGray -mt-2">
          <span>Date & Time</span>
          <span>Location</span>
          <span>Details</span>
          <span>Review</span>
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="card-nilin mb-6 p-4 rounded-xl bg-nilin-error/10 border-2 border-nilin-error/20 transition-all duration-300">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-nilin-error mr-2" />
            <h3 className="text-sm font-medium text-nilin-error">Please fix the following errors:</h3>
          </div>
          <ul className="mt-2 text-sm text-nilin-error/80 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step Content */}
        <div className="card-nilin rounded-2xl p-6 transition-all duration-300 hover:shadow-nilin-warm">
          {step === 1 && renderDateTimeStep()}
          {step === 2 && renderLocationStep()}
          {step === 3 && renderContactStep()}
          {step === 4 && renderReviewStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1}
            className={cn(
              "px-6 py-3 rounded-xl font-medium transition-all duration-300",
              step === 1
                ? "text-nilin-lightGray cursor-not-allowed"
                : "card-nilin text-nilin-warmGray hover:bg-nilin-blush/30 hover:shadow-nilin-warm"
            )}
          >
            Previous
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="btn-nilin px-6 py-3 rounded-xl font-medium hover:shadow-nilin-warm transition-all duration-300"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "btn-nilin px-8 py-3 rounded-xl font-medium transition-all duration-300 flex items-center shadow-nilin-warm",
                isSubmitting
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:shadow-lg"
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Booking...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Confirm Booking
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default BookingForm;
