/**
 * PayoutCalendar - Payout schedule calendar
 * Provider Dashboard Component
 */
import React, { useState, useMemo, useEffect } from 'react';
import { cn } from '../../lib/utils';
import {
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CreditCard,
  ArrowRight,
  Info,
  Download,
  Loader2,
} from 'lucide-react';
import { earningsApi } from '../../services/earningsApi';

// =============================================================================
// Type Definitions
// =============================================================================

export type PayoutStatus = 'scheduled' | 'processing' | 'completed' | 'failed';

export interface Payout {
  /** Unique payout ID */
  id: string;
  /** Payout amount */
  amount: number;
  /** Currency code */
  currency?: string;
  /** Payout date */
  date: string;
  /** Expected arrival date */
  expectedDate: string;
  /** Status */
  status: PayoutStatus;
  /** Associated earnings period */
  period: {
    start: string;
    end: string;
  };
  /** Number of bookings included */
  bookingsCount: number;
  /** Payment method */
  paymentMethod?: {
    type: 'bank' | 'wallet' | 'card';
    last4?: string;
    bankName?: string;
  };
  /** Processing fee */
  fee?: number;
  /** Net amount after fee */
  netAmount?: number;
  /** Failure reason (if failed) */
  failureReason?: string;
}

export interface PayoutCalendarProps {
  /** Payouts to display */
  payouts: Payout[];
  /** Loading state */
  isLoading?: boolean;
  /** Current balance */
  currentBalance: number;
  /** Pending payout amount */
  pendingBalance: number;
  /** Callback when payout is clicked */
  onPayoutClick?: (payout: Payout) => void;
  /** Callback when downloading statement */
  onDownloadStatement?: (payoutId: string) => Promise<void>;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatPrice(amount: number, currency = 'AED'): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// =============================================================================
// Status Configurations
// =============================================================================

const statusConfig: Record<PayoutStatus, { color: string; bgColor: string; icon: React.ElementType; label: string }> = {
  scheduled: { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock, label: 'Scheduled' },
  processing: { color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Loader2, label: 'Processing' },
  completed: { color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'text-red-600', bgColor: 'bg-red-50', icon: AlertCircle, label: 'Failed' },
};

// =============================================================================
// Balance Card Component
// =============================================================================

interface BalanceCardProps {
  currentBalance: number;
  pendingBalance: number;
  currency?: string;
}

const BalanceCard: React.FC<BalanceCardProps> = ({
  currentBalance,
  pendingBalance,
  currency = 'AED',
}) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {/* Current Balance */}
      <div className="bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5" />
          <span className="text-sm text-white/80">Current Balance</span>
        </div>
        <p className="text-3xl font-bold mb-1">{formatPrice(currentBalance, currency)}</p>
        <p className="text-xs text-white/70">Available for withdrawal</p>
        <button className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
          Withdraw Now
        </button>
      </div>

