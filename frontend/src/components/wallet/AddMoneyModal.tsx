// Add Money Modal Component
import React, { useState } from 'react';
import { X, CreditCard, Loader2, Check, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { showDeduplicatedError } from '../../utils/toastUtils';
import { customerWalletApi, WalletApiError } from '../../services/walletApi';
import { formatCurrency } from '../../utils/formatting';
import { WalletTopUpPayment } from './WalletTopUpPayment';

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (amount: number, newBalance: number, pendingBalance?: number) => void;
}

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000];
const MIN_TOP_UP_AMOUNT = 10;
const MAX_TOP_UP_AMOUNT = 10000;

type ModalStep = 'amount' | 'payment';

export function AddMoneyModal({ isOpen, onClose, onSuccess }: AddMoneyModalProps) {
  const [amount, setAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ModalStep>('amount');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  const resetModal = () => {
    setStep('amount');
    setAmount(500);
    setCustomAmount('');
    setIsCustom(false);
    setClientSecret(null);
    setPaymentIntentId(null);
    setIdempotencyKey('');
    setError(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handlePresetClick = (value: number) => {
    setAmount(value);
    setIsCustom(false);
    setCustomAmount('');
    setError(null);
  };

  const handleCustomChange = (value: string) => {
    setCustomAmount(value);
    if (value === '') {
      // Reset to default amount when cleared — prevents stale value
      setAmount(500);
      setIsCustom(false);
      setError(null);
      return;
    }
    const num = Number(value);
    setIsCustom(true);

    if (Number.isFinite(num)) {
      // Keep amount in sync with user input to avoid stale top-up values.
      setAmount(num);
      if (num > 0) {
        setError(null);
      }
      return;
    }

    // Invalid numeric input should never keep an older valid amount.
    setAmount(0);
  };

  const completeTopUp = async (intentId: string, topUpAmount: number, key: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await customerWalletApi.addMoney({
        paymentIntentId: intentId,
        amount: topUpAmount,
        idempotencyKey: key,
      });

      if (response.success) {
        toast.success('Wallet topped up successfully!');
        onSuccess(topUpAmount, response.data.newBalance, response.data.pendingBalance);
        handleClose();
      } else {
        const message = response.message || 'Failed to add money';
        setError(message);
        showDeduplicatedError('Failed to add money', message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to credit wallet. Please contact support.';
      setError(message);
      showDeduplicatedError(
        'Top-up may have succeeded but wallet not updated',
        'Please contact support with your payment reference'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount < MIN_TOP_UP_AMOUNT) {
      setError(`Minimum amount is ${formatCurrency(MIN_TOP_UP_AMOUNT, 'AED')}`);
      return;
    }

    if (amount > MAX_TOP_UP_AMOUNT) {
      setError(`Maximum amount is ${formatCurrency(MAX_TOP_UP_AMOUNT, 'AED')} per transaction`);
      return;
    }

    setIsLoading(true);
    setError(null);

    const key = `topup-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setIdempotencyKey(key);

    try {
      const intentResponse = await customerWalletApi.createTopUpIntent({
        amount,
        idempotencyKey: key,
      });

      if (!intentResponse.success) {
        setError('Failed to initialize payment');
        return;
      }

      const { clientSecret: secret, paymentIntentId: intentId, simulated } = intentResponse.data;
      setPaymentIntentId(intentId);

      if (simulated) {
        await completeTopUp(intentId, amount, key);
      } else {
        setClientSecret(secret);
        setStep('payment');
      }
    } catch (err) {
      if (err instanceof WalletApiError) {
        if (err.statusCode === 502) {
          setError('Payment service is temporarily unavailable. Please try again shortly.');
        } else if (err.statusCode === 401) {
          setError('Your session has expired. Please sign in again.');
        } else {
          setError(err.message || 'Failed to initialize payment. Please try again.');
        }
      } else {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error.message || 'Failed to initialize payment. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async (confirmedIntentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await completeTopUp(confirmedIntentId, amount, idempotencyKey);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message || 'Failed to credit wallet');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-money-title"
          >
            <div
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  {step === 'payment' && (
                    <button
                      onClick={() => setStep('amount')}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      aria-label="Back to amount selection"
                    >
                      <ArrowLeft className="w-5 h-5 text-nilin-warmGray" />
                    </button>
                  )}
                  <h2 id="add-money-title" className="text-lg font-bold text-nilin-charcoal">
                    {step === 'amount' ? 'Add Money' : 'Complete Payment'}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close add money dialog"
                >
                  <X className="w-5 h-5 text-nilin-warmGray" />
                </button>
              </div>

              <div className="p-5 sm:p-6">
                {step === 'amount' ? (
                  <>
                    <div className="text-center mb-6">
                      <p className="text-sm text-nilin-warmGray mb-1">Amount to add</p>
                      <p className="text-4xl font-bold text-nilin-charcoal">{formatCurrency(amount, 'AED')}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                      {PRESET_AMOUNTS.map((value) => (
                        <button
                          key={value}
                          onClick={() => handlePresetClick(value)}
                          className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                            !isCustom && amount === value
                              ? 'bg-nilin-coral text-white'
                              : 'bg-nilin-blush text-nilin-charcoal hover:bg-nilin-peach'
                          }`}
                        >
                          AED {value.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    <div className="mb-4">
                      <label htmlFor="custom-amount" className="text-sm text-nilin-warmGray mb-2 block">Or enter custom amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-charcoal font-medium">AED</span>
                        <input
                          type="number"
                          id="custom-amount"
                          value={customAmount}
                          onChange={(e) => handleCustomChange(e.target.value)}
                          placeholder="Enter amount"
                          min={MIN_TOP_UP_AMOUNT}
                          step="1"
                          aria-label="Enter custom amount"
                          className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 focus:border-nilin-coral"
                        />
                      </div>
                    </div>

                    <div className="mb-4 flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-nilin-blush/20">
                      <CreditCard className="w-5 h-5 text-nilin-warmGray" />
                      <div>
                        <p className="text-sm font-medium text-nilin-charcoal">Secure card payment</p>
                        <p className="text-xs text-nilin-warmGray">Powered by Stripe</p>
                      </div>
                    </div>

                    {error && (
                      <div className="mb-4 p-3 bg-nilin-error/10 border border-nilin-error/20 rounded-xl" role="alert">
                        <p className="text-sm text-nilin-charcoal">{error}</p>
                      </div>
                    )}

                    <button
                      onClick={handleContinue}
                      disabled={isLoading || amount <= 0}
                      className="w-full py-3 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Continue — {formatCurrency(amount, 'AED')}
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-nilin-warmGray mb-4 text-center">
                      Pay {formatCurrency(amount, 'AED')} to add to your wallet
                    </p>
                    {clientSecret && paymentIntentId && (
                      <WalletTopUpPayment
                        clientSecret={clientSecret}
                        amount={amount}
                        onSuccess={handlePaymentSuccess}
                        onError={setError}
                      />
                    )}
                    {error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl" role="alert">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}
                  </>
                )}

                <p className="text-xs text-center text-nilin-warmGray mt-4">
                  Secured by 256-bit encryption
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AddMoneyModal;
