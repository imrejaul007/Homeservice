import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Star, Clock, Trash2, ChevronRight, AlertCircle, Calendar } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';
import { wishlistApi, type WishlistPackage } from '../../services/wishlistApi';
import { toast } from 'react-hot-toast';

const WishlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [wishlist, setWishlist] = useState<WishlistPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    cursor: null as string | null,
    hasMore: false,
    total: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/customer/wishlist' } });
      return;
    }
    fetchWishlist();
  }, [isAuthenticated]);

  const fetchWishlist = async (cursor?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await wishlistApi.getWishlist({ cursor });
      // Filter out any null entries and ensure valid data
      const validWishlist = (response.data?.wishlist || []).filter(
        (w: any) => w && w.packageId
      );

      if (cursor) {
        // Append for pagination
        setWishlist(prev => [...prev, ...validWishlist]);
      } else {
        setWishlist(validWishlist);
      }

      setPagination({
        cursor: response.data.pagination.cursor,
        hasMore: response.data.pagination.hasMore,
        total: response.data.pagination.total,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load wishlist');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromWishlist = async (packageId: string) => {
    try {
      await wishlistApi.removeFromWishlist(packageId);
      setWishlist(prev => prev.filter(w => w.packageId !== packageId));
      toast.success('Package removed from wishlist');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove from wishlist');
    }
  };

  const handlePackageClick = (packageId: string) => {
    navigate(`/packages/${packageId}`);
  };

  const handleProviderClick = (e: React.MouseEvent, providerId: string) => {
    e.stopPropagation();
    navigate(`/provider/${providerId}`);
  };

  const handleLoadMore = () => {
    if (pagination.cursor) {
      fetchWishlist(pagination.cursor);
    }
  };

  const formatPrice = (price: number, currency: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getDiscountPercentage = (original: number, current: number) => {
    if (original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  if (isLoading && wishlist.length === 0) {
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
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'My Wishlist' },
          ]}
        />
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Heart className="w-6 h-6 text-red-500 fill-red-500" />
              </div>
              <h1 className="text-3xl font-serif text-nilin-charcoal">My Wishlist</h1>
            </div>
            <p className="text-nilin-warmGray">
              {pagination.total > 0
                ? `You have ${pagination.total} saved package${pagination.total !== 1 ? 's' : ''}`
                : 'Your saved packages will appear here'}
            </p>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* Empty State */}
          {wishlist.length === 0 && !error && (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">No packages in your wishlist</h3>
              <p className="text-nilin-warmGray mb-6 max-w-md mx-auto">
                Browse packages and save your favorites here. You'll be able to quickly book them later.
              </p>
              <button
                onClick={() => navigate('/packages')}
                className="btn-nilin"
              >
                Browse Packages
              </button>
            </div>
          )}

          {/* Wishlist Grid */}
          {wishlist.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlist.map((item) => {
                const pkg = item.package;
                const currentPrice = pkg?.currentPrice || item.packagePrice;
                const originalPrice = pkg?.originalPrice;
                const discount = originalPrice
                  ? getDiscountPercentage(originalPrice, currentPrice)
                  : 0;

                return (
                  <div
                    key={item.packageId}
                    className="bg-white rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group cursor-pointer"
                    onClick={() => handlePackageClick(item.packageId)}
                  >
                    {/* Package Image/Banner */}
                    <div className="relative h-40 bg-gradient-to-br from-nilin-coral/20 to-nilin-blush/30 flex items-center justify-center">
                      <span className="text-6xl opacity-30">📦</span>

                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex gap-2">
                        {pkg?.isFeatured && (
                          <span className="bg-nilin-coral text-white text-xs font-medium px-2 py-1 rounded-full">
                            Featured
                          </span>
                        )}
                        {pkg?.isPopular && (
                          <span className="bg-nilin-charcoal text-white text-xs font-medium px-2 py-1 rounded-full">
                            Popular
                          </span>
                        )}
                      </div>

                      {/* Discount Badge */}
                      {discount > 0 && (
                        <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {discount}% OFF
                        </div>
                      )}

                      {/* Remove Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromWishlist(item.packageId);
                        }}
                        className="absolute bottom-3 right-3 p-2 rounded-full bg-white/90 text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Remove from wishlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Package Info */}
                    <div className="p-4">
                      <h3 className="font-medium text-nilin-charcoal group-hover:text-nilin-coral transition-colors mb-1 line-clamp-1">
                        {item.packageName}
                      </h3>

                      {/* Provider Info */}
                      <button
                        onClick={(e) => handleProviderClick(e, item.providerId)}
                        className="flex items-center gap-2 text-sm text-nilin-warmGray hover:text-nilin-coral transition-colors mb-3"
                      >
                        <span>by {item.providerName}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Price */}
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-xl font-bold text-nilin-charcoal">
                          {formatPrice(currentPrice, pkg?.currency)}
                        </span>
                        {originalPrice && originalPrice > currentPrice && (
                          <span className="text-sm text-nilin-warmGray line-through">
                            {formatPrice(originalPrice, pkg?.currency)}
                          </span>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-sm text-nilin-warmGray">
                        {pkg?.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{pkg.duration.formatted || `${pkg.duration.totalMinutes} min`}</span>
                          </div>
                        )}
                        {(pkg?.averageRating ?? 0) > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span>{pkg?.averageRating?.toFixed(1)}</span>
                            <span className="text-nilin-lightGray">({pkg?.totalReviews})</span>
                          </div>
                        )}
                      </div>

                      {/* Category */}
                      {item.category && (
                        <div className="mt-3">
                          <span className="inline-block bg-nilin-muted text-nilin-charcoal text-xs px-2 py-1 rounded-full">
                            {item.category}
                          </span>
                        </div>
                      )}

                      {/* Notes */}
                      {item.notes && (
                        <div className="mt-3 p-2 bg-nilin-muted rounded-lg">
                          <p className="text-xs text-nilin-warmGray line-clamp-2">{item.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4">
                      <Button
                        onClick={() => handlePackageClick(item.packageId)}
                        className="w-full"
                        size="sm"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More */}
          {pagination.hasMore && (
            <div className="mt-8 text-center">
              <Button
                onClick={handleLoadMore}
                variant="outline"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default WishlistPage;
