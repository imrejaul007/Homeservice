import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  TrendingDown,
  Layers,
  Gift,
  Ticket,
  Star,
  Key,
  Wrench,
  Settings,
  ChevronRight,
  Shield,
  UserCheck,
  LogOut,
  Bot,
  TrendingUp,
  FileText,
  Calendar,
  Gavel,
  Lock,
  Activity,
  Search,
  ShieldAlert,
  Package,
  Briefcase,
  Clock,
  Rocket,
  RotateCcw,
  ClipboardList,
  Image,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';
import { usePermissions } from '../../hooks/usePermissions';
import { NAV_PERMISSIONS, normalizeAdminRole, type AdminRole } from '../../types/permissions';

export interface AdminNavItem {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
  badge?: number;
  /** Minimum role required to see this nav item. Defaults to 'viewer'. */
  minRole?: AdminRole;
}

const NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Operations', description: 'Live overview', icon: LayoutDashboard, minRole: 'viewer' },
  { to: '/admin/reports', label: 'Reports & Analytics', description: 'Charts & exports', icon: BarChart3, minRole: 'viewer' },
  { to: '/admin/analytics', label: 'Analytics', description: 'Cohorts & funnels', icon: Activity, minRole: 'viewer' },
  { to: '/admin/executive', label: 'Executive', description: 'Leadership KPIs', icon: Briefcase, minRole: 'admin' },
  { to: '/admin/search-analytics', label: 'Search Analytics', description: 'Query insights', icon: Search, minRole: 'viewer' },
  { to: '/admin/custom-reports', label: 'Custom Reports', description: 'Report builder', icon: ClipboardList, minRole: 'admin' },
  { to: '/admin/fraud', label: 'Fraud Report', description: 'Suspicious activity', icon: ShieldAlert, minRole: 'moderator' },
  { to: '/admin/anomalies', label: 'Anomalies', description: 'Detection center', icon: Shield, minRole: 'moderator' },
  { to: '/admin/sla', label: 'SLA Compliance', description: 'Service levels', icon: Clock, minRole: 'viewer' },
  { to: '/admin/audit', label: 'Audit Log', description: 'Activity history', icon: FileText, minRole: 'viewer' },
  { to: '/admin/providers', label: 'Providers', description: 'Verification queue', icon: UserCheck, minRole: 'viewer' },
  { to: '/admin/providers/metrics', label: 'Provider Metrics', description: 'Quality dashboards', icon: TrendingUp, minRole: 'viewer' },
  { to: '/admin/bookings', label: 'Bookings', description: 'All reservations', icon: Calendar, minRole: 'moderator' },
  { to: '/admin/disputes', label: 'Disputes', description: 'Resolution center', icon: Gavel, minRole: 'moderator' },
  { to: '/admin/payouts', label: 'Payouts', description: 'Withdrawals', icon: Wallet, minRole: 'moderator' },
  { to: '/admin/refunds', label: 'Refunds', description: 'Refund requests', icon: RotateCcw, minRole: 'moderator' },
  { to: '/admin/churn', label: 'Churn & Retention', description: 'At-risk users', icon: TrendingDown, minRole: 'viewer' },
  { to: '/admin/categories', label: 'Categories', description: 'Service taxonomy', icon: Layers, minRole: 'admin' },
  { to: '/admin/bundles', label: 'Bundles', description: 'Package approval', icon: Package, minRole: 'admin' },
  { to: '/admin/offers', label: 'Offers', description: 'Promotions', icon: Gift, minRole: 'admin' },
  { to: '/admin/offers-analytics', label: 'Offer Analytics', description: 'Promo performance', icon: TrendingUp, minRole: 'admin' },
  { to: '/admin/curated-trending', label: 'Homepage Trending', description: 'Trending Now carousel', icon: TrendingUp, minRole: 'admin' },
  { to: '/admin/hero-slides', label: 'Hero Slides', description: 'Banner images', icon: Image, minRole: 'admin' },
  { to: '/admin/coupons', label: 'Coupons', description: 'Discount codes', icon: Ticket, minRole: 'admin' },
  { to: '/admin/reviews', label: 'Reviews', description: 'Moderation', icon: Star, minRole: 'moderator' },
  { to: '/admin/chatbot-builder', label: 'Chatbot Builder', description: 'IA Agents', icon: Bot, minRole: 'admin' },
  { to: '/admin/launch', label: 'Launch Readiness', description: 'Go-live checklist', icon: Rocket, minRole: 'admin' },
  { to: '/admin/api-keys', label: 'API Keys', description: 'Integrations', icon: Key, minRole: 'admin' },
  { to: '/admin/permissions', label: 'Permissions', description: 'Roles & access', icon: Lock, minRole: 'admin' },
  { to: '/admin/maintenance', label: 'Maintenance', description: 'Platform mode', icon: Wrench, minRole: 'admin' },
  { to: '/admin/settings', label: 'Settings', description: 'Configuration', icon: Settings, minRole: 'admin' },
];

