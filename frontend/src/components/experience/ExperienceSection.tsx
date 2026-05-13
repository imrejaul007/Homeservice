import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { experienceApi } from '../../services/experienceApi';
import type { Experience } from '../../types/experience';
import ExperienceCard from './ExperienceCard';

interface ExperienceSectionProps {
  limit?: number;
  showViewAll?: boolean;
  title?: string;
  subtitle?: string;
}

interface SkeletonCardProps {
  isLarge?: boolean;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ isLarge = false }) => {
  return (
    <div
      className={`
        bg-white rounded-nilin overflow-hidden animate-pulse
        ${isLarge ? 'col-span-2 row-span-2' : ''}
      `}
    >
      <div className={`bg-gray-200 ${isLarge ? 'h-[400px]' : 'h-48'}`} />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="flex items-center justify-between pt-2">
          <div className="h-6 w-6 bg-gray-200 rounded-full" />
          <div className="h-3 bg-gray-200 rounded w-16" />
        </div>
      </div>
    </div>
  );
};

const ExperienceSection: React.FC<ExperienceSectionProps> = ({
  limit = 4,
  showViewAll = true,
  title = 'The NILIN Experience',
  subtitle = 'Crafted for perfection',
}) => {
  const navigate = useNavigate();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExperiences();
  }, [limit]);

  const fetchExperiences = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to fetch featured experiences first, fall back to regular experiences
      let response;
      try {
        response = await experienceApi.getFeaturedExperiences();
        if (!response.success || response.data.experiences.length === 0) {
          throw new Error('No featured experiences');
        }
      } catch {
        // Fall back to regular experiences
        response = await experienceApi.getExperiences({ limit: 6 });
      }

      if (response.success && response.data.experiences) {
        setExperiences(response.data.experiences.slice(0, limit));
      }
    } catch (err) {
      console.error('Failed to fetch experiences:', err);
      setError('Unable to load experiences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAll = () => {
    navigate('/experiences');
  };

  // Loading state
  if (isLoading) {
    return (
      <section className="py-16 px-4 bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream animate-nilin-in">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="text-center mb-12">
            <div className="h-8 bg-white/50 rounded-lg w-64 mx-auto mb-3 animate-pulse" />
            <div className="h-4 bg-white/50 rounded w-40 mx-auto animate-pulse" />
          </div>

          {/* Grid Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SkeletonCard isLarge />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="py-16 px-4 bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream animate-nilin-in">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif text-nilin-charcoal mb-3">{title}</h2>
            <p className="text-nilin-warmGray">{subtitle}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-nilin p-8 text-center">
            <AlertCircle className="w-12 h-12 text-nilin-coral mx-auto mb-4" />
            <p className="text-nilin-warmGray">{error}</p>
            <button
              onClick={fetchExperiences}
              className="mt-4 px-6 py-2 bg-nilin-coral text-white rounded-nilin hover-lift transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Empty state
  if (experiences.length === 0) {
    return (
      <section className="py-16 px-4 bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream animate-nilin-in">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif text-nilin-charcoal mb-3">{title}</h2>
            <p className="text-nilin-warmGray">{subtitle}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-nilin p-8 text-center">
            <Sparkles className="w-12 h-12 text-nilin-coral mx-auto mb-4" />
            <p className="text-nilin-charcoal font-medium mb-2">No experiences yet</p>
            <p className="text-nilin-warmGray text-sm">Be the first to share your NILIN experience!</p>
            <button
              onClick={() => navigate('/bookings')}
              className="mt-4 px-6 py-2 bg-nilin-coral text-white rounded-nilin hover-lift transition-all"
            >
              Book a Service
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-4 bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream animate-nilin-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-nilin-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-nilin rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-nilin-coral" />
            <span className="text-sm text-nilin-charcoal">Discover</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-serif text-nilin-charcoal mb-3">{title}</h2>
          <p className="text-nilin-warmGray text-lg">{subtitle}</p>
        </div>

        {/* Grid Layout: 2x2 by default */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-nilin-in" style={{ animationDelay: '0.1s' }}>
          {/* Top-Left: Large Featured Card (spans 2 columns, 2 rows) */}
          {experiences[0] && (
            <div className="col-span-2 row-span-2">
              <ExperienceCard experience={experiences[0]} isFeatured />
            </div>
          )}

          {/* Top-Right: Standard Card */}
          {experiences[1] && (
            <ExperienceCard experience={experiences[1]} />
          )}

          {/* Bottom-Left: Standard Card */}
          {experiences[2] && (
            <ExperienceCard experience={experiences[2]} />
          )}

          {/* Bottom-Right: Standard Card */}
          {experiences[3] && (
            <ExperienceCard experience={experiences[3]} />
          )}
        </div>

        {/* View All Link */}
        {showViewAll && (
          <div className="text-center mt-10 animate-nilin-in" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={handleViewAll}
              className="inline-flex items-center gap-2 px-8 py-4 glass-nilin rounded-nilin text-nilin-charcoal font-medium hover-lift transition-all"
            >
              View All Experiences
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { icon: '✨', title: 'Premium Products' },
            { icon: '🎯', title: 'Expert Stylists' },
            { icon: '🕐', title: 'Flexible Booking' },
            { icon: '💎', title: 'Luxury Experience' },
          ].map((feature, index) => (
            <div
              key={index}
              className="glass-nilin rounded-nilin p-4 text-center gradient-3d hover-lift animate-nilin-in"
              style={{ animationDelay: `${0.3 + index * 0.1}s` }}
            >
              <span className="text-2xl">{feature.icon}</span>
              <p className="text-sm font-medium text-nilin-charcoal mt-1">{feature.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExperienceSection;
