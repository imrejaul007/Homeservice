import React, { useEffect, useState, useCallback } from 'react';
import { Star, Loader2, AlertCircle, PenLine, RefreshCw } from 'lucide-react';
import { experienceApi } from '../../services/experienceApi';
import type { Experience } from '../../types/experience';
import ExperienceSubmissionForm from './ExperienceSubmissionForm';
import { cn } from '@/lib/utils';

const statusStyles = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const MyExperiencesSection: React.FC = () => {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingExperience, setEditingExperience] = useState<Experience | null>(null);

  const fetchMyExperiences = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await experienceApi.getMyExperiences({ limit: 20 });
      if (response.success) {
        setExperiences(response.data.experiences || []);
      } else {
        setError('Failed to load your submissions');
      }
    } catch {
      setError('Failed to load your submissions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyExperiences();
  }, [fetchMyExperiences]);

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-3.5 w-3.5',
            star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'
          )}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-nilin-coral" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 p-4 bg-nilin-error/10 border border-nilin-error/20 rounded-xl">
            <AlertCircle className="h-5 w-5 text-nilin-error" />
            <p className="text-sm text-nilin-error">{error}</p>
            <button onClick={fetchMyExperiences} className="ml-auto text-sm text-nilin-error hover:underline">
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (experiences.length === 0) {
    return null;
  }

  return (
    <section className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">My Submissions</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Track the status of experiences you&apos;ve shared</p>
          </div>
          <button
            onClick={fetchMyExperiences}
            className="p-2 rounded-xl border border-nilin-border hover:bg-white/50 transition-colors"
            aria-label="Refresh submissions"
          >
            <RefreshCw className="h-4 w-4 text-nilin-warmGray" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {experiences.map((experience) => (
            <div
              key={experience._id}
              className="bg-white/80 backdrop-blur-sm rounded-nilin border border-nilin-border/50 p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-nilin-charcoal truncate">{experience.title}</h3>
                  {renderStars(experience.rating)}
                </div>
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border capitalize flex-shrink-0',
                    statusStyles[experience.status]
                  )}
                >
                  {experience.status}
                </span>
              </div>

              <p className="text-sm text-nilin-warmGray line-clamp-2 mb-3">{experience.description}</p>

              {experience.status === 'rejected' && experience.adminNotes && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 mb-3">
                  Reason: {experience.adminNotes}
                </p>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-nilin-warmGray">
                  {new Date(experience.createdAt).toLocaleDateString()}
                </p>
                {(experience.status === 'rejected' || experience.status === 'pending') && (
                  <button
                    onClick={() => setEditingExperience(experience)}
                    className="inline-flex items-center gap-1 text-sm text-nilin-coral hover:underline font-medium"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    {experience.status === 'rejected' ? 'Edit & Resubmit' : 'Edit'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingExperience && (
        <ExperienceSubmissionForm
          isOpen={!!editingExperience}
          onClose={() => setEditingExperience(null)}
          onSuccess={() => {
            setEditingExperience(null);
            fetchMyExperiences();
          }}
          experienceId={editingExperience._id}
          initialData={{
            bookingId: typeof editingExperience.bookingId === 'string'
              ? editingExperience.bookingId
              : '',
            title: editingExperience.title,
            description: editingExperience.description,
            rating: editingExperience.rating,
            images: editingExperience.images || [],
            videoUrl: editingExperience.videoUrl || '',
          }}
          lockBooking={!!editingExperience.bookingId}
        />
      )}
    </section>
  );
};

export default MyExperiencesSection;
