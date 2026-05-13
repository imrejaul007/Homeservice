import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Star, MapPin, Clock, Trash2, ChevronRight, AlertCircle } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { favoritesApi, type FavoriteProvider } from '../../services/favoritesApi';
import { toast } from 'react-hot-toast';

const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [favorites, setFavorites] = useState<FavoriteProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/customer/favorites' } });
      return;
    }
    fetchFavorites();
  }, [isAuthenticated]);

  const fetchFavorites = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await favoritesApi.getFavorites();
      // Filter out any null entries and ensure valid data
      const validFavorites = (response.data?.favorites || []).filter(
        (f: any) => f && f.providerId
      );
      setFavorites(validFavorites);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load favorites');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFavorite = async (providerId: string) => {
    try {
      await favoritesApi.removeFavorite(providerId);
      setFavorites(prev => prev.filter(f => f.providerId !== providerId));
      toast.success('Provider removed from favorites');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove favorite');
    }
  };

  const handleProviderClick = (providerId: string) => {
    navigate(`/provider/${providerId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                <Heart className="w-6 h-6 text-nilin-coral fill-nilin-coral" />
              </div>
              <h1 className="text-3xl font-serif text-nilin-charcoal">My Favorites</h1>
            </div>
            <p className="text-nilin-warmGray">Your saved providers and favorite services</p>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* Empty State */}
          {favorites.length === 0 && !error && (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">No favorites yet</h3>
              <p className="text-nilin-warmGray mb-6 max-w-md mx-auto">
                Start exploring and save your favorite providers to quickly access them here.
              </p>
              <button
                onClick={() => navigate('/search')}
                className="btn-nilin"
              >
                Browse Services
              </button>
            </div>
          )}

          {/* Favorites Grid */}
          {favorites.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {favorites.map((favorite) => (
                <div
                  key={favorite.providerId}
                  className="glass-nilin rounded-nilin-lg overflow-hidden hover-lift transition-all group"
                >
                  {/* Provider Header */}
                  <div
                    onClick={() => handleProviderClick(favorite.providerId)}
                    className="p-6 cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative">
                        {favorite.provider?.avatar || favorite.provider?.profilePhoto ? (
                          <img
                            src={favorite.provider?.avatar || favorite.provider?.profilePhoto}
                            alt={favorite.provider?.businessName || `${favorite.provider?.firstName} ${favorite.provider?.lastName}`}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center text-white text-xl font-medium">
                            {favorite.provider?.firstName?.[0]}{favorite.provider?.lastName?.[0]}
                          </div>
                        )}
                        {/* Rating Badge */}
                        {(favorite.provider?.averageRating ?? 0) > 0 && (
                          <div className="absolute -bottom-2 -right-2 bg-white rounded-full px-2 py-1 shadow-nilin flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium text-nilin-charcoal">
                              {(favorite.provider?.averageRating ?? 0).toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-nilin-charcoal group-hover:text-nilin-coral transition-colors">
                              {favorite.provider?.businessName || `${favorite.provider?.firstName} ${favorite.provider?.lastName}`}
                            </h3>
                            {favorite.provider?.businessName && (
                              <p className="text-sm text-nilin-warmGray">
                                {favorite.provider?.firstName} {favorite.provider?.lastName}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-sm text-nilin-warmGray">
                              {(favorite.provider?.services?.length ?? 0) > 0 && (
                                <span>{favorite.provider?.services?.length} services</span>
                              )}
                              {(favorite.provider?.totalReviews ?? 0) > 0 && (
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-nilin-coral text-nilin-coral" />
                                  {favorite.provider?.totalReviews} reviews
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-nilin-lightGray group-hover:text-nilin-coral transition-colors" />
                        </div>
                      </div>
                    </div>

                    {/* Services Preview */}
                    {(favorite.provider?.services?.length ?? 0) > 0 && (
                      <div className="mt-4 pt-4 border-t border-nilin-border">
                        <p className="text-xs text-nilin-warmGray mb-2">Popular Services</p>
                        <div className="flex gap-2 overflow-x-auto">
                          {favorite.provider?.services?.slice(0, 3).map((service, idx) => (
                            <div
                              key={idx}
                              className="flex-shrink-0 bg-nilin-muted rounded-lg px-3 py-2"
                            >
                              <p className="text-sm text-nilin-charcoal font-medium truncate max-w-[150px]">
                                {service?.name}
                              </p>
                              <p className="text-xs text-nilin-coral">
                                AED {service?.price?.amount || '0'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {favorite.notes && (
                      <div className="mt-4 p-3 bg-nilin-muted rounded-lg">
                        <p className="text-sm text-nilin-warmGray">{favorite.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-6 py-4 border-t border-nilin-border flex justify-between items-center bg-nilin-muted/50">
                    <span className="text-xs text-nilin-lightGray">
                      Added {favorite.addedAt ? new Date(favorite.addedAt).toLocaleDateString() : 'Recently'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleProviderClick(favorite.providerId)}
                        className="btn-nilin py-2 px-4 text-sm"
                      >
                        View Profile
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFavorite(favorite.providerId);
                        }}
                        className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default FavoritesPage;
