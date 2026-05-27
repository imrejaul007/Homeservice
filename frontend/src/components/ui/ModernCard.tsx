import React from 'react';

interface ModernCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const ModernCard: React.FC<ModernCardProps> = ({ children, className = '', hover = true, onClick }) => (
  <div onClick={onClick}
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${
      hover ? 'hover:shadow-xl hover:-translate-y-1 hover:border-nilin-coral/20' : ''
    } transition-all duration-300 ${className}`}>
    {children}
  </div>
);
