import React, { useState, useEffect } from 'react';
import { Star, Search, Filter, ChevronLeft, ChevronRight, Loader2, Sparkles, X, PenLine } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import Breadcrumb from '../components/common/Breadcrumb';
import ExperienceCard from '../components/experience/ExperienceCard';
import ExperienceSubmissionForm from '../components/experience/ExperienceSubmissionForm';
import MyExperiencesSection from '../components/experience/MyExperiencesSection';
import { experienceApi } from '../services/experienceApi';
import useWriteExperience from '../hooks/useWriteExperience';
import { useAuthStore } from '../stores/authStore';
import type { Experience } from '../types/experience';
import { cn } from '@/lib/utils';

const ExperiencesPage: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { isFormOpen, prefilledBookingId, openWriteExperience, closeWriteExperience } = useWriteExperience();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalExperiences, setTotalExperiences] = useState(0);
  const [stats, setStats] = useState({ total: 0, averageRating: 0 });
  const limit = 12;

  useEffect(() => {
    fetchExperiences();
  }, [currentPage, searchQuery, selectedRating]);

  const fetchExperiences = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await experienceApi.getExperiences({
        page: currentPage,
        limit,
        ...(searchQuery && { search: searchQuery }),
        ...(selectedRating && { minRating: selectedRating }),
      });

      if (response.success) {
        setExperiences(response.data.experiences || []);
        setTotalPages(response.data.pages || 1);
        setTotalExperiences(response.data.total || 0);
        setStats({
          total: response.data.total || 0,
          averageRating: response.data.stats?.averageRating || 0,
        });
      }
    } catch (err: any) {
      console.error('Error fetching experiences:', err);
      setError('Failed to load experiences. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchExperiences();
  };

  const handleRatingFilter = (rating: number | null) => {
    setSelectedRating(rating);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedRating(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || selectedRating;

  return (
    <div className="min-h-screen bg-gradient-to-br from-nilin-cream via-nilin-blush to-nilin-peach">
      <NavigationHeader />

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-nilin rounded-full mb-6 animate-nilin-in">
            <Sparkles className="w-4 h-4 text-nilin-coral" />
            <span className="text-sm text-nilin-charcoal">Community Stories</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-4 animate-nilin-in">
            The NILIN Experience
          </h1>
          <p className="text-lg text-nilin-warmGray max-w-2xl mx-auto animate-nilin-in" style={{ animationDelay: '0.1s' }}>
            Discover what our clients have to say about their beauty and wellness journeys with NILIN professionals.
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 mt-8 animate-nilin-in" style={{ animationDelay: '0.2s' }}>
            <div className="text-center">
              <p className="text-3xl font-serif text-nilin-charcoal">{stats.total}</p>
              <p className="text-sm text-nilin-warmGray">Experiences</p>
            </div>
            <div className="w-px h-12 bg-nilin-rose/30" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <p className="text-3xl font-serif text-nilin-charcoal">{stats.averageRating.toFixed(1)}</p>
              </div>
              <p className="text-sm text-nilin-warmGray">Average Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="py-6 px-4 sticky top-16 z-10 bg-white/80 backdrop-blur-md border-b border-nilin-rose/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <form onSubmit={handleSearch} className="w-full md:w-auto flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
                <input
                  type="text"
                  placeholder="Search experiences..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-nilin-cream border border-nilin-rose/20 rounded-nilin focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 text-nilin-charcoal placeholder:text-nilin-warmGray"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-nilin-warmGray hover:text-nilin-charcoal" />
                  </button>
                )}
              </div>
            </form>

            {/* Rating Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-nilin-warmGray" />
              <span className="text-sm text-nilin-warmGray mr-2">Filter:</span>
              {[5, 4, 3, 2, 1].map((rating) => (
                <button
                  key={rating}
                  onClick={() => handleRatingFilter(selectedRating === rating ? null : rating)}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    selectedRating === rating
                      ? 'bg-nilin-coral text-white'
                      : 'bg-nilin-cream text-nilin-charcoal hover:bg-nilin-blush'
                  )}
                >
                  <Star className={cn(
                    'w-4 h-4',
                    selectedRating === rating ? 'fill-white text-white' : 'text-amber-400 fill-amber-400'
                  )} />
                  {rating}+
                </button>
              ))}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-2 text-sm text-nilin-coral hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {isAuthenticated && <MyExperiencesSection />}

      {/* Experiences Grid Section */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Results count */}
          <div className="mb-6">
            <p className="text-nilin-warmGray">
              Showing {experiences.length} of {totalExperiences} experiences
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-nilin overflow-hidden animate-pulse">
                  <div className="h-64 bg-gray-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="text-center py-16">
              <p className="text-nilin-warmGray mb-4">{error}</p>
              <button
                onClick={fetchExperiences}
                className="px-6 py-3 bg-nilin-coral text-white rounded-nilin hover:bg-nilin-rose transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && experiences.length === 0 && (
            <div className="text-center py-16">
              <Sparkles className="w-16 h-16 text-nilin-coral mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">No experiences found</h3>
              <p className="text-nilin-warmGray mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your filters to see more results.'
                  : 'Be the first to share your NILIN experience!'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 bg-nilin-coral text-white rounded-nilin hover:bg-nilin-rose transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Experiences Grid */}
          {!isLoading && !error && experiences.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {experiences.map((experience, index) => (
                <div
                  key={experience._id}
                  className="animate-nilin-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <ExperienceCard experience={experience} />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !error && totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-12">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-nilin transition-all',
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-nilin-charcoal hover:bg-nilin-blush'
                )}
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  // Show first, last, current, and adjacent pages
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          'w-10 h-10 rounded-nilin font-medium transition-all',
                          page === currentPage
                            ? 'bg-nilin-coral text-white'
                            : 'bg-white text-nilin-charcoal hover:bg-nilin-blush'
                        )}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <span key={page} className="text-nilin-warmGray">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-nilin transition-all',
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-nilin-charcoal hover:bg-nilin-blush'
                )}
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-nilin-blush via-nilin-peach to-nilin-blush">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-serif text-nilin-charcoal mb-4">
            Share Your NILIN Experience
          </h2>
          <p className="text-nilin-warmGray mb-6">
            Completed a service? We'd love to hear about your experience!
          </p>
          <button
            onClick={() => openWriteExperience()}
            className="inline-flex items-center gap-2 px-8 py-4 bg-nilin-coral text-white rounded-nilin hover:bg-nilin-rose transition-colors hover-lift"
          >
            <PenLine className="w-5 h-5" />
            Write Your Experience
          </button>
        </div>
      </section>

      <Footer />

      <ExperienceSubmissionForm
        isOpen={isFormOpen}
        onClose={closeWriteExperience}
        onSuccess={fetchExperiences}
        bookingId={prefilledBookingId}
        lockBooking={!!prefilledBookingId}
      />
    </div>
  );
};

export default ExperiencesPage;
