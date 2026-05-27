import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Breadcrumb from '../common/Breadcrumb';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBreadcrumb?: boolean;
  breadcrumbItems?: Array<{
    label: string;
    href?: string;
    current?: boolean;
  }>;
  className?: string;
  headerActions?: React.ReactNode;
  backHref?: string;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  subtitle,
  showBreadcrumb = true,
  breadcrumbItems,
  className = '',
  headerActions,
  backHref
}) => {
  return (
    <div className={`min-h-screen bg-nilin-cream ${className}`}>
      {/* Breadcrumb Navigation */}
      {showBreadcrumb && (
        <div className="bg-white border-b border-nilin-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <Breadcrumb items={breadcrumbItems} />
          </div>
        </div>
      )}

      {/* Page Header */}
      {(title || headerActions || backHref) && (
        <div className="bg-white border-b border-nilin-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {backHref && (
                  <Link
                    to={backHref}
                    className="flex items-center justify-center w-10 h-10 rounded-xl border border-nilin-border bg-white hover:bg-nilin-blush/50 transition-colors text-nilin-charcoal"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                )}
                <div>
                  {title && (
                    <h1 className="text-2xl font-bold text-nilin-charcoal">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-sm text-nilin-warmGray">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {headerActions && (
                <div className="flex items-center space-x-3">
                  {headerActions}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;