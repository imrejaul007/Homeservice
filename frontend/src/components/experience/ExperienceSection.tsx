import React, { useEffect, useState } from 'react';
import { ArrowRight, AlertCircle, Sparkles, PenLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { experienceApi } from '../../services/experienceApi';
import type { Experience } from '../../types/experience';
import ExperienceSubmissionForm from './ExperienceSubmissionForm';
import ExperienceDraggableStack from './ExperienceDraggableStack';
import useWriteExperience from '../../hooks/useWriteExperience';

interface ExperienceSectionProps {
  limit?: number;
  showViewAll?: boolean;
  title?: string;
  subtitle?: string;
}

const DraggableSkeleton: React.FC = () => (
  <div className="relative mx-auto w-full min-h-[640px] sm:min-h-[720px] rounded-[2rem] overflow-hidden">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="absolute w-[260px] sm:w-[300px] rounded-2xl bg-white/60 animate-pulse p-4 shadow-lg"
        style={{
          top: `${(i % 3) * 28 + 8}%`,
          left: `${(i * 17) % 70 + 5}%`,
          transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (4 + i)}deg)`,
        }}
      >
        <div className="h-52 bg-gray-200/80 rounded-xl mb-4" />
        <div className="h-4 bg-gray-200/80 rounded w-3/4 mb-2" />
        <div className="h-3 bg-gray-200/80 rounded w-full" />
      </div>
    ))}
  </div>
);

const ExperienceSection: React.FC<ExperienceSectionProps> = ({
  limit = 10,
  showViewAll = true,
  title = 'The NILIN Experience',
  subtitle = 'Crafted for perfection',
}) => {
  const navigate = useNavigate();
  const { isFormOpen, prefilledBookingId, openWriteExperience, closeWriteExperience } = useWriteExperience();
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

      let response;
      try {
        response = await experienceApi.getFeaturedExperiences();
        if (!response.success || response.data.experiences.length === 0) {
          throw new Error('No featured experiences');
        }
      } catch {
        response = await experienceApi.getExperiences({ limit: Math.max(limit, 10) });
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

  const sectionClass =
    'py-16 px-2 sm:px-3 lg:px-4 bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream animate-nilin-in';

  if (isLoading) {
    return (
      <section className={sectionClass}>
        <div className="max-w-[100rem] mx-auto">
          <div className="text-center mb-10">
            <div className="h-8 bg-white/50 rounded-lg w-64 mx-auto mb-3 animate-pulse" />
            <div className="h-4 bg-white/50 rounded w-48 mx-auto animate-pulse" />
          </div>
          <DraggableSkeleton />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={sectionClass}>
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

  if (experiences.length === 0) {
    return (
      <section className={sectionClass}>
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
              onClick={() => navigate('/customer/bookings')}
              className="mt-4 px-6 py-2 bg-nilin-coral text-white rounded-nilin hover-lift transition-all"
            >
              Book a Service
            </button>
            <button
              onClick={() => openWriteExperience()}
              className="mt-3 block mx-auto px-6 py-2 glass-nilin rounded-nilin text-nilin-charcoal font-medium hover-lift transition-all"
            >
              Write Your Experience
            </button>
          </div>
        </div>
        <ExperienceSubmissionForm
          isOpen={isFormOpen}
          onClose={closeWriteExperience}
          onSuccess={fetchExperiences}
          bookingId={prefilledBookingId}
          lockBooking={!!prefilledBookingId}
        />
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <div className="max-w-[100rem] mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 animate-nilin-in px-1">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-sm rounded-full mb-4 border border-white/80 shadow-sm">
            <Sparkles className="w-4 h-4 text-nilin-coral" />
            <span className="text-sm font-semibold text-nilin-charcoal">Discover</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-3">{title}</h2>
          <p className="text-lg md:text-xl text-nilin-charcoal/75 max-w-2xl mx-auto">{subtitle}</p>
        </div>

        {/* Draggable card canvas */}
        <div className="animate-nilin-in" style={{ animationDelay: '0.1s' }}>
          <ExperienceDraggableStack experiences={experiences} subtitle={subtitle} />
        </div>

        {/* Actions */}
        {showViewAll && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 animate-nilin-in" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => navigate('/experiences')}
              className="inline-flex items-center gap-2 px-8 py-4 glass-nilin rounded-nilin text-nilin-charcoal font-medium hover-lift transition-all"
            >
              View All Experiences
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => openWriteExperience()}
              className="inline-flex items-center gap-2 px-8 py-4 bg-nilin-coral text-white rounded-nilin font-medium hover-lift transition-all"
            >
              <PenLine className="w-5 h-5" />
              Write Your Experience
            </button>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 px-1">
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

      <ExperienceSubmissionForm
        isOpen={isFormOpen}
        onClose={closeWriteExperience}
        onSuccess={fetchExperiences}
        bookingId={prefilledBookingId}
        lockBooking={!!prefilledBookingId}
      />
    </section>
  );
};

export default ExperienceSection;
