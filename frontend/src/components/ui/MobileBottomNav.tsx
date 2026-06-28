import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

interface MobileBottomNavProps {
  items: NavItem[];
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ items }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 z-50 md:hidden" aria-label="Mobile navigation">
      <div className="flex justify-around">
        {items.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${item.label}${isActive ? ', current page' : ''}`}
              className={`flex flex-col items-center gap-1 p-2 min-w-[60px] min-h-[48px] ${isActive ? 'text-nilin-coral' : 'text-gray-400'} focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded-lg`}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
