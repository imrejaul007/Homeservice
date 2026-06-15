import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
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
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../utils/formatting';
import { autoTopupApi, type AutoTopupConfig, type AutoTopupLog, type AutoTopupPreview } from '../../services/autoTopupApi';
import { customerApi, type PaymentMethod } from '../../services/customerApi';

interface AutoTopupProps {
  compact?: boolean;
  onConfigChange?: () => void;
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch data
  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [configData, previewData, historyData, paymentMethodsData] = await Promise.all([
        autoTopupApi.getConfig(),
        autoTopupApi.preview(),
        autoTopupApi.getHistory({ limit: 10 }),
        customerApi.getPaymentMethods(),
      ]);

      setConfig(configData.config);
      setPreview(previewData);
      setLogs(historyData.logs);
      setPaymentMethods(paymentMethodsData.data.paymentMethods);

      if (configData.config) {
        setEnabled(configData.config.enabled);
        setThresholdAmount(configData.config.thresholdAmount);
        setTopupAmount(configData.config.topupAmount);
        const defaultMethod = paymentMethodsData.data.paymentMethods.find(
          (pm) => pm._id === configData.config?.paymentMethodId
        );
        setSelectedPaymentMethod(defaultMethod || paymentMethodsData.data.paymentMethods.find((pm) => pm.isDefault) || paymentMethodsData.data.paymentMethods[0] || null);
      } else {
        setSelectedPaymentMethod(paymentMethodsData.data.paymentMethods.find((pm) => pm.isDefault) || paymentMethodsData.data.paymentMethods[0] || null);
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
      // Map payment method type to the expected type
      const paymentType = selectedPaymentMethod.type === 'card' || selectedPaymentMethod.type === 'apple_pay' || selectedPaymentMethod.type === 'google_pay'
        ? 'card' as const
        : selectedPaymentMethod.type === 'cash'
        ? 'wallet' as const
        : 'bank_account' as const;

      await autoTopupApi.updateConfig({
        enabled,
        thresholdAmount,
        topupAmount,
        paymentMethodId: selectedPaymentMethod._id,
        paymentMethodType: paymentType,
        paymentMethodLast4: selectedPaymentMethod.last4,
        paymentMethodBrand: selectedPaymentMethod.brand,
        maxAutoTopupsPerMonth: 5,
        maxAutoTopupAmount: 500,
        autoTopupsThisMonth: config?.autoTopupsThisMonth || 0,
      } as any);

      onConfigChange?.();
      setShowSettings(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save config:', err);
      toast.error('Failed to save auto-topup settings. Please try again.');
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
      toast.error('Failed to update auto-topup settings. Please try again.');
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
      <div className="bg-white rounded-2xl p-4 shadow-nilin-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-nilin-coral" />
            </div>
            <span className="font-medium text-nilin-charcoal">Auto-Topup</span>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
            disabled={refreshing}
            aria-label="Refresh auto-topup"
          >
            <RefreshCw className={cn('w-4 h-4 text-nilin-warmGray', refreshing && 'animate-spin')} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className={cn(
              'text-sm font-medium',
              config?.enabled ? 'text-nilin-success' : 'text-nilin-warmGray'
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
            aria-label={config?.enabled ? 'Disable auto-topup' : 'Enable auto-topup'}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-lg"
          >
            <span className={cn(
              'text-2xl transition-colors',
              config?.enabled ? 'text-nilin-success' : 'text-nilin-warmGray'
            )}>
              {config?.enabled ? <ToggleRight /> : <ToggleLeft />}
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-nilin flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-nilin">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-nilin-error mx-auto mb-3" />
          <p className="text-nilin-charcoal font-medium mb-2">Unable to load auto-topup</p>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
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
          <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-nilin-coral" />
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
              showHistory ? 'bg-nilin-coral/10 text-nilin-coral' : 'hover:bg-gray-100 text-nilin-warmGray'
            )}
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={() => fetchData(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Main Toggle Card */}
      <div className="bg-white rounded-2xl p-6 shadow-nilin-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggle}
              aria-label={enabled ? 'Disable auto-topup' : 'Enable auto-topup'}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-lg"
            >
              <span className={cn(
                'text-4xl transition-colors',
                enabled ? 'text-nilin-success' : 'text-nilin-warmGray'
              )}>
                {enabled ? <ToggleRight /> : <ToggleLeft />}
              </span>
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
              <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-nilin-coral" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-nilin-warmGray">Next Topup Preview</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-nilin-charcoal">
                    When balance drops below {formatCurrency(preview.thresholdAmount, 'AED')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-nilin-warmGray" />
                  <span className="text-nilin-success font-medium">
                    +{formatCurrency(preview.topupAmount, 'AED')}
                  </span>
                </div>
              </div>
            </div>

            {preview.willTrigger && (
              <div className="mt-3 p-3 bg-nilin-warning/10 rounded-lg border border-nilin-warning/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-nilin-warning mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-nilin-charcoal">Topup will trigger soon</p>
                    <p className="text-xs text-nilin-warmGray mt-1">
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
          <div className="bg-white rounded-xl p-4 shadow-nilin-sm">
            <p className="text-xs text-nilin-warmGray">This Month</p>
            <p className="text-lg font-bold text-nilin-charcoal mt-1 tabular-nums">
              {Math.max(0, (config.maxAutoTopupsPerMonth ?? 0) - (config.autoTopupsThisMonth ?? 0))}
            </p>
            <p className="text-xs text-nilin-warmGray">topups left</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-nilin-sm">
            <p className="text-xs text-nilin-warmGray">Threshold</p>
            <p className="text-lg font-bold text-nilin-charcoal mt-1 tabular-nums">
              {formatCurrency(config.thresholdAmount, 'AED')}
            </p>
            <p className="text-xs text-nilin-warmGray">min balance</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-nilin-sm">
            <p className="text-xs text-nilin-warmGray">Topup Amount</p>
            <p className="text-lg font-bold text-nilin-charcoal mt-1 tabular-nums">
              {formatCurrency(config.topupAmount, 'AED')}
            </p>
            <p className="text-xs text-nilin-warmGray">per topup</p>
          </div>
        </div>
      )}

      {/* History Tab */}
      {showHistory && (
        <div className="bg-white rounded-2xl shadow-nilin-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-nilin-charcoal">Recent Auto-Topups</h3>
          </div>
          {logs.length === 0 ? (
            <div className="p-8 text-center">
              <History className="w-12 h-12 text-nilin-blush mx-auto mb-3" />
              <p className="text-nilin-warmGray">No auto-topup history</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map((log) => (
                <div key={log.id} className="p-4 flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    log.status === 'success' ? 'bg-nilin-success/10' : 'bg-nilin-error/10'
                  )}>
                    {log.status === 'success' ? (
                      <TrendingUp className="w-5 h-5 text-nilin-success" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-nilin-error" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-nilin-charcoal tabular-nums">
                      {log.status === 'success'
                        ? `+${formatCurrency(log.topupAmount, 'AED')}`
                        : 'Failed'}
                    </p>
                    <p className="text-xs text-nilin-warmGray">
                      Balance: {formatCurrency(log.triggerBalance, 'AED')} - {formatDate(log.triggeredAt)}
                    </p>
                    {log.failureReason && (
                      <p className="text-xs text-nilin-error mt-1">{log.failureReason}</p>
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
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auto-topup-settings-title"
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-nilin-lg">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 id="auto-topup-settings-title" className="text-lg font-bold text-nilin-charcoal">Auto-Topup Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
                aria-label="Close settings"
              >
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-nilin-coral" />
                  <span className="font-medium text-nilin-charcoal">Enable Auto-Topup</span>
                </div>
                <button
                  onClick={() => setEnabled(!enabled)}
                  aria-label={enabled ? 'Disable auto-topup' : 'Enable auto-topup'}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-lg"
                >
                  <span className={cn(
                    'text-3xl transition-colors',
                    enabled ? 'text-nilin-success' : 'text-nilin-warmGray'
                  )}>
                    {enabled ? <ToggleRight /> : <ToggleLeft />}
                  </span>
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
                    className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
                  >
                    <Minus className="w-5 h-5 text-nilin-charcoal" />
                  </button>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-nilin-charcoal tabular-nums">
                      {formatCurrency(thresholdAmount, 'AED')}
                    </p>
                  </div>
                  <button
                    onClick={() => adjustAmount(setThresholdAmount, thresholdAmount, 10)}
                    className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
                  >
                    <Plus className="w-5 h-5 text-nilin-charcoal" />
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
                    className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
                  >
                    <Minus className="w-5 h-5 text-nilin-charcoal" />
                  </button>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-nilin-charcoal tabular-nums">
                      {formatCurrency(topupAmount, 'AED')}
                    </p>
                  </div>
                  <button
                    onClick={() => adjustAmount(setTopupAmount, topupAmount, 25)}
                    className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
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
                  {paymentMethods.length === 0 ? (
                    <p className="text-nilin-warmGray text-center py-4">No payment methods found</p>
                  ) : (
                    paymentMethods.map((pm) => (
                      <button
                        key={pm._id}
                        onClick={() => setSelectedPaymentMethod(pm)}
                        className={cn(
                          'w-full p-4 rounded-xl border-2 transition-colors flex items-center gap-3',
                          selectedPaymentMethod?._id === pm._id
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
                        {selectedPaymentMethod?._id === pm._id && (
                          <Check className="w-5 h-5 text-nilin-coral" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-nilin-blush/30 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-nilin-coral flex-shrink-0 mt-0.5" />
                <div className="text-sm text-nilin-charcoal">
                  <p className="font-medium">How it works</p>
                  <p className="mt-1 text-nilin-warmGray">
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
                className="flex-1 py-3 border border-gray-200 text-nilin-charcoal rounded-xl hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedPaymentMethod}
                className="flex-1 py-3 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
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