interface AdminNavProps {
  pendingVerifications?: number;
  className?: string;
  onNavigate?: () => void;
}

export function AdminNav({ pendingVerifications = 0, className = '', onNavigate }: AdminNavProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { hasMinimumRole, hasPermission } = usePermissions();

  // Normalize the user's admin role
  const userAdminRole = normalizeAdminRole(user?.role);

  // Filter nav items based on permissions
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    // Check minimum role requirement
    if (item.minRole && !hasMinimumRole(item.minRole)) {
      return false;
    }

    // Check specific permissions for the nav item
    const requiredPermissions = NAV_PERMISSIONS[item.to];
    if (requiredPermissions && requiredPermissions.length > 0) {
      // User must have at least one of the required permissions
      return requiredPermissions.some(perm => hasPermission(perm));
    }

    return true;
  });

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    logout();
    navigate('/');
  };

  return (
    <nav
      className={`glass glass-blur rounded-2xl border border-nilin-border/50 p-3 ${className}`}
      aria-label="Admin navigation"
    >
      <div className="flex items-center gap-2 px-3 py-2 mb-2 border-b border-nilin-border/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-nilin-coral font-sans">
            {userAdminRole === 'super_admin' ? 'Super Admin' : userAdminRole === 'admin' ? 'Admin' : userAdminRole === 'moderator' ? 'Moderator' : 'Viewer'}
          </p>
          <p className="text-sm font-serif text-nilin-charcoal truncate">{user?.firstName || 'User'}</p>
        </div>
      </div>

      <ul className="space-y-1">
        {visibleNavItems.map((item) => {
          const badge =
            item.to === '/admin/providers' && pendingVerifications > 0
              ? pendingVerifications
              : item.badge;

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all font-sans ${
                    isActive
                      ? 'bg-gradient-to-r from-nilin-rose/90 to-nilin-coral text-white shadow-nilin-warm'
                      : 'text-nilin-charcoal hover:bg-nilin-blush/40'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="w-4 h-4 flex-shrink-0 opacity-90" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight" title={item.label}>
                        {item.label}
                      </p>
                      <p className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-nilin-warmGray'}`}>
                        {item.description}
                      </p>
                    </div>
                    {badge !== undefined && badge > 0 && (
                      <span
                        className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                          isActive ? 'bg-white text-nilin-coral' : 'bg-nilin-coral text-white'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                    <ChevronRight
                      className={`w-4 h-4 hidden sm:block transition-all ${
                        isActive ? 'opacity-80' : 'opacity-0 group-hover:opacity-50'
                      }`}
                    />
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

      {/* Logout Button */}
      <div className="mt-4 pt-3 border-t border-nilin-border/40">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all font-sans text-nilin-charcoal hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Logout</p>
            <p className="text-xs text-nilin-warmGray">Sign out</p>
          </div>
        </button>
      </div>
    </nav>
  );
}

export { NAV_ITEMS };
