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
    const taxRate = 0.08; // 8% tax rate
    const taxes = subtotal * taxRate;
    const total = subtotal + taxes;

    return { basePrice, addOnTotal, subtotal, taxes, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(step)) {
      return;
    }

    try {
      // Debug logging for booking creation
      console.log('🔍 Booking Creation Debug:', {
        serviceId: service._id,
        providerId,
        serviceName: service.name
      });

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
        <h3 className="text-lg font-medium text-gray-900 mb-4">When would you like this service?</h3>

        {/* Date Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={cn(
                  "w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  validationErrors.scheduledDate ? "border-red-300" : "border-gray-300"
                )}
              />
            </div>
            {validationErrors.scheduledDate && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.scheduledDate}</p>
            )}
          </div>

          {/* Time Selection */}
          {formData.scheduledDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Times
              </label>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : availableSlots && availableSlots.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {availableSlots.map((slot) => (
                    <button
                      key={`${slot.date}-${slot.time}`}
                      type="button"
                      onClick={() => handleInputChange('scheduledTime', slot.time)}
                      className={cn(
                        "p-3 border rounded-lg text-sm font-medium transition-colors",
                        formData.scheduledTime === slot.time
                          ? "bg-blue-500 text-white border-blue-500"
                          : slot.isAvailable
                          ? "border-gray-300 hover:border-blue-300 hover:bg-blue-50"
                          : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                      )}
                      disabled={!slot.isAvailable}
                    >
                      <Clock className="h-4 w-4 mb-1 mx-auto" />
                      {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No available times for this date</p>
                  <p className="text-sm">Please select a different date</p>
                </div>
              )}
              {validationErrors.scheduledTime && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.scheduledTime}</p>
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">Where should we provide this service?</h3>

        {/* Location Type Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Service Location</label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="locationType"
                  value="customer_address"
                  checked={formData.locationType === 'customer_address'}
                  onChange={(e) => handleInputChange('locationType', e.target.value)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm text-gray-700">At my address</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="locationType"
                  value="provider_location"
                  checked={formData.locationType === 'provider_location'}
                  onChange={(e) => handleInputChange('locationType', e.target.value)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm text-gray-700">At provider's location</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="locationType"
                  value="online"
                  checked={formData.locationType === 'online'}
                  onChange={(e) => handleInputChange('locationType', e.target.value)}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm text-gray-700">Online/Virtual service</span>
              </label>
            </div>
          </div>

          {/* Customer Address Form */}
          {formData.locationType === 'customer_address' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) => handleInputChange('address.street', e.target.value)}
                  placeholder="123 Main Street"
                  className={cn(
                    "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                    validationErrors['address.street'] ? "border-red-300" : "border-gray-300"
                  )}
                />
                {validationErrors['address.street'] && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors['address.street']}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    placeholder="San Francisco"
                    className={cn(
                      "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                      validationErrors['address.city'] ? "border-red-300" : "border-gray-300"
                    )}
                  />
                  {validationErrors['address.city'] && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors['address.city']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    placeholder="CA"
                    className={cn(
                      "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                      validationErrors['address.state'] ? "border-red-300" : "border-gray-300"
                    )}
                  />
                  {validationErrors['address.state'] && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors['address.state']}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                <input
                  type="text"
                  value={formData.address.zipCode}
                  onChange={(e) => handleInputChange('address.zipCode', e.target.value)}
                  placeholder="94102"
                  className={cn(
                    "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                    validationErrors['address.zipCode'] ? "border-red-300" : "border-gray-300"
                  )}
                />
                {validationErrors['address.zipCode'] && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors['address.zipCode']}</p>
                )}
              </div>
            </div>
          )}

          {/* Location Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Location Instructions (Optional)
            </label>
            <textarea
              value={formData.locationNotes}
              onChange={(e) => handleInputChange('locationNotes', e.target.value)}
              placeholder="e.g., Ring doorbell twice, use side entrance, etc."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderContactStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information & Preferences</h3>

        <div className="space-y-4">
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="tel"
                value={formData.customerInfo.phone}
                onChange={(e) => handleInputChange('customerInfo.phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
                className={cn(
                  "w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  validationErrors['customerInfo.phone'] ? "border-red-300" : "border-gray-300"
                )}
              />
            </div>
            {validationErrors['customerInfo.phone'] && (
              <p className="mt-1 text-sm text-red-600">{validationErrors['customerInfo.phone']}</p>
            )}
          </div>

          {/* Special Requests */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Requests (Optional)
            </label>
            <textarea
              value={formData.customerInfo.specialRequests}
              onChange={(e) => handleInputChange('customerInfo.specialRequests', e.target.value)}
              placeholder="Any specific requirements or preferences for the service..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Access Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Instructions (Optional)
            </label>
            <textarea
              value={formData.customerInfo.accessInstructions}
              onChange={(e) => handleInputChange('customerInfo.accessInstructions', e.target.value)}
              placeholder="How should the provider access your property? Any security codes, parking instructions, etc."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Add-ons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Additional Services (Optional)
            </label>

            {/* Available Add-ons */}
            <div className="space-y-3">
              {availableAddOns.map((addon, index) => {
                const isSelected = formData.addOns.some(selected => selected.name === addon.name);

                return (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900">{addon.name}</h4>
                        <span className="text-sm font-medium text-gray-900">
                          {formatPrice(addon.price, service.price.currency)}
                        </span>
                      </div>
                      {addon.description && (
                        <p className="text-sm text-gray-500 mt-1">{addon.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => isSelected ? removeAddOn(formData.addOns.findIndex(a => a.name === addon.name)) : addAddOn(addon)}
                      className={cn(
                        "ml-4 p-2 rounded-full transition-colors",
                        isSelected
                          ? "bg-red-100 text-red-600 hover:bg-red-200"
                          : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                      )}
                    >
                      {isSelected ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Selected Add-ons Summary */}
            {formData.addOns.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Selected Additional Services:</h4>
                <div className="space-y-1">
                  {formData.addOns.map((addon, index) => (
                    <div key={index} className="flex justify-between text-sm text-blue-800">
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
    const { basePrice, addOnTotal, subtotal, taxes, total } = calculateTotal();

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Review Your Booking</h3>

          <div className="space-y-6">
            {/* Service Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Service Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Service:</span>
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span>{service.duration} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date & Time:</span>
                  <span>{new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="capitalize">{formData.locationType.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Pricing</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Service:</span>
                  <span>{formatPrice(basePrice, service.price.currency)}</span>
                </div>
                {formData.addOns.length > 0 && (
                  <>
                    {formData.addOns.map((addon, index) => (
                      <div key={index} className="flex justify-between text-gray-600">
                        <span>{addon.name}:</span>
                        <span>{formatPrice(addon.price, service.price.currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600">Add-ons Subtotal:</span>
                      <span>{formatPrice(addOnTotal, service.price.currency)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{formatPrice(subtotal, service.price.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxes (8%):</span>
                  <span>{formatPrice(taxes, service.price.currency)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold text-lg">
                  <span>Total:</span>
                  <span>{formatPrice(total, service.price.currency)}</span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Contact Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span>{formData.customerInfo.phone}</span>
                </div>
                {formData.customerInfo.specialRequests && (
                  <div>
                    <span className="text-gray-600">Special Requests:</span>
                    <p className="text-gray-800 mt-1">{formData.customerInfo.specialRequests}</p>
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
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Book Service</h1>
            <p className="text-gray-600">{service.name}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step >= stepNumber
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-600"
              )}>
                {step > stepNumber ? <Check className="h-4 w-4" /> : stepNumber}
              </div>
              {stepNumber < 4 && (
                <div className={cn(
                  "flex-1 h-1 mx-2",
                  step > stepNumber ? "bg-blue-500" : "bg-gray-200"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-between text-xs text-gray-500 -mt-2">
          <span>Date & Time</span>
          <span>Location</span>
          <span>Details</span>
          <span>Review</span>
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
          </div>
          <ul className="mt-2 text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step Content */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
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
              "px-6 py-2 rounded-lg font-medium transition-colors",
              step === 1
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            Previous
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "px-8 py-2 bg-green-500 text-white rounded-lg font-medium transition-colors flex items-center",
                isSubmitting
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-green-600"
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