      {/* Pending Balance */}
      <div className="bg-white rounded-xl border border-nilin-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-amber-600" />
          <span className="text-sm text-nilin-warmGray">Pending</span>
        </div>
        <p className="text-3xl font-bold text-nilin-charcoal mb-1">
          {formatPrice(pendingBalance, currency)}
        </p>
        <p className="text-xs text-nilin-lightGray">Next payout in 2 days</p>
        <div className="mt-4 flex items-center gap-1 text-xs text-amber-600">
          <Info className="w-3 h-3" />
          <span>Processing earnings</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Payout List Component
// =============================================================================

interface PayoutListProps {
  payouts: Payout[];
  onPayoutClick?: (payout: Payout) => void;
  onDownloadStatement?: (payoutId: string) => Promise<void>;
}

const PayoutList: React.FC<PayoutListProps> = ({
  payouts,
  onPayoutClick,
  onDownloadStatement,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (payoutId: string) => {
    if (!onDownloadStatement) return;
    setDownloadingId(payoutId);
    try {
      await onDownloadStatement(payoutId);
    } finally {
      setDownloadingId(null);
    }
  };

  if (payouts.length === 0) {
    return (
      <div className="text-center py-8">
        <DollarSign className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
        <p className="text-nilin-warmGray">No payouts scheduled</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payouts.map((payout) => {
        const status = statusConfig[payout.status];
        const StatusIcon = status.icon;
        const isDownloading = downloadingId === payout.id;

        return (
          <div
            key={payout.id}
            onClick={() => onPayoutClick?.(payout)}
            className="bg-white rounded-xl border border-nilin-border p-4 cursor-pointer hover:shadow-nilin-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    status.bgColor
                  )}
                >
                  <StatusIcon
                    className={cn(
                      'w-5 h-5',
                      status.color,
                      payout.status === 'processing' && 'animate-spin'
                    )}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-nilin-charcoal">
                      {formatPrice(payout.netAmount || payout.amount, payout.currency)}
                    </h4>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        status.bgColor,
                        status.color
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-nilin-warmGray">
                    <span>
                      {formatDate(payout.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {payout.bookingsCount} bookings
                    </span>
                  </div>

                  {payout.paymentMethod && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-nilin-lightGray">
                      <CreditCard className="w-3 h-3" />
                      <span>
                        {payout.paymentMethod.bankName || payout.paymentMethod.type}
                        {payout.paymentMethod.last4 && ` •••• ${payout.paymentMethod.last4}`}
                      </span>
                    </div>
                  )}

                  {payout.failureReason && (
                    <p className="mt-2 text-xs text-red-600">{payout.failureReason}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onDownloadStatement && payout.status === 'completed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(payout.id);
                    }}
                    className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
                    title="Download statement"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                )}
                <ArrowRight className="w-4 h-4 text-nilin-lightGray" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// Calendar Grid Component
// =============================================================================

interface PayoutCalendarGridProps {
  currentDate: Date;
  payouts: Payout[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPayoutClick: (payout: Payout) => void;
}

const PayoutCalendarGrid: React.FC<PayoutCalendarGridProps> = ({
  currentDate,
  payouts,
  onPrevMonth,
  onNextMonth,
  onPayoutClick,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);

  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  // Get payout for a specific date
  const getPayoutForDate = (date: Date): Payout | undefined => {
    return payouts.find((p) => isSameDay(new Date(p.date), date));
  };

  return (
    <div className="border border-nilin-border rounded-xl overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-nilin-muted px-4 py-3">
        <button
          onClick={onPrevMonth}
          className="p-1 hover:bg-white rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-nilin-charcoal" />
        </button>
        <h3 className="font-semibold text-nilin-charcoal">
          {MONTHS[month]} {year}
        </h3>
        <button
          onClick={onNextMonth}
          className="p-1 hover:bg-white rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-nilin-charcoal" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-nilin-border">
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-nilin-warmGray py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-16 bg-nilin-muted/30" />;
          }

          const payout = getPayoutForDate(date);
          const isToday = isSameDay(date, new Date());
          const status = payout ? statusConfig[payout.status] : null;

          return (
            <div
              key={date.toISOString()}
              onClick={() => payout && onPayoutClick(payout)}
              className={cn(
                'h-16 border-b border-r border-nilin-border p-1 cursor-pointer transition-colors',
                isToday ? 'bg-nilin-blush' : 'bg-white',
                payout && 'hover:bg-nilin-muted'
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <span
                  className={cn(
                    'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full',
                    isToday && 'bg-nilin-coral text-white',
                    !isToday && 'text-nilin-charcoal'
                  )}
                >
                  {date.getDate()}
                </span>
              </div>

              {payout && (
                <div
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium truncate',
                    status?.bgColor,
                    status?.color
                  )}
                  title={`${formatPrice(payout.amount)} - ${status?.label}`}
                >
                  {formatPrice(payout.amount, payout.currency)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// API Helper Functions
// =============================================================================

// Helper to map API payout to Payout format
const mapApiPayoutToPayout = (apiPayout: any): Payout => {
  return {
    id: apiPayout._id || apiPayout.payoutNumber,
    amount: apiPayout.amount,
    currency: apiPayout.currency || 'AED',
    date: apiPayout.scheduledDate || apiPayout.processedDate || apiPayout.createdAt,
    expectedDate: apiPayout.scheduledDate || '',
    status: mapApiStatusToPayoutStatus(apiPayout.status),
    period: {
      start: apiPayout.periodStart || '',
      end: apiPayout.periodEnd || '',
    },
    bookingsCount: apiPayout.earningsBreakdown?.completedBookings || 0,
    paymentMethod: apiPayout.method ? {
      type: apiPayout.method === 'bank_transfer' ? 'bank' : 'wallet',
      bankName: apiPayout.bankDetails?.bankName,
      last4: apiPayout.bankDetails?.accountNumber?.slice(-4),
    } : undefined,
    fee: apiPayout.earningsBreakdown?.commission,
    netAmount: apiPayout.earningsBreakdown?.netAmount || apiPayout.amount,
    failureReason: apiPayout.failures?.[0]?.reason,
  };
};

const mapApiStatusToPayoutStatus = (status: string): PayoutStatus => {
  const mapping: Record<string, PayoutStatus> = {
    pending: 'scheduled',
    scheduled: 'scheduled',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'failed',
  };
  return mapping[status] || 'scheduled';
};

// =============================================================================
// Main Component
// =============================================================================

export const PayoutCalendar: React.FC<PayoutCalendarProps> = ({
  payouts: payoutsProp,
  isLoading: isLoadingProp = false,
  currentBalance: currentBalanceProp,
  pendingBalance: pendingBalanceProp,
  onPayoutClick,
  onDownloadStatement,
  className,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>(payoutsProp || []);
  const [isLoading, setIsLoading] = useState(isLoadingProp);
  const [error, setError] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(currentBalanceProp || 0);
  const [pendingBalance, setPendingBalance] = useState(pendingBalanceProp || 0);

  // Fetch payouts from API if not provided via props
  useEffect(() => {
    if (payoutsProp && payoutsProp.length > 0) {
      setPayouts(payoutsProp);
      setIsLoading(false);
    } else if (!payoutsProp) {
      const fetchPayouts = async () => {
        setIsLoading(true);
        setError(null);
        try {
          // Fetch payout schedule from earnings API
          const response = await earningsApi.getCommissions({
            startDate: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString(),
            endDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString(),
            limit: 50,
          });

          if (response.items) {
            const mappedPayouts = response.items.map((commission: any) => ({
              id: commission._id,
              amount: commission.providerEarnings || 0,
              currency: 'AED',
              date: commission.paidAt || commission.calculatedAt,
              expectedDate: commission.calculatedAt,
              status: mapApiStatusToPayoutStatus(commission.status) as PayoutStatus,
              period: {
                start: '',
                end: '',
              },
              bookingsCount: 1,
              netAmount: commission.providerEarnings,
            }));
            setPayouts(mappedPayouts);
          }

          // Fetch earnings summary for balances
          const summaryResponse = await earningsApi.getDashboardSummary('month');
          if (summaryResponse) {
            setCurrentBalance(summaryResponse.current?.netEarnings || 0);
            setPendingBalance(summaryResponse.pendingPayments?.amount || 0);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load payout data';
          setError(errorMessage);
          console.error('Error fetching payout data:', err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchPayouts();
    }
  }, [payoutsProp, currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Group payouts by month
  const upcomingPayouts = useMemo(
    () =>
      payouts
        .filter((p) => new Date(p.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [payouts]
  );

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-nilin-muted rounded mb-6" />
          <div className="h-40 bg-nilin-muted rounded-xl mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Payout Schedule
            </h3>
            <p className="text-sm text-nilin-warmGray">
              Your earnings and withdrawal history
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-nilin-muted rounded-lg p-1">
          <button
            onClick={() => setShowCalendar(true)}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-colors',
              showCalendar
                ? 'bg-white text-nilin-charcoal shadow-sm'
                : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            Calendar
          </button>
          <button
            onClick={() => setShowCalendar(false)}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-colors',
              !showCalendar
                ? 'bg-white text-nilin-charcoal shadow-sm'
                : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            List
          </button>
        </div>
      </div>

      {/* Balance Cards */}
      <BalanceCard
        currentBalance={currentBalance}
        pendingBalance={pendingBalance}
      />

      {/* Calendar View */}
      {showCalendar ? (
        <PayoutCalendarGrid
          currentDate={currentDate}
          payouts={payouts}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onPayoutClick={onPayoutClick || (() => {})}
        />
      ) : null}

      {/* Upcoming Payouts */}
      <div>
        <h4 className="text-sm font-medium text-nilin-charcoal mb-3">
          {showCalendar ? 'Upcoming Payouts' : 'All Payouts'}
        </h4>
        <PayoutList
          payouts={showCalendar ? upcomingPayouts : payouts}
          onPayoutClick={onPayoutClick}
          onDownloadStatement={onDownloadStatement}
        />
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-nilin-border flex items-center gap-4 text-xs text-nilin-warmGray">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-200" />
          Scheduled
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-200" />
          Processing
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-200" />
          Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-200" />
          Failed
        </span>
      </div>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default PayoutCalendar;
