import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();

  // Auto-generate breadcrumbs if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always start with Home
    breadcrumbs.push({
      label: 'Home',
      href: '/'
    });

    // Generate breadcrumbs based on current path
    let currentPath = '';
    
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      // Skip certain segments or provide custom labels
      let label = segment;
      let href = currentPath;

      switch (segment) {
        case 'admin':
        case 'provider':
        case 'customer':
          return; // Always skip role segments
        case 'dashboard':
          label = 'Dashboard';
          break;
        case 'bookings':
          label = 'Bookings';
          break;
        case 'profile':
          label = 'Profile';
          break;
        case 'favorites':
          label = 'Favorites';
          break;
        case 'rewards':
          label = 'Rewards';
          break;
        case 'search':
          label = 'Search Services';
          break;
        case 'services':
          if (index === 0) {
            label = 'Services';
          } else {
            label = 'Service Details';
            href = currentPath;
          }
          break;
        case 'register':
          label = 'Register';
          href = isLast ? '' : (href || '');
          break;
        case 'verification-pending':
          label = 'Verification Pending';
          href = '';
          break;
        case 'account-suspended':
          label = 'Account Suspended';
          href = '';
          break;
        case 'verify-email-required':
          label = 'Email Verification Required';
          href = '';
          break;
        default:
          // Capitalize and remove hyphens/underscores
          label = segment
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
      }

      breadcrumbs.push({
        label,
        href: isLast ? undefined : href,
        current: isLast
      });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  // Don't show breadcrumbs on login/register pages or home page
  if (location.pathname.includes('/login') ||
      location.pathname.includes('/register') ||
      location.pathname === '/') {
    return null;
  }

  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="inline-flex items-center">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
            )}
            
            {item.href ? (
              <Link
                to={item.href}
                className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                {index === 0 && (
                  <Home className="w-4 h-4 mr-2" />
                )}
                {item.label}
              </Link>
            ) : (
              <span className="inline-flex items-center text-sm font-medium text-gray-500">
                {index === 0 && (
                  <Home className="w-4 h-4 mr-2" />
                )}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;