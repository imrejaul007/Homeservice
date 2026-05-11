import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, User, ArrowRight, Star, Clock } from 'lucide-react';
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import { useAuthStore } from '../../stores/authStore';
import { searchApi } from '../../services/searchApi';
import type { Service } from '../../types/service';
import { CATEGORY_IMAGES } from '../../constants/images';

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const response = await searchApi.searchServices({ limit: 3, sortBy: 'popularity' });
        if (response.success && response.data?.services) {
          setRecentServices(response.data.services);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const quickActions = [
    { icon: Search, label: 'Browse Services', description: 'Find beauty & wellness', href: '/search' },
    { icon: Calendar, label: 'My Bookings', description: 'View upcoming appointments', href: '/customer/bookings' },
    { icon: User, label: 'My Profile', description: 'Update your details', href: '/customer/profile' },
  ];

  const getServiceImage = (service: Service): string => {
    if (service.images?.[0]) return service.images[0];
    const catSlug = service.category?.toLowerCase?.().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
    if (catSlug && CATEGORY_IMAGES[catSlug]) return CATEGORY_IMAGES[catSlug].card;
    return 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavigationHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 w-full">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Hi, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-gray-500 text-sm">Welcome back to NILIN</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.href)}
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-nilin-primary/10 flex items-center justify-center flex-shrink-0">
                <action.icon className="w-6 h-6 text-nilin-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm">{action.label}</h3>
                <p className="text-xs text-gray-500">{action.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-nilin-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Recent / Recommended Services */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recommended for you</h2>
            <button
              onClick={() => navigate('/search')}
              className="text-sm font-medium text-nilin-primary hover:text-nilin-primary-dark flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />
              ))}
            </div>
          ) : recentServices.length > 0 ? (
            <div className="space-y-3">
              {recentServices.map((service) => (
                <button
                  key={service._id}
                  onClick={() => navigate(`/services/${service._id}`)}
                  className="flex items-center gap-4 w-full p-3 bg-white rounded-2xl border border-gray-100 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    <img
                      src={getServiceImage(service)}
                      alt={service.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 group-hover:text-nilin-primary transition-colors">
                      {service.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {service.rating?.average?.toFixed(1) || '4.8'}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {service.duration || 60} min
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-bold text-gray-900 text-sm">
                      AED {service.price?.amount || 199}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <p className="text-gray-500 text-sm mb-4">No services to show yet</p>
              <button
                onClick={() => navigate('/search')}
                className="px-5 py-2 bg-nilin-primary text-white rounded-full text-sm font-semibold"
              >
                Browse Services
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CustomerDashboard;
