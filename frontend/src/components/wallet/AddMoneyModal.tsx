// Add Money Modal Component
import React, { useState } from 'react';
import { X, CreditCard, Smartphone, Wallet, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { walletApi } from '../../services/walletApi';
import { formatCurrency } from '../../utils/formatting';

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (amount: number, newBalance: number) => void;
}

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000];

export function AddMoneyModal({ isOpen, onClose, onSuccess }: AddMoneyModalProps) {
  const [amount, setAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePresetClick = (value: number) => {
    setAmount(value);
    setIsCustom(false);
    setCustomAmount('');
    setError(null);
  };

  const handleCustomChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setAmount(num);
      setIsCustom(true);
      setError(null);
    }
    setCustomAmount(value);
  };

  const handleSubmit = async () => {
    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount < 10) {
      setError(`Minimum amount is ${formatCurrency(10, 'AED')}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await walletApi.addMoney({
        amount,
        idempotencyKey: `topup-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      });

      if (response.success) {
        onSuccess(amount, response.data.newBalance);
        onClose();
      } else {
        setError(response.message || 'Failed to add money');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add money. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md z-50"
          >
            <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-nilin-charcoal">Add Money</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-nilin-warmGray" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Amount Display */}
                <div className="text-center mb-6">
                  <p className="text-sm text-nilin-warmGray mb-1">Amount to add</p>
                  <p className="text-4xl font-bold text-nilin-charcoal">{formatCurrency(amount, 'AED')}</p>
                </div>

                {/* Preset Amounts */}
                <div className="grid grid-cols-5 gap-2 mb-4">
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
                      {formatCurrency(value, 'AED')}
                    </button>
                  ))}
                </div>

                {/* Custom Amount */}
                <div className="mb-4">
                  <label className="text-sm text-nilin-warmGray mb-2 block">Or enter custom amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-charcoal font-medium">AED</span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 focus:border-nilin-coral"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="mb-4">
                  <label className="text-sm text-nilin-warmGray mb-2 block">Payment Method</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:border-nilin-coral has-[:checked]:border-nilin-coral has-[:checked]:bg-nilin-blush/30 transition-colors">
                      <input type="radio" name="payment" value="card" defaultChecked className="accent-nilin-coral" />
                      <CreditCard className="w-5 h-5 text-nilin-warmGray" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-nilin-charcoal">Credit/Debit Card</p>
                        <p className="text-xs text-nilin-warmGray">Visa, Mastercard, RuPay</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:border-nilin-coral has-[:checked]:border-nilin-coral has-[:checked]:bg-nilin-blush/30 transition-colors">
                      <input type="radio" name="payment" value="upi" className="accent-nilin-coral" />
                      <Smartphone className="w-5 h-5 text-nilin-warmGray" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-nilin-charcoal">UPI</p>
                        <p className="text-xs text-nilin-warmGray">GPay, PhonePe, Paytm</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:border-nilin-coral has-[:checked]:border-nilin-coral has-[:checked]:bg-nilin-blush/30 transition-colors">
                      <input type="radio" name="payment" value="netbanking" className="accent-nilin-coral" />
                      <Wallet className="w-5 h-5 text-nilin-warmGray" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-nilin-charcoal">Net Banking</p>
                        <p className="text-xs text-nilin-warmGray">All major banks</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Add Button */}
                <button
                  onClick={handleSubmit}
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
                      Add {formatCurrency(amount, 'AED')}
                    </>
                  )}
                </button>

                {/* Security Note */}
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
