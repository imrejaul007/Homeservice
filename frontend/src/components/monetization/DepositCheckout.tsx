import React, { useState } from 'react';
import {
  CreditCard,
  Shield,
  Lock,
  AlertCircle,
  Check,
  ArrowRight,
  Info,
  Timer
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DepositCheckoutProps {
  bookingValue: number;
  depositPercentage?: number;
  depositAmount: number;
  currency?: string;
  onPaymentComplete: (paymentDetails: {
    paymentId: string;
    amount: number;
    method: string;
  }) => Promise<void>;
  onCancel: () => void;
  serviceName?: string;
  scheduledDate?: Date;
  providerName?: string;
}

const DepositCheckout: React.FC<DepositCheckoutProps> = ({
  bookingValue,
  depositPercentage = 20,
  depositAmount,
  currency = 'AED',
  onPaymentComplete,
  onCancel,
  serviceName = 'Service',
  scheduledDate,
  providerName,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'wallet'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: '',
  });
  const [saveCard, setSaveCard] = useState(false);

  const remainingAmount = bookingValue - depositAmount;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-AE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const handlePayment = async () => {
    setError(null);

    // Basic validation
    if (selectedMethod === 'card') {
      if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc || !cardDetails.name) {
        setError('Please fill in all card details');
        return;
      }
    }

    try {
      setIsProcessing(true);

      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      await onPaymentComplete({
        paymentId,
        amount: depositAmount,
        method: selectedMethod,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-nilin-charcoal">
          Secure Your Booking
        </h2>
        <p className="text-nilin-gray mt-1">
          Pay a deposit to confirm your {serviceName}
        </p>
      </div>

      {/* Booking Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <CreditCard className="h-6 w-6 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-nilin-charcoal">{serviceName}</h3>
            {providerName && (
              <p className="text-sm text-nilin-gray">by {providerName}</p>
            )}
            {scheduledDate && (
              <p className="text-sm text-nilin-gray flex items-center gap-1 mt-1">
                <Timer className="h-3 w-3" />
                {formatDate(scheduledDate)}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 mt-4 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-nilin-gray">Booking Value</span>
            <span className="text-nilin-charcoal">{formatPrice(bookingValue)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-nilin-gray">Due Today (Deposit)</span>
            <span className="font-semibold text-nilin-coral">{formatPrice(depositAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-nilin-gray">Due Later</span>
            <span className="text-nilin-charcoal">{formatPrice(remainingAmount)}</span>
          </div>
        </div>
      </div>

      {/* Deposit Info */}
      <div className="bg-blue-50 rounded-lg p-3 mb-4 flex items-start gap-2">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Why pay a deposit?</p>
          <p className="mt-1">
            A {depositPercentage}% deposit secures your booking and shows commitment.
            The remaining {formatPrice(remainingAmount)} is paid directly to the provider on service day.
          </p>
        </div>
      </div>

      {/* Payment Method Selection */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <h3 className="font-semibold text-nilin-charcoal mb-4">
          Payment Method
        </h3>

        <div className="space-y-3">
          <label
            className={cn(
              'flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all',
              selectedMethod === 'card'
                ? 'border-nilin-coral bg-nilin-coral/5 ring-2 ring-nilin-coral/20'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="card"
              checked={selectedMethod === 'card'}
              onChange={() => setSelectedMethod('card')}
              className="sr-only"
            />
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              selectedMethod === 'card' ? 'bg-nilin-coral' : 'bg-gray-100'
            )}>
              <CreditCard className={cn(
                'h-5 w-5',
                selectedMethod === 'card' ? 'text-white' : 'text-gray-500'
              )} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-nilin-charcoal">Credit/Debit Card</p>
              <p className="text-sm text-nilin-gray">Visa, Mastercard, Amex</p>
            </div>
            {selectedMethod === 'card' && (
              <Check className="h-5 w-5 text-nilin-coral" />
            )}
          </label>

          <label
            className={cn(
              'flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all',
              selectedMethod === 'wallet'
                ? 'border-nilin-coral bg-nilin-coral/5 ring-2 ring-nilin-coral/20'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="wallet"
              checked={selectedMethod === 'wallet'}
              onChange={() => setSelectedMethod('wallet')}
              className="sr-only"
            />
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              selectedMethod === 'wallet' ? 'bg-nilin-coral' : 'bg-gray-100'
            )}>
              <Shield className={cn(
                'h-5 w-5',
                selectedMethod === 'wallet' ? 'text-white' : 'text-gray-500'
              )} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-nilin-charcoal">Wallet Balance</p>
              <p className="text-sm text-nilin-gray">Pay with your account balance</p>
            </div>
            {selectedMethod === 'wallet' && (
              <Check className="h-5 w-5 text-nilin-coral" />
            )}
          </label>
        </div>
      </div>

      {/* Card Details (if card selected) */}
      {selectedMethod === 'card' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <h3 className="font-semibold text-nilin-charcoal mb-4">
            Card Details
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Card Number
              </label>
              <input
                type="text"
                value={cardDetails.number}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                  const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                  setCardDetails({ ...cardDetails, number: formatted });
                }}
                placeholder="1234 5678 9012 3456"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Expiry Date
                </label>
                <input
                  type="text"
                  value={cardDetails.expiry}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (value.length >= 2) {
                      value = value.slice(0, 2) + '/' + value.slice(2);
                    }
                    setCardDetails({ ...cardDetails, expiry: value });
                  }}
                  placeholder="MM/YY"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  CVC
                </label>
                <input
                  type="text"
                  value={cardDetails.cvc}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setCardDetails({ ...cardDetails, cvc: value });
                  }}
                  placeholder="123"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Cardholder Name
              </label>
              <input
                type="text"
                value={cardDetails.name}
                onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                placeholder="John Doe"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none transition"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveCard}
                onChange={(e) => setSaveCard(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-nilin-coral focus:ring-nilin-coral/20"
              />
              <span className="text-sm text-nilin-gray">Save card for future payments</span>
            </label>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="flex items-center justify-center gap-2 text-sm text-nilin-gray mb-4">
        <Lock className="h-4 w-4" />
        <span>Your payment is secured with 256-bit encryption</span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-semibold text-nilin-charcoal hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className={cn(
            'flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2',
            isProcessing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
          )}
        >
          {isProcessing ? (
            <>
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Pay {formatPrice(depositAmount)}
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DepositCheckout;
