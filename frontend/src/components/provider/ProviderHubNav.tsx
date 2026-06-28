import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  CalendarDays,
  DollarSign,
  MessageSquare,
  BarChart,
  Settings,
  Wallet,
  Activity,
  Package,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/provider/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/provider/services', label: 'Services', icon: Briefcase },
  { to: '/provider/bookings', label: 'Bookings', icon: Calendar },
  { to: '/provider/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/provider/bundles', label: 'Bundles', icon: Package },
  { to: '/provider/earnings', label: 'Earnings', icon: DollarSign },
  { to: '/provider/payouts', label: 'Payouts', icon: Wallet },
  { to: '/provider/operations', label: 'Operations', icon: Activity },
  { to: '/provider/messages', label: 'Messages', icon: MessageSquare },
  { to: '/provider/analytics', label: 'Analytics', icon: BarChart },
  { to: '/provider/settings', label: 'Settings', icon: Settings },
] as const;

const isActivePath = (pathname: string, to: string): boolean =>
  pathname === to || pathname.startsWith(`${to}/`);

const ProviderHubNav: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Provider account"
      className="sticky top-0 z-40 -mt-px border-b dash-divider bg-[var(--dash-canvas,ffffff)]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="flex gap-1.5 overflow-x-auto py-2 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = isActivePath(pathname, to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] text-[13px] font-medium transition-colors duration-150 rounded-[var(--dash-radius-pill)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-cta)] focus-visible:ring-offset-2
                  ${active
                    ? 'bg-[var(--dash-cta)] text-[var(--dash-cta-text)]'
                    : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:bg-[var(--dash-surface-raised)]'
                  }`}
              >
                <Icon className="w-4 h-4" aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default ProviderHubNav;
