import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid3X3, List, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useSearchStore, searchSelectors } from '@/store/searchStore';
import ServiceCard from './ServiceCard';
import { cn } from '@/lib/utils';

interface SearchResultsProps {
  className?: string;
  layout?: 'grid' | 'list';
  onLayoutChange?: (layout: 'grid' | 'list') => void;
  showLayoutToggle?: boolean;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  className,
  layout = 'grid',
  onLayoutChange,
  showLayoutToggle = true,
}) => {
  const navigate = useNavigate();
  const {
    services,
    totalCount,
    currentPage,
    totalPages,
    filters,
    isLoading,
    error,
    setFilters,
    performSearch,
  } = useSearchStore();

  const isEmpty = searchSelectors.isEmpty(useSearchStore.getState());
  const hasResults = searchSelectors.hasResults(useSearchStore.getState());
  const currentQuery = searchSelectors.currentQuery(useSearchStore.getState());

  const handlePageChange = (page: number) => {
    setFilters({ page });
    performSearch();
    // Scroll to top of results
    document.querySelector('.search-results')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleServiceClick = (service: any) => {
    navigate(`/services/${service._id}`);
  };

  const handleProviderClick = (providerId: string) => {
    console.log('Provider clicked:', providerId);
    // TODO: Implement navigation to provider profile
  };

  const handleFavorite = (serviceId: string) => {
    console.log('Favorite toggled:', serviceId);
    // TODO: Implement favorite functionality
  };

  const handleShare = (service: any) => {
    if (navigator.share) {
      navigator.share({
        title: service.name,
        text: service.shortDescription || service.description,
        url: window.location.href,
      });
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(window.location.href);
      // TODO: Show toast notification
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages = [];
      const showPages = 5;
      let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
      let endPage = Math.min(totalPages, startPage + showPages - 1);

      if (endPage - startPage < showPages - 1) {
        startPage = Math.max(1, endPage - showPages + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      return pages;
    };

    return (
      // NILIN: glass-nilin background and border-nilin separator
      <div className="flex items-center justify-between border-t border-nilin glass-nilin px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            // NILIN: rounded-nilin styling
            className="relative inline-flex items-center rounded-nilin border border-nilin/30 bg-white px-4 py-2 text-sm font-medium text-nilin-charcoal hover:bg-nilin-blush/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            // NILIN: rounded-nilin styling
            className="relative ml-3 inline-flex items-center rounded-nilin border border-nilin/30 bg-white px-4 py-2 text-sm font-medium text-nilin-charcoal hover:bg-nilin-blush/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            {/* NILIN: text-nilin-charcoal */}
            <p className="text-sm text-nilin-charcoal">
              Showing{' '}
              <span className="font-medium">
                {(currentPage - 1) * (filters.limit || 10) + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(currentPage * (filters.limit || 10), totalCount)}
              </span>{' '}
              of{' '}
              <span className="font-medium">{totalCount}</span> results
            </p>
          </div>
          <div>
            {/* NILIN: rounded-nilin styling for pagination */}
            <nav className="isolate inline-flex -space-x-px rounded-nilin shadow-nilin" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-nilin px-2 py-2 text-nilin-charcoal ring-1 ring-inset ring-nilin/30 hover:bg-nilin-blush/30 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={cn(
                    'relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 rounded-nilin',
                    page === currentPage
                      ? 'z-10 bg-nilin text-white focus:bg-nilin/90'
                      : 'text-nilin-charcoal ring-1 ring-inset ring-nilin/30 hover:bg-nilin-blush/30'
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-nilin px-2 py-2 text-nilin-charcoal ring-1 ring-inset ring-nilin/30 hover:bg-nilin-blush/30 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('search-results', className)}>
      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          {/* NILIN: text-nilin-charcoal */}
          <h2 className="text-xl font-semibold text-nilin-charcoal">
            {currentQuery ? (
              <>
                Results for "<span className="text-nilin">{currentQuery}</span>"
              </>
            ) : (
              'All Services'
            )}
          </h2>
          {!isLoading && (
            <p className="text-sm text-nilin-charcoal/70 mt-1">
              {totalCount === 0 ? 'No services found' : `${totalCount} services found`}
            </p>
          )}
        </div>

        {/* Layout Toggle - NILIN: rounded-nilin styling */}
        {showLayoutToggle && hasResults && (
          <div className="flex items-center border border-nilin/30 rounded-nilin overflow-hidden">
            <button
              onClick={() => onLayoutChange?.('grid')}
              className={cn(
                'p-2 transition-colors',
                layout === 'grid'
                  ? 'bg-nilin text-white'
                  : 'bg-white text-nilin-charcoal hover:bg-nilin-blush/30'
              )}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onLayoutChange?.('list')}
              className={cn(
                'p-2 transition-colors',
                layout === 'list'
                  ? 'bg-nilin text-white'
                  : 'bg-white text-nilin-charcoal hover:bg-nilin-blush/30'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-nilin mx-auto mb-4" />
            <p className="text-nilin-charcoal">Searching for services...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-nilin-charcoal font-medium mb-2">Search Error</p>
            <p className="text-nilin-charcoal/70 mb-4">{error}</p>
            <button
              onClick={() => performSearch()}
              // NILIN: rounded-nilin and shadow-nilin
              className="bg-nilin hover:bg-nilin/90 text-white px-4 py-2 rounded-nilin transition-colors shadow-nilin"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && !isLoading && !error && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-6xl mb-4">&#128269;</div>
            <p className="text-nilin-charcoal font-medium mb-2">No services found</p>
            <p className="text-nilin-charcoal/70 mb-4">
              Try adjusting your search terms or filters
            </p>
          </div>
        </div>
      )}

      {/* Results Grid/List - NILIN: animate-nilin-in for results appearing */}
      {hasResults && !isLoading && !error && (
        <>
          <div
            className={cn(
              'mb-8',
              layout === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-6'
            )}
          >
            {services.map((service, index) => (
              <div
                key={service._id}
                // NILIN: animate-nilin-in with staggered delay based on index
                className={cn(
                  'animate-nilin-in',
                  // Dynamic animation delay for staggered effect
                  `[animation-delay:${Math.min(index * 50, 500)}ms]`
                )}
              >
                <ServiceCard
                  service={service}
                  variant={layout === 'list' ? 'compact' : 'default'}
                  showDistance={true}
                  onServiceClick={handleServiceClick}
                  onProviderClick={handleProviderClick}
                  onFavorite={handleFavorite}
                  onShare={handleShare}
                  className={cn(
                    layout === 'list' ? 'flex-row' : '',
                    // NILIN: shadow-nilin for result cards
                    'shadow-nilin'
                  )}
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {renderPagination()}
        </>
      )}
    </div>
  );
};

export default SearchResults;
