import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Calendar,
  MapPin,
  Shield,
  Star,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Check,
  Plus,
  Minus,
  Info,
  Package
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Equipment {
  _id: string;
  equipmentId: string;
  name: string;
  description: string;
  category: string;
  manufacturer?: string;
  model?: string;
  condition: string;
  images: string[];
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  depositAmount: number;
  depositRefundable: boolean;
  maxRentalDays: number;
  minRentalDays: number;
  requiresLicense?: string;
  requiresTraining: boolean;
  status: string;
  location?: { address?: string; distance?: number };
  rating?: number;
  reviewCount?: number;
}

interface RentalBooking {
  equipment: Equipment;
  startDate: Date;
  endDate: Date;
  rentalDays: number;
  subtotal: number;
  discount: number;
  deposit: number;
  taxes: number;
  total: number;
}

interface EquipmentRentalProps {
  equipmentId?: string;
  onRent: (booking: RentalBooking) => void;
  onCancel: () => void;
}

const EquipmentRental: React.FC<EquipmentRentalProps> = ({
  equipmentId,
  onRent,
  onCancel,
}) => {
  const [step, setStep] = useState(1);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rentalDays, setRentalDays] = useState(1);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [pickupLocation, setPickupLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Mock fetch - in production, fetch from API
  useEffect(() => {
    const mockEquipment: Equipment = {
      _id: '1',
      equipmentId: 'EQ-001',
      name: 'Professional Steam Cleaner',
      description: 'Industrial-grade steam cleaner for deep cleaning carpets and upholstery. Includes multiple attachments for different surfaces.',
      category: 'cleaning',
      manufacturer: 'Karcher',
      model: 'SC4 Premium',
      condition: 'good',
      images: [],
      dailyRate: 150,
      weeklyRate: 750,
      monthlyRate: 2500,
      depositAmount: 500,
      depositRefundable: true,
      maxRentalDays: 30,
      minRentalDays: 1,
      requiresTraining: false,
      status: 'available',
      location: { address: 'Dubai Marina, Building 5', distance: 2.5 },
      rating: 4.8,
      reviewCount: 124,
    };

    setEquipment(mockEquipment);
    setIsLoading(false);
  }, [equipmentId]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const calculatePricing = (): RentalBooking | null => {
    if (!equipment) return null;

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + rentalDays);

    let subtotal = equipment.dailyRate * rentalDays;
    let discount = 0;

    if (rentalDays >= 30 && equipment.monthlyRate) {
      const months = Math.floor(rentalDays / 30);
      const remainingDays = rentalDays % 30;
      subtotal = (months * equipment.monthlyRate) + (remainingDays * equipment.dailyRate);
      discount = subtotal * 0.15;
    } else if (rentalDays >= 7 && equipment.weeklyRate) {
      const weeks = Math.floor(rentalDays / 7);
      const remainingDays = rentalDays % 7;
      subtotal = (weeks * equipment.weeklyRate) + (remainingDays * equipment.dailyRate);
      discount = subtotal * 0.08;
    }

    const taxes = (subtotal - discount) * 0.05;
    const total = subtotal - discount + taxes + (equipment.depositRefundable ? equipment.depositAmount : 0);

    return {
      equipment,
      startDate,
      endDate,
      rentalDays,
      subtotal,
      discount,
      deposit: equipment.depositAmount,
      taxes,
      total,
    };
  };

  const pricing = calculatePricing();

  const adjustDays = (delta: number) => {
    if (!equipment) return;
    const newDays = Math.max(equipment.minRentalDays, Math.min(equipment.maxRentalDays, rentalDays + delta));
    setRentalDays(newDays);
  };

  const handleConfirm = () => {
    if (pricing) {
      onRent(pricing);
    }
  };

  if (isLoading || !equipment) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-4 border-nilin-coral/30 border-t-nilin-coral rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : onCancel()}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-nilin-charcoal">Rent Equipment</h2>
          <p className="text-nilin-gray">Step {step} of 3</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              'flex-1 h-2 rounded-full transition-colors',
              s <= step ? 'bg-nilin-coral' : 'bg-gray-200'
            )}
          />
        ))}
      </div>

      {/* Step 1: Equipment Details */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                <Wrench className="h-10 w-10 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-nilin-charcoal">{equipment.name}</h3>
                <p className="text-sm text-nilin-gray mb-2">
                  {equipment.manufacturer} {equipment.model}
                </p>
                <div className="flex items-center gap-3">
                  {equipment.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="font-medium">{equipment.rating}</span>
                      <span className="text-sm text-nilin-gray">({equipment.reviewCount} reviews)</span>
                    </div>
                  )}
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium capitalize',
                    equipment.condition === 'new' ? 'bg-green-100 text-green-700' :
                    equipment.condition === 'good' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  )}>
                    {equipment.condition}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-nilin-coral">{formatPrice(equipment.dailyRate)}</p>
                <p className="text-sm text-nilin-gray">per day</p>
              </div>
            </div>

            <p className="mt-4 text-nilin-gray">{equipment.description}</p>

            {/* Pricing Tiers */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-nilin-gray">Daily</p>
                <p className="font-semibold">{formatPrice(equipment.dailyRate)}</p>
              </div>
              {equipment.weeklyRate && (
                <div className="text-center bg-green-50 rounded-lg py-2">
                  <p className="text-sm text-green-700">Weekly (-8%)</p>
                  <p className="font-semibold text-green-700">{formatPrice(equipment.weeklyRate)}</p>
                </div>
              )}
              {equipment.monthlyRate && (
                <div className="text-center bg-blue-50 rounded-lg py-2">
                  <p className="text-sm text-blue-700">Monthly (-15%)</p>
                  <p className="font-semibold text-blue-700">{formatPrice(equipment.monthlyRate)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Requirements */}
          {(equipment.requiresLicense || equipment.requiresTraining) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Requirements</p>
                {equipment.requiresLicense && (
                  <p className="text-sm text-amber-700">Valid {equipment.requiresLicense} required</p>
                )}
                {equipment.requiresTraining && (
                  <p className="text-sm text-amber-700">Training session required before pickup</p>
                )}
              </div>
            </div>
          )}

          {/* Deposit Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div className="flex-1">
                <p className="font-semibold text-nilin-charcoal">Security Deposit</p>
                <p className="text-sm text-nilin-gray">
                  {equipment.depositRefundable
                    ? 'Fully refundable upon equipment return in good condition'
                    : 'Non-refundable deposit included in total'}
                </p>
              </div>
              <p className="text-xl font-bold text-nilin-charcoal">{formatPrice(equipment.depositAmount)}</p>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full py-3 bg-nilin-coral text-white rounded-xl font-semibold hover:bg-nilin-coral/90 transition flex items-center justify-center gap-2"
          >
            Continue
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Step 2: Select Dates */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Date Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-nilin-charcoal mb-4">Rental Duration</h3>

            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => adjustDays(-1)}
                disabled={rentalDays <= (equipment?.minRentalDays || 1)}
                className="p-3 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Minus className="h-5 w-5" />
              </button>
              <div className="text-center min-w-[100px]">
                <p className="text-4xl font-bold text-nilin-charcoal">{rentalDays}</p>
                <p className="text-sm text-nilin-gray">day{rentalDays > 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => adjustDays(1)}
                disabled={rentalDays >= (equipment?.maxRentalDays || 30)}
                className="p-3 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Select */}
            <div className="flex gap-2 flex-wrap justify-center">
              {[1, 3, 7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setRentalDays(days)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition',
                    rentalDays === days
                      ? 'bg-nilin-coral text-white'
                      : 'bg-gray-100 text-nilin-gray hover:bg-gray-200'
                  )}
                >
                  {days === 1 ? '1 day' : days === 7 ? '1 week' : days === 30 ? '1 month' : `${days} days`}
                </button>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-nilin-charcoal mb-4">Pickup Date</h3>
            <input
              type="date"
              value={startDate.toISOString().split('T')[0]}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
            />
            <p className="text-sm text-nilin-gray mt-2">
              Return date: {new Date(startDate.getTime() + rentalDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </p>
          </div>

          {/* Pickup Location */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-nilin-charcoal mb-4">Pickup Location</h3>
            {equipment.location?.address && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-4">
                <MapPin className="h-5 w-5 text-nilin-coral" />
                <div>
                  <p className="font-medium">{equipment.location.address}</p>
                  {equipment.location.distance && (
                    <p className="text-sm text-nilin-gray">{equipment.location.distance}km away</p>
                  )}
                </div>
              </div>
            )}
            <input
              type="text"
              placeholder="Or enter a different pickup address"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
            />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-nilin-charcoal mb-4">Notes (Optional)</h3>
            <textarea
              placeholder="Any special requirements or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none resize-none"
            />
          </div>

          <button
            onClick={() => setStep(3)}
            className="w-full py-3 bg-nilin-coral text-white rounded-xl font-semibold hover:bg-nilin-coral/90 transition flex items-center justify-center gap-2"
          >
            Review Order
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Step 3: Review & Confirm */}
      {step === 3 && pricing && (
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-nilin-charcoal mb-4">Order Summary</h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                  <Wrench className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-nilin-charcoal">{equipment.name}</p>
                  <p className="text-sm text-nilin-gray">{equipment.manufacturer} {equipment.model}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-nilin-gray" />
                  <span className="text-nilin-gray">Duration:</span>
                  <span className="font-medium">{rentalDays} day{rentalDays > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-nilin-gray" />
                  <span className="text-nilin-gray">Dates:</span>
                  <span className="font-medium">
                    {startDate.toLocaleDateString()} - {new Date(startDate.getTime() + rentalDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                </div>
                {pickupLocation && (
                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="h-4 w-4 text-nilin-gray" />
                    <span className="text-nilin-gray">Pickup:</span>
                    <span className="font-medium">{pickupLocation}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-nilin-charcoal mb-4">Price Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-nilin-gray">
                  {rentalDays} day{rentalDays > 1 ? 's' : ''} x {formatPrice(equipment.dailyRate)}
                </span>
                <span className="font-medium">{formatPrice(equipment.dailyRate * rentalDays)}</span>
              </div>
              {pricing.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(pricing.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-nilin-gray">Subtotal</span>
                <span className="font-medium">{formatPrice(pricing.subtotal - pricing.discount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nilin-gray">VAT (5%)</span>
                <span className="font-medium">{formatPrice(pricing.taxes)}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span className="flex items-center gap-1">
                  Security Deposit {equipment.depositRefundable ? '(refundable)' : ''}
                  <Info className="h-3 w-3" />
                </span>
                <span className="font-medium">{formatPrice(pricing.deposit)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200">
                <span className="text-lg font-bold text-nilin-charcoal">Total</span>
                <span className="text-xl font-bold text-nilin-coral">{formatPrice(pricing.total)}</span>
              </div>
            </div>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 w-5 h-5 text-nilin-coral border-gray-300 rounded focus:ring-nilin-coral"
            />
            <span className="text-sm text-nilin-gray">
              I agree to the rental terms and conditions. I understand that:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Equipment must be returned in the same condition</li>
                <li>Late returns may incur additional charges</li>
                <li>Damage will be deducted from the security deposit</li>
              </ul>
            </span>
          </label>

          <button
            onClick={handleConfirm}
            disabled={!acceptedTerms}
            className={cn(
              'w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2',
              acceptedTerms
                ? 'bg-nilin-coral text-white hover:bg-nilin-coral/90'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            )}
          >
            <Package className="h-5 w-5" />
            Confirm Rental - {formatPrice(pricing.total)}
          </button>
        </div>
      )}
    </div>
  );
};

export default EquipmentRental;
