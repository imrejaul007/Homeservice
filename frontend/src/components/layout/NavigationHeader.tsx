import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, User, LogOut, BarChart3, X, Calendar, Heart, ChevronDown, Package } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import CategoryTabs from './CategoryTabs';

interface NavigationHeaderProps {
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  currentLocation?: string;
  showCategoryTabs?: boolean;
}

const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  showSearch = true,
  onSearch,
  currentLocation = 'Dubai',
  showCategoryTabs = true,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

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
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        {/* Row 1: Main navigation */}
        {/* Mobile Header */}
        <div className="md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0">
              <span className="text-xl font-black bg-gradient-to-r from-nilin-primary to-nilin-accent bg-clip-text text-transparent">
                NILIN
              </span>
            </Link>

            {/* Right Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMobileSearch(true)}
                className="p-2 text-gray-600"
              >
                <Search className="h-5 w-5" />
              </button>

              <button className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium">{currentLocation}</span>
              </button>

              {user ? (
                <button
                  onClick={() => setShowMobileMenu(true)}
                  className="p-2"
                >
                  <div className="w-8 h-8 rounded-full bg-nilin-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-nilin-primary" />
                  </div>
                </button>
              ) : (
                <Link
                  to="/login"
                  className="p-2 text-sm font-semibold text-nilin-primary"
                >
                  Login
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
              <Link to="/" className="flex-shrink-0">
                <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-nilin-primary to-nilin-accent bg-clip-text text-transparent tracking-tight">
                  NILIN
                </h1>
              </Link>

              {/* Search Bar */}
              {showSearch && (
                <form onSubmit={handleSearch} className="flex flex-1 max-w-md lg:max-w-lg">
                  <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search for services..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-nilin-primary/20 focus:border-nilin-primary transition-all"
                    />
                  </div>
                </form>
              )}

              {/* Desktop Navigation */}
              <div className="flex items-center gap-3">
                {/* Location Selector */}
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  <MapPin className="h-4 w-4" />
                  <span>{currentLocation}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                {/* Track Order */}
                <Link
                  to="/track"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Package className="h-4 w-4" />
                  <span>Track Order</span>
                </Link>

                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-nilin-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-nilin-primary" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
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
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                          <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-sm font-bold text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>

                          {user.role === 'customer' && (
                            <>
                              <Link to="/search" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                <Search className="h-4 w-4 text-gray-400" /> Browse Services
                              </Link>
                              <Link to="/customer/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                <BarChart3 className="h-4 w-4 text-gray-400" /> Dashboard
                              </Link>
                              <Link to="/customer/bookings" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                <Calendar className="h-4 w-4 text-gray-400" /> My Bookings
                              </Link>
                              <Link to="/customer/favorites" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                <Heart className="h-4 w-4 text-gray-400" /> Favorites
                              </Link>
                              <Link to="/customer/profile" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                <User className="h-4 w-4 text-gray-400" /> Profile
                              </Link>
                            </>
                          )}

                          {user.role === 'provider' && (
                            <>
                              <Link to="/provider/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                <BarChart3 className="h-4 w-4 text-gray-400" /> Dashboard
                              </Link>
                              <Link to="/provider/bookings" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                                <Calendar className="h-4 w-4 text-gray-400" /> Bookings
                              </Link>
                            </>
                          )}

                          {user.role === 'admin' && (
                            <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setShowUserMenu(false)}>
                              <BarChart3 className="h-4 w-4 text-gray-400" /> Admin Dashboard
                            </Link>
                          )}

                          <div className="border-t border-gray-100 mt-2 pt-2">
                            <button
                              onClick={handleLogout}
                              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
                      className="px-5 py-2.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register/customer"
                      className="px-5 py-2.5 bg-nilin-primary text-white rounded-full font-semibold text-sm hover:bg-nilin-primary-dark transition-colors shadow-lg shadow-nilin-primary/25"
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
        <div className="fixed inset-0 bg-white z-[60] md:hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <button onClick={() => setShowMobileSearch(false)} className="p-1">
              <X className="h-5 w-5 text-gray-600" />
            </button>
            <form onSubmit={handleSearch} className="flex-1">
              <input
                type="text"
                placeholder="Search for services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
              />
            </form>
          </div>
          {/* Quick suggestions */}
          <div className="p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Popular searches</p>
            <div className="space-y-1">
              {['Bridal Makeup', 'Swedish Massage', 'Gel Nails', 'Hair Coloring', 'Facial'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchQuery(term);
                    navigate(`/search?q=${encodeURIComponent(term)}`);
                    setShowMobileSearch(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Search className="h-4 w-4 text-gray-400" />
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
            className="fixed inset-0 bg-black/50 z-[55] md:hidden"
            onClick={closeMobileMenu}
          />
          <div className="fixed inset-y-0 right-0 w-[300px] bg-white z-[56] md:hidden shadow-2xl">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <span className="text-xl font-black bg-gradient-to-r from-nilin-primary to-nilin-accent bg-clip-text text-transparent">
                  NILIN
                </span>
                <button onClick={closeMobileMenu} className="p-2 text-gray-500 hover:text-gray-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {user && (
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-nilin-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-nilin-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              <nav className="flex-1 overflow-y-auto p-4">
                <div className="space-y-1">
                  <Link to="/search" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors" onClick={closeMobileMenu}>
                    <Search className="h-5 w-5 text-gray-400" /> Browse Services
                  </Link>
                  <Link to="/track" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors" onClick={closeMobileMenu}>
                    <Package className="h-5 w-5 text-gray-400" /> Track Order
                  </Link>

                  {user?.role === 'customer' && (
                    <>
                      <Link to="/customer/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors" onClick={closeMobileMenu}>
                        <BarChart3 className="h-5 w-5 text-gray-400" /> Dashboard
                      </Link>
                      <Link to="/customer/bookings" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors" onClick={closeMobileMenu}>
                        <Calendar className="h-5 w-5 text-gray-400" /> My Bookings
                      </Link>
                      <Link to="/customer/favorites" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors" onClick={closeMobileMenu}>
                        <Heart className="h-5 w-5 text-gray-400" /> Favorites
                      </Link>
                      <Link to="/customer/profile" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors" onClick={closeMobileMenu}>
                        <User className="h-5 w-5 text-gray-400" /> Profile
                      </Link>
                    </>
                  )}

                  {user?.role === 'provider' && (
                    <>
                      <Link to="/provider/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors" onClick={closeMobileMenu}>
                        <BarChart3 className="h-5 w-5 text-gray-400" /> Dashboard
                      </Link>
                      <Link to="/provider/bookings" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors" onClick={closeMobileMenu}>
                        <Calendar className="h-5 w-5 text-gray-400" /> Bookings
                      </Link>
                    </>
                  )}

                  {user?.role === 'admin' && (
                    <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors" onClick={closeMobileMenu}>
                      <BarChart3 className="h-5 w-5 text-gray-400" /> Admin Dashboard
                    </Link>
                  )}
                </div>
              </nav>

              <div className="p-4 border-t border-gray-100">
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-semibold transition-colors"
                  >
                    <LogOut className="h-5 w-5" /> Logout
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Link to="/login" className="block w-full px-4 py-3 text-center text-gray-900 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors" onClick={closeMobileMenu}>
                      Login
                    </Link>
                    <Link to="/register/customer" className="block w-full px-4 py-3 text-center text-white bg-nilin-primary rounded-xl font-semibold hover:bg-nilin-primary-dark transition-colors" onClick={closeMobileMenu}>
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
