import { NavLink } from 'react-router-dom';
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
} from 'lucide-react';

export interface AdminNavItem {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
  badge?: number;
}

const NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Operations', description: 'Live overview', icon: LayoutDashboard },
  { to: '/admin/reports', label: 'Reports & Analytics', description: 'Charts & exports', icon: BarChart3 },
  { to: '/admin/providers', label: 'Providers', description: 'Verification queue', icon: UserCheck },
  { to: '/admin/payouts', label: 'Payouts', description: 'Withdrawals', icon: Wallet },
  { to: '/admin/churn', label: 'Churn & Retention', description: 'At-risk users', icon: TrendingDown },
  { to: '/admin/categories', label: 'Categories', description: 'Service taxonomy', icon: Layers },
  { to: '/admin/offers', label: 'Offers', description: 'Promotions', icon: Gift },
  { to: '/admin/coupons', label: 'Coupons', description: 'Discount codes', icon: Ticket },
  { to: '/admin/reviews', label: 'Reviews', description: 'Moderation', icon: Star },
  { to: '/admin/api-keys', label: 'API Keys', description: 'Integrations', icon: Key },
  { to: '/admin/maintenance', label: 'Maintenance', description: 'Platform mode', icon: Wrench },
  { to: '/admin/settings', label: 'Settings', description: 'Configuration', icon: Settings },
];

interface AdminNavProps {
  pendingVerifications?: number;
  className?: string;
}

export function AdminNav({ pendingVerifications = 0, className = '' }: AdminNavProps) {
  return (
    <nav
      className={`glass glass-blur rounded-2xl border border-nilin-border/50 p-3 ${className}`}
      aria-label="Admin navigation"
    >
      <div className="flex items-center gap-2 px-3 py-2 mb-2 border-b border-nilin-border/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-nilin-coral font-sans">Admin</p>
          <p className="text-sm font-serif text-nilin-charcoal">Control center</p>
        </div>
      </div>

      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const badge =
            item.to === '/admin/providers' && pendingVerifications > 0
              ? pendingVerifications
              : item.badge;

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
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
                      <p className="text-sm font-medium truncate">{item.label}</p>
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
    </nav>
  );
}

export { NAV_ITEMS };
