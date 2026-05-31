/**
 * ServicePause - Pause/hide service toggle
 * Provider Dashboard Component
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Pause,
  Play,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  Loader2,
  Calendar,
  Clock,
  BarChart3,
  ChevronRight,
  Info,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ServiceStatus {
  /** Unique service ID */
  id: string;
  /** Service name */
  name: string;
  /** Service category */
  category: string;
  /** Current status */
  status: 'active' | 'paused' | 'hidden';
  /** Total bookings (last 30 days) */
  recentBookings: number;
  /** Total revenue (last 30 days) */
  recentRevenue: number;
  /** Average rating */
  rating: number;
  /** Pause reason (if paused) */
  pauseReason?: string;
  /** Scheduled resume date (if paused) */
  scheduledResume?: string;
  /** Hidden date (if hidden) */
  hiddenDate?: string;
}

export interface ServicePauseProps {
  /** Service to pause/unpause */
  service: ServiceStatus;
  /** Is loading */
  isLoading?: boolean;
  /** Callback when status changes */
  onStatusChange: (serviceId: string, newStatus: ServiceStatus['status']) => Promise<void>;
  /** Callback when viewing service details */
  onViewDetails?: () => void;
  /** Custom className */
  className?: string;
}

export interface ServicePauseListProps {
  /** Services to manage */
  services: ServiceStatus[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when status changes */
  onStatusChange: (serviceId: string, newStatus: ServiceStatus['status']) => Promise<void>;
  /** Callback when viewing service details */
  onViewDetails?: (serviceId: string) => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Individual Service Pause Card
// =============================================================================

interface ServicePauseCardProps {
  service: ServiceStatus;
  onStatusChange: (newStatus: ServiceStatus['status']) => Promise<void>;
  onViewDetails?: () => void;
}

const ServicePauseCard: React.FC<ServicePauseCardProps> = ({
  service,
  onStatusChange,
  onViewDetails,
}) => {
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ServiceStatus['status'] | null>(null);

  const handleStatusChange = async (newStatus: ServiceStatus['status']) => {
    setIsChangingStatus(true);
    try {
      await onStatusChange(newStatus);
    } finally {
      setIsChangingStatus(false);
      setShowConfirmDialog(false);
      setPendingStatus(null);
    }
  };

  const confirmStatusChange = (status: ServiceStatus['status']) => {
    setPendingStatus(status);
    setShowConfirmDialog(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = () => {
    switch (service.status) {
      case 'active':
        return {
          label: 'Active',
          color: 'bg-green-100 text-green-700',
          icon: Check,
        };
      case 'paused':
        return {
          label: 'Paused',
          color: 'bg-amber-100 text-amber-700',
          icon: Pause,
        };
      case 'hidden':
        return {
          label: 'Hidden',
          color: 'bg-gray-100 text-gray-700',
          icon: EyeOff,
        };
    }
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  return (
    <>
      <div
        className={cn(
          'bg-white rounded-xl border shadow-nilin-sm overflow-hidden transition-all',
          service.status === 'active'
            ? 'border-green-200'
            : service.status === 'paused'
            ? 'border-amber-200'
            : 'border-gray-200'
        )}
      >
        {/* Header */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* Status Icon */}
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  service.status === 'active'
                    ? 'bg-green-100'
                    : service.status === 'paused'
                    ? 'bg-amber-100'
                    : 'bg-gray-100'
                )}
              >
                <StatusIcon
                  className={cn(
                    'w-5 h-5',
                    service.status === 'active'
                      ? 'text-green-600'
                      : service.status === 'paused'
                      ? 'text-amber-600'
                      : 'text-gray-600'
                  )}
                />
              </div>

              <div>
                <h4 className="font-semibold text-nilin-charcoal">{service.name}</h4>
                <p className="text-sm text-nilin-warmGray">{service.category}</p>
              </div>
            </div>

            {/* Status Badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
                statusBadge.color
              )}
            >
              <StatusIcon className="w-4 h-4" />
              {statusBadge.label}
            </span>
          </div>

          {/* Stats */}
          {service.status === 'active' && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-green-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-green-700">
                  {service.recentBookings}
                </p>
                <p className="text-xs text-green-600/70">Bookings (30d)</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(service.recentRevenue)}
                </p>
                <p className="text-xs text-green-600/70">Revenue (30d)</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-green-700">
                  {service.rating.toFixed(1)}
                </p>
                <p className="text-xs text-green-600/70">Rating</p>
              </div>
            </div>
          )}

          {/* Pause Reason */}
          {service.status === 'paused' && service.pauseReason && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg mb-3">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">{service.pauseReason}</p>
            </div>
          )}

          {/* Scheduled Resume */}
          {service.status === 'paused' && service.scheduledResume && (
            <div className="flex items-center gap-2 text-sm text-amber-600 mb-3">
              <Calendar className="w-4 h-4" />
              <span>Auto-resume: {new Date(service.scheduledResume).toLocaleDateString()}</span>
            </div>
          )}

          {/* Hidden Warning */}
          {service.status === 'hidden' && (
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg mb-3">
              <AlertTriangle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">
                Service is hidden from customers and won't appear in search results.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 bg-nilin-muted/50 border-t border-nilin-border">
          <div className="flex items-center justify-between">
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="flex items-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
              >
                <span>View Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {service.status === 'active' && (
                <>
                  <button
                    onClick={() => confirmStatusChange('hidden')}
                    disabled={isChangingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <EyeOff className="w-4 h-4" />
                    Hide
                  </button>
                  <button
                    onClick={() => confirmStatusChange('paused')}
                    disabled={isChangingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isChangingStatus ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                    Pause
                  </button>
                </>
              )}

              {service.status === 'paused' && (
                <button
                  onClick={() => confirmStatusChange('active')}
                  disabled={isChangingStatus}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isChangingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Resume
                </button>
              )}

              {service.status === 'hidden' && (
                <button
                  onClick={() => confirmStatusChange('active')}
                  disabled={isChangingStatus}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isChangingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  Make Visible
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && pendingStatus && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setShowConfirmDialog(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-nilin-xl max-w-sm w-full p-6">
              <div className="text-center mb-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3',
                    pendingStatus === 'paused' || pendingStatus === 'hidden'
                      ? 'bg-amber-100'
                      : 'bg-green-100'
                  )}
                >
                  {pendingStatus === 'paused' || pendingStatus === 'hidden' ? (
                    <Pause className="w-6 h-6 text-amber-600" />
                  ) : (
                    <Play className="w-6 h-6 text-green-600" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-nilin-charcoal">
                  {pendingStatus === 'paused'
                    ? 'Pause Service?'
                    : pendingStatus === 'hidden'
                    ? 'Hide Service?'
                    : 'Resume Service?'}
                </h3>
                <p className="text-sm text-nilin-warmGray mt-2">
                  {pendingStatus === 'paused'
                    ? 'Customers won\'t be able to book this service while paused. You can resume anytime.'
                    : pendingStatus === 'hidden'
                    ? 'This service won\'t appear in search results but existing bookings remain active.'
                    : 'This service will become visible and bookable again.'}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 py-2.5 border border-nilin-border rounded-xl text-nilin-charcoal font-medium hover:bg-nilin-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleStatusChange(pendingStatus)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl font-medium text-white transition-colors',
                    pendingStatus === 'paused' || pendingStatus === 'hidden'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-green-600 hover:bg-green-700'
                  )}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// =============================================================================
// Main Component (List)
// =============================================================================

export const ServicePauseList: React.FC<ServicePauseListProps> = ({
  services,
  isLoading = false,
  onStatusChange,
  onViewDetails,
  className,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'hidden'>('all');

  const filteredServices = services.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const statusCounts = {
    all: services.length,
    active: services.filter((s) => s.status === 'active').length,
    paused: services.filter((s) => s.status === 'paused').length,
    hidden: services.filter((s) => s.status === 'hidden').length,
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-nilin-muted rounded-xl" />
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
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Service Visibility
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Manage your service availability
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {(['all', 'active', 'paused', 'hidden'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                filter === status
                  ? status === 'active'
                    ? 'bg-green-600 text-white'
                    : status === 'paused'
                    ? 'bg-amber-500 text-white'
                    : status === 'hidden'
                    ? 'bg-gray-600 text-white'
                    : 'bg-nilin-coral text-white'
                  : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
              )}
            >
              {status} ({statusCounts[status]})
            </button>
          ))}
        </div>
      </div>

      {/* Services List */}
      {filteredServices.length > 0 ? (
        <div className="space-y-4">
          {filteredServices.map((service) => (
            <ServicePauseCard
              key={service.id}
              service={service}
              onStatusChange={(newStatus) => onStatusChange(service.id, newStatus)}
              onViewDetails={onViewDetails ? () => onViewDetails(service.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
          <p className="text-nilin-warmGray">No services found</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            Try changing the filter to see more services
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ServicePauseList;
