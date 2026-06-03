/**
 * ServiceApprovalPanel - Reusable Service Approval Component for Admin Dashboard
 *
 * Provides service approval/rejection functionality with bulk actions.
 * Used by both the admin dashboard page and component.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  ChevronUp,
  Search,
  Filter,
  Clock,
  Star,
  DollarSign,
} from 'lucide-react';
import authService from '../../services/AuthService';
import { toast } from 'react-hot-toast';

// Types
interface Service {
  _id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  shortDescription: string;
  duration: number;
  price: {
    amount: number;
    currency: string;
    type: string;
  };
  tags: string[];
  status: string;
  providerId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    businessInfo?: {
      businessName: string;
    };
  };
  images: string[];
  createdAt: string;
  updatedAt: string;
  rating?: {
    average: number;
    count: number;
  };
  isActive: boolean;
}

interface ServiceApprovalPanelProps {
  /** Callback when a service is approved/rejected */
  onServiceUpdated?: () => void;
  /** Initial visibility state */
  defaultVisible?: boolean;
}

// API response types
interface ApiSuccessResponse {
  success: true;
  data?: unknown;
}

interface ApiErrorResponse {
  success: false;
  error?: string;
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

export function ServiceApprovalPanel({ onServiceUpdated, defaultVisible = false }: ServiceApprovalPanelProps) {
  // State
  const [pendingServices, setPendingServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [showSection, setShowSection] = useState(defaultVisible);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch pending services
  const fetchPendingServices = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      const data = await authService.get<{ success: boolean; data: { services: Service[] } }>(
        '/admin/services/pending?limit=50',
        { signal }
      );
      if (data.success && data.data) {
        setPendingServices(data.data.services || []);
        setHasFetched(true);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Error fetching pending services:', error);
      toast.error('Failed to load pending services');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle individual service action
  const handleServiceAction = async (serviceId: string, action: 'approve' | 'reject') => {
    try {
      const newStatus = action === 'approve' ? 'active' : 'rejected';
      const response = await authService.patch<ApiResponse>(`/admin/services/${serviceId}/status`, {
        status: newStatus
      });

      if (response.success) {
        toast.success(`Service ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
        await fetchPendingServices();
        onServiceUpdated?.();
      } else {
        toast.error(response.error || `Failed to ${action} service`);
      }
    } catch (error) {
      console.error(`Error ${action}ing service:`, error);
      toast.error(`Failed to ${action} service`);
    }
  };

  // Handle bulk action
  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedServices.size === 0) return;

    try {
      const response = await authService.post<ApiResponse>('/admin/services/batch-action', {
        serviceIds: Array.from(selectedServices),
        action,
        reason: action === 'reject' ? 'Batch rejection by admin' : undefined
      });

      if (response.success) {
        toast.success(`Successfully ${action}d ${selectedServices.size} services`);
        await fetchPendingServices();
        setSelectedServices(new Set());
        onServiceUpdated?.();
      } else {
        toast.error(response.error || `Failed to ${action} services`);
      }
    } catch (error) {
      console.error(`Error in bulk ${action}:`, error);
      toast.error(`Failed to ${action} services`);
    }
  };

  // Toggle service selection
  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  // Fetch on mount if visible
  useEffect(() => {
    if (showSection && !hasFetched) {
      const controller = new AbortController();
      fetchPendingServices(controller.signal);
      return () => controller.abort();
    }
  }, [showSection, hasFetched, fetchPendingServices]);

  // Format currency
  const formatPrice = (price: Service['price']) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: price.currency || 'AED',
      minimumFractionDigits: 0,
    }).format(price.amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="mb-8 glass rounded-2xl border border-nilin-border/50 inner-glow">
      <div className="px-4 py-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-serif font-light text-nilin-charcoal">Pending Service Approvals</h3>
            <p className="text-sm text-nilin-warmGray font-sans">
              {pendingServices.length} services awaiting approval
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Bulk Actions */}
            <button
              onClick={() => handleBulkAction('approve')}
              disabled={selectedServices.size === 0}
              className="px-3 py-1.5 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium font-sans disabled:opacity-50 hover:shadow-nilin-warm transition-all btn-3d"
            >
              Bulk Approve ({selectedServices.size})
            </button>
            <button
              onClick={() => handleBulkAction('reject')}
              disabled={selectedServices.size === 0}
              className="px-3 py-1.5 bg-red-500 text-white rounded-xl text-sm font-medium font-sans disabled:opacity-50 hover:bg-red-600 transition-colors"
            >
              Bulk Reject ({selectedServices.size})
            </button>
            {/* Toggle/Refresh */}
            <button
              onClick={() => {
                setShowSection(!showSection);
                if (!showSection) fetchPendingServices();
              }}
              className="text-nilin-warmGray hover:text-nilin-charcoal transition-colors p-1"
              title="Refresh"
            >
              <ChevronUp className={`h-5 w-5 transition-transform ${showSection ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && showSection && (
          <div className="text-center py-8 text-nilin-warmGray">
            Loading pending services...
          </div>
        )}

        {/* Service List */}
        {showSection && !isLoading && (
          <div className="space-y-3">
            {pendingServices.length === 0 ? (
              <p className="text-nilin-warmGray text-center py-8 font-sans">
                No pending services
              </p>
            ) : (
              pendingServices.map((service) => (
                <div
                  key={service._id}
                  className={`border rounded-xl p-4 transition-all cursor-pointer ${
                    selectedServices.has(service._id)
                      ? 'border-nilin-coral bg-nilin-blush/30'
                      : 'border-nilin-border/30 bg-white/50 hover:bg-white'
                  }`}
                  onClick={() => toggleServiceSelection(service._id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Selection Indicator */}
                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-1 flex items-center justify-center ${
                      selectedServices.has(service._id)
                        ? 'border-nilin-coral bg-nilin-coral'
                        : 'border-gray-300'
                    }`}>
                      {selectedServices.has(service._id) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>

                    {/* Service Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-nilin-charcoal font-sans">{service.name}</h4>
                          <p className="text-sm text-nilin-warmGray font-sans">
                            {service.category}
                            {service.subcategory && ` › ${service.subcategory}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-medium text-nilin-charcoal">
                            {formatPrice(service.price)}
                          </p>
                          {service.duration && (
                            <p className="text-xs text-nilin-warmGray font-sans">
                              {service.duration} min
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Provider Info */}
                      <div className="mt-2 flex items-center gap-2 text-sm text-nilin-warmGray font-sans">
                        <span>By {service.providerId?.businessInfo?.businessName || service.providerId?.firstName || 'Unknown'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(service.createdAt)}
                        </span>
                        {service.rating && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-500" />
                              {service.rating.average.toFixed(1)} ({service.rating.count})
                            </span>
                          </>
                        )}
                      </div>

                      {/* Short Description */}
                      {service.shortDescription && (
                        <p className="mt-2 text-sm text-nilin-warmGray line-clamp-2 font-sans">
                          {service.shortDescription}
                        </p>
                      )}

                      {/* Tags */}
                      {service.tags && service.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {service.tags.slice(0, 4).map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-sans"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleServiceAction(service._id, 'approve')}
                          className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium font-sans hover:bg-emerald-600 transition-colors flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleServiceAction(service._id, 'reject')}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium font-sans hover:bg-red-600 transition-colors flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ServiceApprovalPanel;
