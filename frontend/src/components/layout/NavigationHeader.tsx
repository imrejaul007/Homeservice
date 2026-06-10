import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, User, LogOut, BarChart3, X, Calendar, Heart, ChevronDown, Package, Gift, MessageCircle, Bell } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import CategoryTabs from './CategoryTabs';
import LocationDropdown from '../location/LocationDropdown';
import NotificationBell from '../common/NotificationBell';

interface NavigationHeaderProps {
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  showCategoryTabs?: boolean;
}

const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  showSearch = true,
  onSearch,
  showCategoryTabs = true,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll state for frosted glass effect
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 10;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery);
    } else if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setShowMobileSearch(false);
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    setShowMobileMenu(false);
    await logout();
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  return (
    <>
      <header
        className={`
          sticky top-0 z-50 border-b border-white/20
          transition-all duration-300 ease-out
          ${isScrolled
            ? 'glass-nilin-strong bg-nilin-blush/80 dark:bg-nilin-charcoal/80'
            : 'glass glass-blur bg-white/60 dark:bg-nilin-charcoal/40'
          }
        `}
      >
        {/* Row 1: Main navigation */}
        {/* Mobile Header */}
        <div className="md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0 float-3d">
              <span className="text-2xl font-serif font-light text-nilin-charcoal tracking-wide">
                NILIN
              </span>
            </Link>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMobileSearch(true)}
                className="p-2 text-nilin-warmGray hover:text-nilin-charcoal transition-colors duration-200"
              >
                <Search className="h-5 w-5" />
              </button>

              <LocationDropdown variant="mobile" />

              {user ? (
                <button
                  onClick={() => setShowMobileMenu(true)}
                  className="p-2"
                >
                  <div className="w-8 h-8 rounded-full bg-nilin-blush flex items-center justify-center shadow-nilin-warm transition-all duration-200 hover:shadow-lg">
                    <User className="h-4 w-4 text-nilin-rose" />
                  </div>
                </button>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors duration-200"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 gap-4">
              {/* Logo */}
              <Link to="/" className="flex-shrink-0 float-3d">
                <h1 className="text-2xl md:text-3xl font-serif font-light text-nilin-charcoal tracking-wide transition-all duration-200 hover:scale-[1.02]">
                  NILIN
                </h1>
              </Link>

              {/* Search Bar */}
              {showSearch && (
                <form onSubmit={handleSearch} className="flex flex-1 max-w-md lg:max-w-lg">
                  <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray transition-colors duration-200" />
                    <input
                      type="text"
                      placeholder="Search for services..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 glass-input rounded-nilin text-sm text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral transition-all duration-200"
                    />
                  </div>
                </form>
              )}

              {/* Desktop Navigation */}
              <div className="flex items-center gap-3">
                {/* Location Selector */}
                <LocationDropdown variant="desktop" />

                {/* Track Order */}
                <Link
                  to="/track"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/50 rounded-nilin transition-all duration-200 shadow-nilin-warm hover:shadow-lg"
                >
                  <Package className="h-4 w-4" />
                  <span>Track Order</span>
                </Link>

                {user && (
                  <NotificationBell
                    userId={user.id || (user as { _id?: string })._id}
                    userRole={user.role === 'provider' ? 'provider' : 'customer'}
                  />
                )}

                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 px-4 py-2 bg-nilin-blush border border-nilin-border rounded-nilin hover:bg-nilin-peach transition-all duration-200 shadow-nilin-warm hover:shadow-lg"
                    >
                      <div className="w-7 h-7 rounded-full bg-nilin-peach flex items-center justify-center transition-all duration-200">
                        <User className="h-4 w-4 text-nilin-rose" />
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal max-w-[100px] truncate">
                        {user.name || 'Account'}
                      </span>
                    </button>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowUserMenu(false)}
                        />
                        <div className="absolute right-0 mt-2 w-56 bg-nilin-surface rounded-nilin shadow-xl border border-nilin-border py-2 z-50 animate-fade-in">
                          <div className="px-4 py-3 border-b border-nilin-border">
                            <p className="text-sm font-bold text-nilin-charcoal">{user.name}</p>
                            <p className="text-xs text-nilin-warmGray truncate">{user.email}</p>
                          </div>

                          {user.role === 'customer' && (
                            <>
                              <Link to="/search" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <Search className="h-4 w-4 text-nilin-warmGray" /> Browse Services
                              </Link>
                              <Link to="/customer/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <BarChart3 className="h-4 w-4 text-nilin-warmGray" /> Dashboard
                              </Link>
                              <Link to="/customer/bookings" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <Calendar className="h-4 w-4 text-nilin-warmGray" /> My Bookings
                              </Link>
                              <Link to="/customer/messages" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <MessageCircle className="h-4 w-4 text-nilin-warmGray" /> Messages
                              </Link>
                              <Link to="/customer/favorites" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <Heart className="h-4 w-4 text-nilin-warmGray" /> Favorites
                              </Link>
                              <Link to="/customer/wishlist" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <Package className="h-4 w-4 text-nilin-warmGray" /> Package Wishlist
                              </Link>
                              <Link to="/customer/my-claims" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <Gift className="h-4 w-4 text-nilin-warmGray" /> My Claims
                              </Link>
                              <Link to="/customer/profile" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <User className="h-4 w-4 text-nilin-warmGray" /> Profile
                              </Link>
                              <Link to="/customer/notifications" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <Bell className="h-4 w-4 text-nilin-warmGray" /> Notifications
                              </Link>
                              <Link to="/customer/notification-settings" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <Gift className="h-4 w-4 text-nilin-warmGray" /> Notification Settings
                              </Link>
                            </>
                          )}

                          {user.role === 'provider' && (
                            <>
                              <Link to="/provider/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <BarChart3 className="h-4 w-4 text-nilin-warmGray" /> Dashboard
                              </Link>
                              <Link to="/provider/bookings" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <Calendar className="h-4 w-4 text-nilin-warmGray" /> Bookings
                              </Link>
                            </>
                          )}

                          {user.role === 'admin' && (
                            <>
                              <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <BarChart3 className="h-4 w-4 text-nilin-warmGray" /> Admin Dashboard
                              </Link>
                              <Link to="/admin/offers" className="flex items-center gap-3 px-4 py-3 text-sm text-nilin-charcoal hover:bg-nilin-blush/70 rounded-nilin transition-all duration-200" onClick={() => setShowUserMenu(false)}>
                                <Gift className="h-4 w-4 text-nilin-warmGray" /> Offers Management
                              </Link>
                            </>
                          )}

                          <div className="border-t border-nilin-border mt-2 pt-2">
                            <button
                              onClick={handleLogout}
                              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-nilin transition-all duration-200"
                            >
                              <LogOut className="h-4 w-4" /> Logout
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/login"
                      className="px-5 py-2.5 text-sm font-semibold text-nilin-warmGray hover:text-nilin-charcoal transition-colors duration-200"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register/customer"
                      className="px-5 py-2.5 bg-nilin-coral text-white rounded-nilin font-semibold text-sm hover:bg-nilin-rose transition-all duration-200 shadow-lg shadow-nilin-coral/30 hover:shadow-xl hover:shadow-nilin-coral/40 shimmer"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Category Tabs */}
        {showCategoryTabs && <CategoryTabs />}
      </header>

      {/* Mobile Full-Screen Search Overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-nilin-blush/95 backdrop-blur-lg z-[60] md:hidden animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-nilin-border">
            <button onClick={() => setShowMobileSearch(false)} className="p-1 text-nilin-warmGray hover:text-nilin-charcoal transition-colors duration-200">
              <X className="h-5 w-5" />
            </button>
            <form onSubmit={handleSearch} className="flex-1">
              <input
                type="text"
                placeholder="Search for services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full py-2 text-sm text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none"
              />
            </form>
          </div>
          {/* Quick suggestions */}
          <div className="p-4">
            <p className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-3">Popular searches</p>
            <div className="space-y-1">
              {['Bridal Makeup', 'Swedish Massage', 'Gel Nails', 'Hair Coloring', 'Facial'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchQuery(term);
                    navigate(`/search?q=${encodeURIComponent(term)}`);
                    setShowMobileSearch(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200"
                >
                  <Search className="h-4 w-4 text-nilin-warmGray" />
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] md:hidden transition-opacity duration-200"
            onClick={closeMobileMenu}
          />
          <div className="fixed inset-y-0 right-0 w-[300px] bg-nilin-blush/95 backdrop-blur-lg z-[56] md:hidden shadow-2xl shadow-nilin-charcoal/20 animate-slide-in-right">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-nilin-border">
                <span className="text-xl font-serif font-light text-nilin-charcoal tracking-wide">
                  NILIN
                </span>
                <button onClick={closeMobileMenu} className="p-2 text-nilin-warmGray hover:text-nilin-charcoal transition-colors duration-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {user && (
                <div className="p-4 bg-nilin-peach/30 border-b border-nilin-border">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-nilin-blush flex items-center justify-center shadow-nilin-warm">
                      <User className="h-6 w-6 text-nilin-rose" />
                    </div>
                    <div>
                      <p className="font-bold text-nilin-charcoal">{user.name}</p>
                      <p className="text-sm text-nilin-warmGray">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              <nav className="flex-1 overflow-y-auto p-4">
                <div className="space-y-1">
                  <Link to="/search" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                    <Search className="h-5 w-5 text-nilin-warmGray" /> Browse Services
                  </Link>
                  <Link to="/track" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                    <Package className="h-5 w-5 text-nilin-warmGray" /> Track Order
                  </Link>

                  {user?.role === 'customer' && (
                    <>
                      <Link to="/customer/dashboard" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <BarChart3 className="h-5 w-5 text-nilin-warmGray" /> Dashboard
                      </Link>
                      <Link to="/customer/bookings" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <Calendar className="h-5 w-5 text-nilin-warmGray" /> My Bookings
                      </Link>
                      <Link to="/customer/messages" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <MessageCircle className="h-5 w-5 text-nilin-warmGray" /> Messages
                      </Link>
                      <Link to="/customer/favorites" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <Heart className="h-5 w-5 text-nilin-warmGray" /> Favorites
                      </Link>
                      <Link to="/customer/wishlist" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <Package className="h-5 w-5 text-nilin-warmGray" /> Package Wishlist
                      </Link>
                      <Link to="/customer/my-claims" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <Gift className="h-5 w-5 text-nilin-warmGray" /> My Claims
                      </Link>
                      <Link to="/customer/profile" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <User className="h-5 w-5 text-nilin-warmGray" /> Profile
                      </Link>
                    </>
                  )}

                  {user?.role === 'provider' && (
                    <>
                      <Link to="/provider/dashboard" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <BarChart3 className="h-5 w-5 text-nilin-warmGray" /> Dashboard
                      </Link>
                      <Link to="/provider/bookings" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <Calendar className="h-5 w-5 text-nilin-warmGray" /> Bookings
                      </Link>
                    </>
                  )}

                  {user?.role === 'admin' && (
                    <>
                      <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <BarChart3 className="h-5 w-5 text-nilin-warmGray" /> Admin Dashboard
                      </Link>
                      <Link to="/admin/offers" className="flex items-center gap-3 px-4 py-3 text-nilin-charcoal hover:bg-nilin-peach/30 rounded-nilin transition-all duration-200" onClick={closeMobileMenu}>
                        <Gift className="h-5 w-5 text-nilin-warmGray" /> Offers Management
                      </Link>
                    </>
                  )}
                </div>
              </nav>

              <div className="p-4 border-t border-nilin-border">
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-nilin font-semibold transition-all duration-200"
                  >
                    <LogOut className="h-5 w-5" /> Logout
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Link to="/login" className="block w-full px-4 py-3 text-center text-nilin-charcoal border border-nilin-border rounded-nilin font-semibold hover:bg-nilin-peach/30 transition-all duration-200" onClick={closeMobileMenu}>
                      Login
                    </Link>
                    <Link to="/register/customer" className="block w-full px-4 py-3 text-center text-white bg-nilin-coral rounded-nilin font-semibold hover:bg-nilin-rose transition-all duration-200 shadow-lg shadow-nilin-coral/30" onClick={closeMobileMenu}>
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default NavigationHeader;
