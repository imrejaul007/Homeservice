import React, { useState, useEffect } from 'react';
import {
  Calculator,
  DollarSign,
  Percent,
  Info,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  RefreshCw,
  Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface TaxBreakdown {
  rate: number;
  name: string;
  amount: number;
}

interface DepositTaxCalculatorProps {
  depositAmount: number;
  currency?: string;
  onAmountChange?: (amount: number) => void;
  showBreakdown?: boolean;
}

const TAX_RATES = {
  UAE: {
    VAT: { rate: 5, name: 'Value Added Tax (VAT)' },
    TOURISM: { rate: 10, name: 'Tourism Dirham Levy' },
    DISTRICT: { rate: 10, name: 'Dubai Municipality Fee' },
  },
};

const DepositTaxCalculator: React.FC<DepositTaxCalculatorProps> = ({
  depositAmount,
  currency = 'AED',
  onAmountChange,
  showBreakdown = true,
}) => {
  const [inputAmount, setInputAmount] = useState(depositAmount);
  const [taxJurisdiction, setTaxJurisdiction] = useState<'UAE' | 'OTHER'>('UAE');
  const [customRates, setCustomRates] = useState<{ [key: string]: number }>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    setInputAmount(depositAmount);
  }, [depositAmount]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const getTaxBreakdown = (): TaxBreakdown[] => {
    if (taxJurisdiction === 'OTHER') {
      return Object.entries(customRates).map(([name, rate]) => ({
        rate,
        name,
        amount: Math.round(inputAmount * (rate / 100) * 100) / 100,
      }));
    }

    return [
      {
        rate: TAX_RATES.UAE.VAT.rate,
        name: TAX_RATES.UAE.VAT.name,
        amount: Math.round(inputAmount * (TAX_RATES.UAE.VAT.rate / 100) * 100) / 100,
      },
      {
        rate: TAX_RATES.UAE.TOURISM.rate,
        name: TAX_RATES.UAE.TOURISM.name,
        amount: Math.round(inputAmount * (TAX_RATES.UAE.TOURISM.rate / 100) * 100) / 100,
      },
      {
        rate: TAX_RATES.UAE.DISTRICT.rate,
        name: TAX_RATES.UAE.DISTRICT.name,
        amount: Math.round(inputAmount * (TAX_RATES.UAE.DISTRICT.rate / 100) * 100) / 100,
      },
    ];
  };

  const taxBreakdown = getTaxBreakdown();
  const totalTax = taxBreakdown.reduce((sum, tax) => sum + tax.amount, 0);
  const totalAmount = inputAmount + totalTax;
  const totalTaxRate = taxBreakdown.reduce((sum, tax) => sum + tax.rate, 0);

  const handleAmountChange = (newAmount: number) => {
    setIsCalculating(true);
    setInputAmount(newAmount);

    setTimeout(() => {
      if (onAmountChange) {
        onAmountChange(newAmount);
      }
      setIsCalculating(false);
    }, 300);
  };

  const adjustAmount = (delta: number) => {
    const newAmount = Math.max(0, inputAmount + delta);
    handleAmountChange(newAmount);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calculator className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-nilin-charcoal">Tax Calculator</h3>
              <p className="text-xs text-nilin-gray">Calculate taxes on your deposit</p>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <div className="p-6 border-b border-gray-200">
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Deposit Amount
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustAmount(-50)}
              className="p-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
            >
              -50
            </button>
            <div className="flex-1 relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-gray" />
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => handleAmountChange(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-3 text-xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-center"
                min="0"
                step="0.01"
              />
            </div>
            <button
              onClick={() => adjustAmount(50)}
              className="p-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
            >
              +50
            </button>
          </div>

          {/* Quick Amounts */}
          <div className="flex gap-2 mt-3">
            {[100, 200, 500, 1000].map((amount) => (
              <button
                key={amount}
                onClick={() => handleAmountChange(amount)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-lg transition',
                  inputAmount === amount
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-nilin-gray hover:bg-gray-200'
                )}
              >
                {formatPrice(amount)}
              </button>
            ))}
          </div>

          {/* Jurisdiction Toggle */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-nilin-gray">Jurisdiction:</span>
            <div className="flex-1 flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setTaxJurisdiction('UAE')}
                className={cn(
                  'flex-1 py-2 text-sm font-medium transition',
                  taxJurisdiction === 'UAE'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-nilin-gray hover:bg-gray-50'
                )}
              >
                UAE
              </button>
              <button
                onClick={() => setTaxJurisdiction('OTHER')}
                className={cn(
                  'flex-1 py-2 text-sm font-medium transition',
                  taxJurisdiction === 'OTHER'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-nilin-gray hover:bg-gray-50'
                )}
              >
                Other
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className={cn('p-6 transition-opacity', isCalculating && 'opacity-50')}>
          {/* Subtotal */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-nilin-gray">Deposit Amount</span>
            <span className="text-lg font-medium text-nilin-charcoal">{formatPrice(inputAmount)}</span>
          </div>

          {/* Tax Breakdown */}
          {showBreakdown && (
            <div className="space-y-2 mb-4">
              {taxBreakdown.map((tax, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-nilin-gray" />
                    <span className="text-nilin-gray">{tax.name}</span>
                    <span className="text-nilin-gray">({tax.rate}%)</span>
                  </div>
                  <span className="text-orange-600 font-medium">+{formatPrice(tax.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200 my-4" />

          {/* Total */}
          <div className="flex justify-between items-center">
            <div>
              <span className="text-lg font-semibold text-nilin-charcoal">Total Amount</span>
              <p className="text-xs text-nilin-gray">Including {totalTaxRate}% taxes</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">{formatPrice(totalAmount)}</p>
              <p className="text-sm text-nilin-gray">Tax: {formatPrice(totalTax)}</p>
            </div>
          </div>

          {/* Tax Summary Badge */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Percent className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">
                Effective Tax Rate: {totalTaxRate}%
              </p>
              <p className="text-xs text-blue-600">
                {taxBreakdown.map(t => `${t.rate}% ${t.name.split(' ')[0]}`).join(' + ')}
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="border-t border-gray-200">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-4 flex items-center justify-between text-sm font-medium text-nilin-gray hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Advanced Settings
            </span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showAdvanced && (
            <div className="p-4 pt-0 space-y-4">
              {taxJurisdiction === 'OTHER' ? (
                <>
                  <p className="text-xs text-nilin-gray">
                    Configure custom tax rates for your region
                  </p>
                  {['VAT', 'Service Tax', 'Local Tax'].map((taxName) => (
                    <div key={taxName} className="flex items-center gap-3">
                      <label className="flex-1 text-sm text-nilin-charcoal">{taxName}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={customRates[taxName] || 0}
                          onChange={(e) =>
                            setCustomRates({
                              ...customRates,
                              [taxName]: Number(e.target.value),
                            })
                          }
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right"
                          min="0"
                          max="100"
                        />
                        <span className="text-nilin-gray">%</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-nilin-gray">
                    UAE tax configuration (standard rates):
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {taxBreakdown.map((tax, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-nilin-gray">{tax.name.split(' ')[0]}</p>
                        <p className="font-semibold text-nilin-charcoal">{tax.rate}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-start gap-2 text-xs text-nilin-gray">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Tax calculations are estimates only. Final amounts may vary based on specific
              transaction details and applicable regulations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepositTaxCalculator;
