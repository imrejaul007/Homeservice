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

  return (
    <nav
      aria-label="Customer account"
      className="sticky top-0 z-40 -mt-px border-b border-nilin-border/30 bg-white/95 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
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
                className={`flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-nilin-coral to-nilin-rose text-white shadow-md shadow-nilin-coral/25'
                    : 'text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-muted/80'
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

export default CustomerHubNav;
