import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Calendar, User, Wallet, Sparkles, BarChart3, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: <Home className="h-6 w-6" strokeWidth={1.5} />,
    activeIcon: <Home className="h-6 w-6" strokeWidth={2.5} />,
  },
  {
    label: 'Search',
    href: '/search',
    icon: <Search className="h-6 w-6" strokeWidth={1.5} />,
    activeIcon: <Search className="h-6 w-6" strokeWidth={2.5} />,
  },
  {
    label: 'Bookings',
    href: '/customer/bookings',
    icon: <Calendar className="h-6 w-6" strokeWidth={1.5} />,
    activeIcon: <Calendar className="h-6 w-6" strokeWidth={2.5} />,
  },
  {
    label: 'Wallet',
    href: '/customer/wallet',
    icon: <Wallet className="h-6 w-6" strokeWidth={1.5} />,
    activeIcon: <Wallet className="h-6 w-6" strokeWidth={2.5} />,
  },
  {
    label: 'Profile',
    href: '/customer/profile',
    icon: <User className="h-6 w-6" strokeWidth={1.5} />,
    activeIcon: <User className="h-6 w-6" strokeWidth={2.5} />,
  },
];

const moreNavItems: NavItem[] = [
  {
    label: 'SuperApp',
    href: '/customer/superapp',
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    activeIcon: <Zap className="h-5 w-5" strokeWidth={2.5} />,
  },
  {
    label: 'Profile',
    href: '/customer/profile',
    icon: <User className="h-5 w-5" strokeWidth={1.5} />,
    activeIcon: <User className="h-5 w-5" strokeWidth={2.5} />,
  },
];

interface BottomNavProps {
  className?: string;
  userRole?: 'customer' | 'provider' | 'admin';
}

export const BottomNav: React.FC<BottomNavProps> = ({
  className,
  userRole = 'customer',
}) => {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const getNavItems = () => {
    if (userRole === 'provider') {
      return [
        { label: 'Home', href: '/', icon: <Home className="h-6 w-6" strokeWidth={1.5} />, activeIcon: <Home className="h-6 w-6" strokeWidth={2.5} /> },
        { label: 'Search', href: '/search', icon: <Search className="h-6 w-6" strokeWidth={1.5} />, activeIcon: <Search className="h-6 w-6" strokeWidth={2.5} /> },
        { label: 'Bookings', href: '/provider/bookings', icon: <Calendar className="h-6 w-6" strokeWidth={1.5} />, activeIcon: <Calendar className="h-6 w-6" strokeWidth={2.5} /> },
        { label: 'Profile', href: '/provider/profile', icon: <User className="h-6 w-6" strokeWidth={1.5} />, activeIcon: <User className="h-6 w-6" strokeWidth={2.5} /> },
      ];
    } else if (userRole === 'admin') {
      return [
        { label: 'Home', href: '/', icon: <Home className="h-6 w-6" strokeWidth={1.5} />, activeIcon: <Home className="h-6 w-6" strokeWidth={2.5} /> },
        { label: 'Search', href: '/search', icon: <Search className="h-6 w-6" strokeWidth={1.5} />, activeIcon: <Search className="h-6 w-6" strokeWidth={2.5} /> },
        { label: 'Dashboard', href: '/admin/dashboard', icon: <BarChart3 className="h-6 w-6" strokeWidth={1.5} />, activeIcon: <BarChart3 className="h-6 w-6" strokeWidth={2.5} /> },
        { label: 'Profile', href: '/admin/settings', icon: <User className="h-6 w-6" strokeWidth={1.5} />, activeIcon: <User className="h-6 w-6" strokeWidth={2.5} /> },
      ];
    }
    return navItems;
  };

  const activeNavItems = getNavItems();

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  if (userRole === 'customer') {
    return (
      <>
        {/* Main Bottom Nav */}
        <nav aria-label="Main navigation" className={cn(
          'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40',
          'flex items-center justify-around py-2 px-2 safe-area-bottom',
          className
        )}>
          {activeNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all',
                isActive(item.href)
                  ? 'text-nilin-coral'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              {isActive(item.href) ? item.activeIcon : item.icon}
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          ))}

          {/* More Button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all',
              showMore ? 'text-nilin-coral' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-xs mt-1 font-medium">More</span>
          </button>
        </nav>

        {/* More Menu Overlay */}
        {showMore && (
          <>
            <div
              className="fixed inset-0 bg-black/30 z-30"
              onClick={() => setShowMore(false)}
            />
            <div className="fixed bottom-20 left-0 right-0 bg-white rounded-t-3xl z-40 p-4 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-nilin-charcoal">More</h3>
                <button
                  onClick={() => setShowMore(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {moreNavItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-xl transition-all',
                      isActive(item.href)
                        ? 'bg-nilin-coral/10 text-nilin-coral'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {isActive(item.href) ? item.activeIcon : item.icon}
                    <span className="text-xs mt-1 font-medium text-center">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // Simple nav for provider/admin
  return (
    <nav aria-label="Main navigation" className={cn(
      'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40',
      'flex items-center justify-around py-2 px-2 safe-area-bottom',
      className
    )}>
      {activeNavItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className={cn(
            'flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all',
            isActive(item.href)
              ? 'text-nilin-coral'
              : 'text-gray-400 hover:text-gray-600'
          )}
        >
          {isActive(item.href) ? item.activeIcon : item.icon}
          <span className="text-xs mt-1 font-medium">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
};

export default BottomNav;
