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
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
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
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={cn(
                    'relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20',
                    page === currentPage
                      ? 'z-10 bg-blue-600 text-white focus:bg-blue-500'
                      : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <h2 className="text-xl font-semibold text-gray-900">
            {currentQuery ? (
              <>
                Results for "<span className="text-blue-600">{currentQuery}</span>"
              </>
            ) : (
              'All Services'
            )}
          </h2>
          {!isLoading && (
            <p className="text-sm text-gray-600 mt-1">
              {totalCount === 0 ? 'No services found' : `${totalCount} services found`}
            </p>
          )}
        </div>

        {/* Layout Toggle */}
        {showLayoutToggle && hasResults && (
          <div className="flex items-center border border-gray-300 rounded-lg">
            <button
              onClick={() => onLayoutChange?.('grid')}
              className={cn(
                'p-2 rounded-l-lg transition-colors',
                layout === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onLayoutChange?.('list')}
              className={cn(
                'p-2 rounded-r-lg transition-colors',
                layout === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
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
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Searching for services...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-gray-900 font-medium mb-2">Search Error</p>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => performSearch()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
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
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-900 font-medium mb-2">No services found</p>
            <p className="text-gray-600 mb-4">
              Try adjusting your search terms or filters
            </p>
          </div>
        </div>
      )}

      {/* Results Grid/List */}
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
            {services.map((service) => (
              <ServiceCard
                key={service._id}
                service={service}
                variant={layout === 'list' ? 'compact' : 'default'}
                showDistance={true}
                onServiceClick={handleServiceClick}
                onProviderClick={handleProviderClick}
                onFavorite={handleFavorite}
                onShare={handleShare}
                className={layout === 'list' ? 'flex-row' : ''}
              />
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