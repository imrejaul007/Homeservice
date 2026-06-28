import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Scissors,
  Clock,
  Calendar,
  Check,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import PageLayout from '../../components/layout/PageLayout';
import ServiceAvailabilityManager from '../../components/booking/ServiceAvailabilityManager';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface Service {
  _id: string;
  name: string;
  category: string;
  price: { amount: number; currency: string };
  duration: number;
}

interface Bundle {
  _id: string;
  name: string;
  services: Array<{ serviceId: string; serviceName: string }>;
  bundlePrice: number;
  duration: number;
}

interface TabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}

const Tab: React.FC<TabProps> = ({ active, onClick, icon, label, count }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
      active
        ? 'bg-nilin-coral text-white shadow-md'
        : 'bg-white text-nilin-warmGray hover:bg-gray-50 border border-gray-200'
    )}
  >
    {icon}
    <span>{label}</span>
    {count !== undefined && (
      <span
        className={cn(
          'ml-1 px-2 py-0.5 rounded-full text-xs',
          active ? 'bg-white/20' : 'bg-gray-100'
        )}
      >
        {count}
      </span>
    )}
  </button>
);

const ServiceAvailabilityPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'services' | 'bundles'>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/provider/dashboard');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch provider's services
      const servicesRes = await api.get('/provider/services');
      const servicesPayload = servicesRes.data.data;
      const servicesList = Array.isArray(servicesPayload)
        ? servicesPayload
        : servicesPayload?.services || [];
      setServices(servicesList);

      // Fetch provider's bundles/packages
      const bundlesRes = await api.get('/bundles/my');
      const bundlesPayload = bundlesRes.data.data;
      setBundles(Array.isArray(bundlesPayload) ? bundlesPayload : bundlesPayload?.bundles || []);

      // Auto-select first service/bundle
      if (servicesList.length > 0) {
        setSelectedService(servicesList[0]._id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load services and packages');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleChange = (serviceId: string) => (hasSchedule: boolean) => {
    // Refresh data to update status indicators after schedule changes
    if (hasSchedule) {
      loadData();
    }
  };

  const formatPrice = (amount: number, currency: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/provider/dashboard')}
            className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-nilin-charcoal">
                Service Availability
              </h1>
              <p className="mt-2 text-nilin-warmGray">
                Set different availability for each service or package. Leave on "Global" to use your default working hours.
              </p>
            </div>
            <button
              onClick={loadData}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-nilin-warmGray" />
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">
              How per-service availability works
            </p>
            <p className="text-blue-700 mt-1">
              Set custom working hours for specific services or packages. For example, a 4-hour bridal package might only be available on weekdays, while regular haircuts are available 7 days a week.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-3 mb-6">
          <Tab
            active={activeTab === 'services'}
            onClick={() => {
              setActiveTab('services');
              if (services.length > 0) setSelectedService(services[0]._id);
            }}
            icon={<Scissors className="w-4 h-4" />}
            label="Services"
            count={services.length}
          />
          <Tab
            active={activeTab === 'bundles'}
            onClick={() => {
              setActiveTab('bundles');
              if (bundles.length > 0) setSelectedService(bundles[0]._id);
            }}
            icon={<Package className="w-4 h-4" />}
            label="Packages"
            count={bundles.length}
          />
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Service/Package List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-nilin-charcoal text-sm">
                  {activeTab === 'services' ? 'Your Services' : 'Your Packages'}
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {activeTab === 'services' ? (
                  services.length === 0 ? (
                    <div className="p-4 text-center text-nilin-warmGray text-sm">
                      No services found
                    </div>
                  ) : (
                    services.map((service) => (
                      <button
                        key={service._id}
                        onClick={() => setSelectedService(service._id)}
                        className={cn(
                          'w-full p-3 text-left hover:bg-gray-50 transition-colors',
                          selectedService === service._id && 'bg-nilin-coral/5 border-l-2 border-nilin-coral'
                        )}
                      >
                        <p className="font-medium text-nilin-charcoal text-sm truncate">
                          {service.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-nilin-warmGray">
                          <span>{formatPrice(service.price.amount, service.price.currency)}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(service.duration)}
                          </span>
                        </div>
                      </button>
                    ))
                  )
                ) : bundles.length === 0 ? (
                  <div className="p-4 text-center text-nilin-warmGray text-sm">
                    No packages found
                  </div>
                ) : (
                  bundles.map((bundle) => (
                    <button
                      key={bundle._id}
                      onClick={() => setSelectedService(bundle._id)}
                      className={cn(
                        'w-full p-3 text-left hover:bg-gray-50 transition-colors',
                        selectedService === bundle._id && 'bg-nilin-coral/5 border-l-2 border-nilin-coral'
                      )}
                    >
                      <p className="font-medium text-nilin-charcoal text-sm truncate">
                        {bundle.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-nilin-warmGray">
                        <span>{formatPrice(bundle.bundlePrice || 0)}</span>
                        <span>·</span>
                        <span>{bundle.services?.length || 0} services</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(bundle.duration || 0)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Availability Editor */}
          <div className="lg:col-span-2">
            {selectedService ? (
              activeTab === 'services' ? (
                <ServiceAvailabilityManager
                  serviceId={selectedService}
                  serviceName={services.find(s => s._id === selectedService)?.name || ''}
                  onScheduleChange={handleScheduleChange(selectedService)}
                />
              ) : (
                <ServiceAvailabilityManager
                  serviceId={selectedService}
                  serviceName={bundles.find(b => b._id === selectedService)?.name || ''}
                  bundleName={bundles.find(b => b._id === selectedService)?.name}
                  onScheduleChange={handleScheduleChange(selectedService)}
                />
              )
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-nilin-warmGray">
                  Select a {activeTab === 'services' ? 'service' : 'package'} to set availability
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </PageLayout>
  );
};

export default ServiceAvailabilityPage;
