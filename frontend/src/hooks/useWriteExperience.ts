import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function useWriteExperience() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [prefilledBookingId, setPrefilledBookingId] = useState<string | undefined>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const openWriteExperience = useCallback(
    (bookingId?: string) => {
      if (!isAuthenticated) {
        const returnUrl = window.location.pathname + window.location.search;
        navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }
      setPrefilledBookingId(bookingId);
      setIsFormOpen(true);
    },
    [isAuthenticated, navigate]
  );

  const closeWriteExperience = useCallback(() => {
    setIsFormOpen(false);
    setPrefilledBookingId(undefined);
  }, []);

  return {
    isFormOpen,
    prefilledBookingId,
    openWriteExperience,
    closeWriteExperience,
  };
}

export default useWriteExperience;
