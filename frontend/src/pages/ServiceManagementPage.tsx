import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import Breadcrumb from '../components/common/Breadcrumb';
import ServiceManagement from '../components/provider/ServiceManagement';

const ServiceManagementPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

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

          <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Service Management</h1>
          <p className="text-nilin-warmGray font-sans">
            Create, edit, and track performance of your service offerings
          </p>
        </div>

        <ServiceManagement />
      </div>

      <Footer />
    </div>
  );
};

export default ServiceManagementPage;
