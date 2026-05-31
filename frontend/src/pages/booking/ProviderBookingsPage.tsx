import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { BookingList } from '../../components/booking';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';

const ProviderBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // FIX: Simulate initial load delay for skeleton animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <PageErrorBoundary pageName="Service Requests">
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4 transition-colors font-sans text-sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Service Requests</h1>
            <p className="text-nilin-warmGray font-sans">
              Review, accept, and manage incoming bookings from your customers
            </p>
          </div>

          {/* FIX: Loading skeleton for initial load */}
          {isInitialLoad ? (
            <div className="space-y-4">
              {/* Header skeleton */}
              <div className="flex items-center gap-4 p-4 glass-nilin rounded-nilin animate-pulse">
                <div className="w-full">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="h-5 bg-nilin-muted rounded w-48 mb-2"></div>
                      <div className="h-4 bg-nilin-muted rounded w-32"></div>
                    </div>
                    <div className="h-6 w-24 bg-nilin-muted rounded-full"></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-4 bg-nilin-muted rounded w-40"></div>
                    <div className="h-4 bg-nilin-muted rounded w-24"></div>
                  </div>
                </div>
              </div>
              {/* Repeat for more skeleton rows */}
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 p-4 glass-nilin rounded-nilin animate-pulse opacity-60">
                  <div className="w-full">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="h-5 bg-nilin-muted rounded w-40 mb-2"></div>
                        <div className="h-4 bg-nilin-muted rounded w-28"></div>
                      </div>
                      <div className="h-6 w-20 bg-nilin-muted rounded-full"></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-4 bg-nilin-muted rounded w-36"></div>
                      <div className="h-4 bg-nilin-muted rounded w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <BookingList userType="provider" hideHeader />
          )}
        </div>
      </PageErrorBoundary>

      <Footer />
    </div>
  );
};

export default ProviderBookingsPage;
