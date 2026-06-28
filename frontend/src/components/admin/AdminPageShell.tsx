import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronDown, X, ExternalLink, Clock, Search, Download, WifiOff, Wifi, Menu } from 'lucide-react';
import PageLayout from '../layout/PageLayout';
import { AdminNav } from './AdminNav';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { auditService, RecentAuditAction } from '../../services/auditService';
import { adminNotificationService } from '../../services/adminNotificationService';
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionGate } from './PermissionGate';
import type { AdminNotification } from '../../types/notification';

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface AdminPageShellProps {
  title: string;
  subtitle?: string;
  description?: string;
  breadcrumbItems?: BreadcrumbItem[];
  headerActions?: React.ReactNode;
  backHref?: string;
  pendingVerifications?: number;
  showSidebar?: boolean;
  /** Use wider main column for tables and dashboards */
  wideLayout?: boolean;
  children: React.ReactNode;
}

export function AdminPageShell({
  title,
  subtitle,
  breadcrumbItems,
  headerActions,
  backHref = '/admin/dashboard',
  pendingVerifications = 0,
  showSidebar = true,
  wideLayout = false,
  children,
}: AdminPageShellProps) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const crumbs = breadcrumbItems ?? [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: title, current: true },
  ];

  // Audit dropdown state
  const [showAuditDropdown, setShowAuditDropdown] = useState(false);
  const [recentActions, setRecentActions] = useState<RecentAuditAction[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Global search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Notification state
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Network status state
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowOfflineBanner(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Connect to notification service on mount
  useEffect(() => {
    // Connect to WebSocket for real-time notifications
    adminNotificationService.connect();

    // Subscribe to unread count changes
    const unsubscribe = adminNotificationService.onUnreadCountChange((count) => {
      setUnreadNotificationCount(count);
    });

    // Fetch initial unread count
    adminNotificationService.fetchUnreadCount();

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle notification click - navigate to relevant page
  const handleNotificationClick = useCallback((notification: AdminNotification) => {
    const { data } = notification;

    // Navigate based on notification type
    switch (notification.type) {
      case 'new_dispute':
        if (data?.entityId) {
          navigate(`/admin/disputes/${data.entityId}`);
        } else {
          navigate('/admin/disputes');
        }
        break;
      case 'refund_request':
        if (data?.bookingId) {
          navigate(`/admin/bookings/${data.bookingId}`);
        } else {
          navigate('/admin/bookings');
        }
        break;
      case 'provider_suspended':
      case 'new_provider_submission':
        navigate('/admin/providers');
        break;
      case 'new_service_pending':
        navigate('/admin/services');
        break;
      case 'new_withdrawal_request':
        navigate('/admin/withdrawals');
        break;
      default:
        navigate('/admin/notifications');
    }
  }, [navigate]);

  // Ctrl+K keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Open search handler
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  // Fetch recent audit actions
  useEffect(() => {
    const fetchRecentActions = async () => {
      setIsLoadingActions(true);
      try {
        const response = await auditService.getAuditLogs({ limit: 5, page: 1 });
        if (response?.success && response.data?.logs) {
          const actions: RecentAuditAction[] = response.data.logs.map((log) => ({
            id: log._id,
            action: log.action,
            resource: log.resource,
            description: log.description || `${log.action} on ${log.resource}`,
            adminName: log.userId
              ? `${log.userId.firstName} ${log.userId.lastName}`
              : 'Unknown',
            timestamp: log.createdAt,
          }));
          setRecentActions(actions);
        }
      } catch (error) {
        console.error('[Audit] Failed to fetch recent actions:', error);
      } finally {
        setIsLoadingActions(false);
      }
    };

    fetchRecentActions();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAuditDropdown(false);
      }
    };

    if (showAuditDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAuditDropdown]);

  // Format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get action badge color
  const getActionColor = (action: string): string => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-700';
      case 'delete':
        return 'bg-red-100 text-red-700';
      case 'update':
        return 'bg-blue-100 text-blue-700';
      case 'approve':
        return 'bg-emerald-100 text-emerald-700';
      case 'reject':
      case 'suspend':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Global search button
  const mobileNavButton = showSidebar ? (
    <button
      type="button"
      onClick={() => setMobileNavOpen(true)}
      className="xl:hidden flex items-center justify-center w-11 h-11 rounded-xl border border-nilin-border bg-white hover:bg-nilin-blush/50 transition-all text-nilin-charcoal"
      aria-label="Open admin navigation"
    >
      <Menu className="w-5 h-5" />
    </button>
  ) : null;

  const searchButton = (
    <button
      onClick={openSearch}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-nilin-border bg-white hover:bg-nilin-blush/50 transition-all text-nilin-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
      aria-label="Open global search (Ctrl+K)"
    >
      <Search className="w-5 h-5" />
      <span className="hidden sm:inline text-sm font-medium">Search</span>
      <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-nilin-warmGray bg-nilin-blush/50 rounded border border-nilin-border/50">
        <span>Ctrl</span>
        <span>K</span>
      </kbd>
    </button>
  );

  // Build header actions with audit button (permission gated)
  const auditButton = (
    <PermissionGate permission="audit:view">
      <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowAuditDropdown(!showAuditDropdown)}
        className="relative flex items-center justify-center w-11 h-11 rounded-xl border border-nilin-border bg-white hover:bg-nilin-blush/50 transition-all text-nilin-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
        aria-label="View recent audit actions"
        aria-expanded={showAuditDropdown}
        aria-haspopup="true"
      >
        <FileText className="w-5 h-5" />
        {recentActions.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-nilin-coral text-white text-xs font-bold rounded-full flex items-center justify-center">
            {recentActions.length > 9 ? '9+' : recentActions.length}
          </span>
        )}
      </button>

      {/* Audit Dropdown */}
      {showAuditDropdown && (
        <div
          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-nilin-border shadow-lg z-50 animate-fade-in"
          role="dialog"
          aria-label="Recent audit actions"
        >
          {/* Dropdown Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-nilin-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-nilin-warmGray" />
              <h3 className="font-semibold text-nilin-charcoal">Recent Actions</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setShowAuditDropdown(false);
                  navigate('/admin/audit');
                }}
                className="p-1.5 rounded-lg hover:bg-nilin-blush/50 text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
                aria-label="View full audit log"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAuditDropdown(false)}
                className="p-1.5 rounded-lg hover:bg-nilin-blush/50 text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
                aria-label="Close dropdown"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dropdown Content */}
          <div className="max-h-80 overflow-y-auto">
            {isLoadingActions ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentActions.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-nilin-border" />
                <p className="text-sm text-nilin-warmGray">No recent actions</p>
              </div>
            ) : (
              <ul className="py-1">
                {recentActions.map((action) => (
                  <li key={action.id}>
                    <div className="px-4 py-3 hover:bg-nilin-blush/30 transition-colors border-b border-nilin-border/30 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-nilin-charcoal truncate">
                            {action.description}
                          </p>
                          <p className="text-xs text-nilin-warmGray mt-0.5">
                            by {action.adminName}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getActionColor(
                              action.action
                            )}`}
                          >
                            {action.action}
                          </span>
                          <span className="text-xs text-nilin-warmGray">
                            {formatRelativeTime(action.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="px-4 py-3 border-t border-nilin-border">
            <button
              onClick={() => {
                setShowAuditDropdown(false);
                navigate('/admin/audit');
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
            >
              <FileText className="w-4 h-4" />
              View Full Audit Log
            </button>
          </div>
        </div>
      )}
    </div>
    </PermissionGate>
  );

  return (
    <>
      {/* Offline/Online Indicator Banner */}
      {showOfflineBanner && (
        <div
          className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-lg animate-slide-down"
          role="alert"
          aria-live="assertive"
        >
          <WifiOff className="w-5 h-5" />
          <span className="font-medium">You are offline. Some features may be unavailable.</span>
          <button
            onClick={() => setShowOfflineBanner(false)}
            className="ml-4 p-1 hover:bg-amber-600 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Dismiss offline notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Online indicator (brief flash when coming back online) */}
      {!showOfflineBanner && !isOnline && (
        <div
          className="fixed top-0 left-0 right-0 z-[200] bg-green-500 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-lg animate-slide-down"
          role="status"
          aria-live="polite"
        >
          <Wifi className="w-5 h-5" />
          <span className="font-medium">Connection restored</span>
        </div>
      )}

    <PageLayout
      title={title}
      subtitle={subtitle}
      breadcrumbItems={crumbs}
      backHref={backHref}
      headerActions={
        <>
          {mobileNavButton}
          {searchButton}
          <NotificationBell onNotificationClick={handleNotificationClick} />
          {auditButton}
          {headerActions}
        </>
      }
      contentWidth={wideLayout ? 'wide' : 'default'}
    >
      {showSidebar ? (
        <div className="flex flex-col xl:flex-row gap-4">
          <aside className="hidden xl:block xl:w-[15.5rem] flex-shrink-0">
            <div className="xl:sticky xl:top-6">
              <AdminNav pendingVerifications={pendingVerifications} />
            </div>
          </aside>
          <div className="flex-1 min-w-0 overflow-x-auto">{children}</div>
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto">{children}</div>
      )}
      {showSidebar && mobileNavOpen && (
        <div className="fixed inset-0 z-[150] xl:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] bg-white shadow-2xl p-4 overflow-y-auto animate-slide-in-left">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-nilin-charcoal">Admin menu</p>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-nilin-blush/40"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <AdminNav
              pendingVerifications={pendingVerifications}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}
      {isSearchOpen && <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />}
    </PageLayout>
    </>
  );
}

export default AdminPageShell;
