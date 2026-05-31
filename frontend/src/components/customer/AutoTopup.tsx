import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  CreditCard,
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  ChevronRight,
  Plus,
  Minus,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  TrendingUp,
  History,
  Eye,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../utils/formatting';
import { autoTopupApi, type AutoTopupConfig, type AutoTopupLog, type AutoTopupPreview } from '../../services/autoTopupApi';

interface AutoTopupProps {
  compact?: boolean;
  onConfigChange?: () => void;
}

interface PaymentMethodOption {
  id: string;
  type: 'card' | 'bank_account' | 'wallet';
  last4?: string;
  brand?: string;
  isDefault?: boolean;
}

export const AutoTopup: React.FC<AutoTopupProps> = ({
  compact = false,
  onConfigChange,
}) => {
  // State
  const [config, setConfig] = useState<AutoTopupConfig | null>(null);
  const [preview, setPreview] = useState<AutoTopupPreview | null>(null);
  const [logs, setLogs] = useState<AutoTopupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [thresholdAmount, setThresholdAmount] = useState(50);
  const [topupAmount, setTopupAmount] = useState(100);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodOption | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Mock payment methods (in production, fetch from payment API)
  const paymentMethods: PaymentMethodOption[] = [
    { id: 'pm_1', type: 'card', last4: '4242', brand: 'Visa', isDefault: true },
    { id: 'pm_2', type: 'card', last4: '5555', brand: 'Mastercard' },
  ];

  // Fetch data
  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [configData, previewData, historyData] = await Promise.all([
        autoTopupApi.getConfig(),
        autoTopupApi.preview(),
        autoTopupApi.getHistory({ limit: 10 }),
      ]);

      setConfig(configData.config);
      setPreview(previewData);
      setLogs(historyData.logs);

      if (configData.config) {
        setEnabled(configData.config.enabled);
        setThresholdAmount(configData.config.thresholdAmount);
        setTopupAmount(configData.config.topupAmount);
        const defaultMethod = paymentMethods.find(
          (pm) => pm.id === configData.config?.paymentMethodId
        );
        setSelectedPaymentMethod(defaultMethod || paymentMethods[0]);
      } else {
        setSelectedPaymentMethod(paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0]);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load auto-topup data';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save configuration
  const handleSave = async () => {
    if (!selectedPaymentMethod) return;

    setSaving(true);
    try {
      await autoTopupApi.updateConfig({
        enabled,
        thresholdAmount,
        topupAmount,
        paymentMethodId: selectedPaymentMethod.id,
        paymentMethodType: selectedPaymentMethod.type,
        paymentMethodLast4: selectedPaymentMethod.last4,
        paymentMethodBrand: selectedPaymentMethod.brand,
        maxAutoTopupsPerMonth: 5,
        maxAutoTopupAmount: 500,
      });

      onConfigChange?.();
      setShowSettings(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  // Toggle auto-topup
  const handleToggle = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);

    try {
      await autoTopupApi.toggle(newEnabled);
      onConfigChange?.();
      fetchData();
    } catch (err) {
      setEnabled(!newEnabled); // Revert on error
      console.error('Failed to toggle:', err);
    }
  };

  // Quick amount adjustments
  const adjustAmount = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    current: number,
    delta: number,
    min = 10,
    max = 500
  ) => {
    const newValue = Math.max(min, Math.min(max, current + delta));
    setter(newValue);
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (compact) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <span className="font-medium text-nilin-charcoal">Auto-Topup</span>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-4 h-4 text-gray-400', refreshing && 'animate-spin')} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className={cn(
              'text-sm font-medium',
              config?.enabled ? 'text-green-600' : 'text-gray-400'
            )}>
              {config?.enabled ? 'Active' : 'Inactive'}
            </p>
            {config?.enabled && preview?.willTrigger && (
              <p className="text-xs text-nilin-warmGray mt-1">
                Triggers at {formatCurrency(preview.thresholdAmount, 'AED')}
              </p>
            )}
          </div>
          <button
            onClick={handleToggle}
            className={cn(
              'text-2xl transition-colors',
              config?.enabled ? 'text-green-500' : 'text-gray-300'
            )}
          >
            {config?.enabled ? <ToggleRight /> : <ToggleLeft />}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-nilin-charcoal font-medium mb-2">Unable to load auto-topup</p>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-nilin-charcoal">Auto-Topup</h2>
            <p className="text-sm text-nilin-warmGray">Never run out of balance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              showHistory ? 'bg-nilin-coral/10 text-nilin-coral' : 'hover:bg-gray-100 text-gray-500'
            )}
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={() => fetchData(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-5 h-5 text-gray-500', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Main Toggle Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggle}
              className={cn(
                'text-4xl transition-colors',
                enabled ? 'text-green-500' : 'text-gray-300'
              )}
            >
              {enabled ? <ToggleRight /> : <ToggleLeft />}
            </button>
            <div>
              <p className="font-semibold text-nilin-charcoal">
                {enabled ? 'Auto-Topup Enabled' : 'Auto-Topup Disabled'}
              </p>
              <p className="text-sm text-nilin-warmGray">
                {enabled
                  ? 'We will automatically add money when your balance is low'
                  : 'Enable to automatically top up your wallet'}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Summary (when enabled) */}
        {enabled && preview && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-nilin-warmGray">Next Topup Preview</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-nilin-charcoal">
                    When balance drops below {formatCurrency(preview.thresholdAmount, 'AED')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <span className="text-green-600 font-medium">
                    +{formatCurrency(preview.topupAmount, 'AED')}
                  </span>
                </div>
              </div>
            </div>

            {preview.willTrigger && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Topup will trigger soon</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Current balance ({formatCurrency(preview.currentBalance, 'AED')}) is below threshold
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configure Button */}
        <button
          onClick={() => setShowSettings(true)}
          className="w-full py-3 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          {enabled ? 'Update Settings' : 'Configure Auto-Topup'}
        </button>
      </div>

      {/* Usage Stats */}
      {config && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-nilin-warmGray">This Month</p>
            <p className="text-lg font-bold text-nilin-charcoal mt-1">
              {config.maxAutoTopupsPerMonth - (config as any).autoTopupsThisMonth || 0}
            </p>
            <p className="text-xs text-nilin-warmGray">topups left</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-nilin-warmGray">Threshold</p>
            <p className="text-lg font-bold text-nilin-charcoal mt-1">
              {formatCurrency(config.thresholdAmount, 'AED')}
            </p>
            <p className="text-xs text-nilin-warmGray">min balance</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-nilin-warmGray">Topup Amount</p>
            <p className="text-lg font-bold text-nilin-charcoal mt-1">
              {formatCurrency(config.topupAmount, 'AED')}
            </p>
            <p className="text-xs text-nilin-warmGray">per topup</p>
          </div>
        </div>
      )}

      {/* History Tab */}
      {showHistory && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-nilin-charcoal">Recent Auto-Topups</h3>
          </div>
          {logs.length === 0 ? (
            <div className="p-8 text-center">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-nilin-warmGray">No auto-topup history</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map((log) => (
                <div key={log.id} className="p-4 flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    log.status === 'success' ? 'bg-green-100' : 'bg-red-100'
                  )}>
                    {log.status === 'success' ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-nilin-charcoal">
                      {log.status === 'success'
                        ? `+${formatCurrency(log.topupAmount, 'AED')}`
                        : 'Failed'}
                    </p>
                    <p className="text-xs text-nilin-warmGray">
                      Balance: {formatCurrency(log.triggerBalance, 'AED')} - {formatDate(log.triggeredAt)}
                    </p>
                    {log.failureReason && (
                      <p className="text-xs text-red-500 mt-1">{log.failureReason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-nilin-charcoal">Auto-Topup Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-nilin-charcoal">Enable Auto-Topup</span>
                </div>
                <button
                  onClick={() => setEnabled(!enabled)}
                  className={cn(
                    'text-3xl transition-colors',
                    enabled ? 'text-green-500' : 'text-gray-300'
                  )}
                >
                  {enabled ? <ToggleRight /> : <ToggleLeft />}
                </button>
              </div>

              {/* Threshold Amount */}
              <div>
                <label className="text-sm font-medium text-nilin-charcoal mb-3 block">
                  Top up when balance falls below
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => adjustAmount(setThresholdAmount, thresholdAmount, -10)}
                    className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Minus className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-nilin-charcoal">
                      {formatCurrency(thresholdAmount, 'AED')}
                    </p>
                  </div>
                  <button
                    onClick={() => adjustAmount(setThresholdAmount, thresholdAmount, 10)}
                    className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Topup Amount */}
              <div>
                <label className="text-sm font-medium text-nilin-charcoal mb-3 block">
                  Top up amount
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => adjustAmount(setTopupAmount, topupAmount, -25)}
                    className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Minus className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-nilin-charcoal">
                      {formatCurrency(topupAmount, 'AED')}
                    </p>
                  </div>
                  <button
                    onClick={() => adjustAmount(setTopupAmount, topupAmount, 25)}
                    className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                <p className="text-xs text-nilin-warmGray mt-2 text-center">
                  Maximum per topup: {formatCurrency(500, 'AED')}
                </p>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium text-nilin-charcoal mb-3 block">
                  Payment Method
                </label>
                <div className="space-y-2">
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setSelectedPaymentMethod(pm)}
                      className={cn(
                        'w-full p-4 rounded-xl border-2 transition-colors flex items-center gap-3',
                        selectedPaymentMethod?.id === pm.id
                          ? 'border-nilin-coral bg-nilin-coral/5'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <CreditCard className="w-5 h-5 text-gray-500" />
                      <div className="flex-1 text-left">
                        <p className="font-medium text-nilin-charcoal">
                          {pm.brand} **** {pm.last4}
                        </p>
                        {pm.isDefault && (
                          <p className="text-xs text-nilin-warmGray">Default</p>
                        )}
                      </div>
                      {selectedPaymentMethod?.id === pm.id && (
                        <Check className="w-5 h-5 text-nilin-coral" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">How it works</p>
                  <p className="mt-1">
                    When your wallet balance drops below {formatCurrency(thresholdAmount, 'AED')},
                    we will automatically add {formatCurrency(topupAmount, 'AED')} using your selected payment method.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-3 border border-gray-200 text-nilin-charcoal rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedPaymentMethod}
                className="flex-1 py-3 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoTopup;
