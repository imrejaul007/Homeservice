import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  PlusCircle,
  Wallet,
  Bell,
  User,
  Star,
} from 'lucide-react';
import { useComparisonStore } from '../../stores/comparisonStore';

const NAV_ITEMS = [
  { to: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customer/bookings', label: 'Bookings', icon: Calendar },
  { to: '/customer/book-services', label: 'Book', icon: PlusCircle },
  { to: '/customer/wallet', label: 'Wallet', icon: Wallet },
  { to: '/customer/notifications', label: 'Alerts', icon: Bell },
  { to: '/customer/reviews', label: 'Reviews', icon: Star },
  { to: '/customer/profile', label: 'Profile', icon: User },
] as const;

const isActivePath = (pathname: string, to: string): boolean => {
  if (to === '/customer/dashboard') {
    return pathname === to || pathname === '/customer';
  }
  return pathname === to || pathname.startsWith(`${to}/`);
};

const CustomerHubNav: React.FC = () => {
  const { pathname } = useLocation();
  const comparisonCount = useComparisonStore((s) => s.items.length);

  return (
    <nav
      aria-label="Customer account"
      className="sticky top-0 z-40 -mt-px border-b dash-divider bg-[var(--dash-canvas,ffffff)]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="flex gap-1.5 overflow-x-auto py-2 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = isActivePath(pathname, to);
            const isBookItem = to === '/customer/book-services';
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex-shrink-0 relative inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium transition-colors duration-150 rounded-[var(--dash-radius-pill)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-cta)] focus-visible:ring-offset-2
                  ${active
                    ? 'bg-[var(--dash-cta)] text-[var(--dash-cta-text)]'
                    : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:bg-[var(--dash-surface-raised)]'
                  }`}
              >
                <Icon className="w-4 h-4" aria-hidden />
                <span>{label}</span>
                {isBookItem && comparisonCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-nilin-coral text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {comparisonCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default CustomerHubNav;
