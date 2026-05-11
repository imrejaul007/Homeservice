import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageLayout from '../../components/layout/PageLayout';
import AvailabilityManager from '../../components/booking/AvailabilityManager';
import { useAuthStore } from '../../stores/authStore';

const AvailabilityPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Redirect if not a provider
  React.useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/provider/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Availability Management</h1>
              <p className="mt-1 text-sm text-gray-600">
                Set your working hours and manage your availability for bookings
              </p>
            </div>
          </div>
        </div>

        {/* Availability Manager Component */}
        <AvailabilityManager className="mt-6" />

        {/* Additional Information */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Tips for Managing Availability</h3>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• Set regular working hours for each day of the week</li>
            <li>• Add buffer time between appointments to avoid back-to-back bookings</li>
            <li>• Block out dates for holidays or personal time off in advance</li>
            <li>• Update your availability promptly to avoid missed opportunities</li>
            <li>• Consider enabling instant booking for trusted customers</li>
          </ul>
        </div>
      </div>
    </PageLayout>
  );
};

export default AvailabilityPage;