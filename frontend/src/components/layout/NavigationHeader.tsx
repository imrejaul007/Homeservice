import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, LogOut, BarChart3, X, Calendar, Heart, Package, Gift, MessageCircle, AlertCircle, CheckCircle, Download, Shield, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import CategoryTabs from './CategoryTabs';
import LocationDropdown from '../location/LocationDropdown';
import NotificationBell from '../common/NotificationBell';
import HeaderSearchDropdown from '../search/HeaderSearchDropdown';
import { useSearchStore } from '../../stores/searchStore';
import { useTrendingSearchTerms } from '../../hooks/useTrendingSearchTerms';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

interface NavigationHeaderProps {
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  showCategoryTabs?: boolean;
  /** Homepage hero overlay: fixed header, transparent over hero, solid on scroll */
  variant?: 'default' | 'hero';
}

// Scroll animation constants
const SCROLL_START = 0;
const SCROLL_END = 80;

const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  showSearch = true,
  onSearch,
  showCategoryTabs = true,
  variant = 'default',
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { addToSearchHistory } = useSearchStore();
  const { terms: trendingSearchTerms } = useTrendingSearchTerms(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const isHeroVariant = variant === 'hero';

  // Smooth scroll progress tracking with requestAnimationFrame
  useEffect(() => {
    let ticking = false;
    let lastScrollY = 0;

    const updateScrollProgress = () => {
      const scrollY = window.scrollY;

      // Only track scroll on hero variant pages
      if (isHeroVariant) {
        const rawProgress = (scrollY - SCROLL_START) / (SCROLL_END - SCROLL_START);
        const progress = Math.max(0, Math.min(1, rawProgress));
        setScrollProgress(progress);
      } else {
        // Non-hero pages use simple scrolled state
        setScrollProgress(scrollY > 10 ? 1 : 0);
      }

      lastScrollY = scrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollProgress);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateScrollProgress(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHeroVariant]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setShowSearchDropdown(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success('Logged out successfully', {
        icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      });
    } catch (error) {
      // Logout should succeed even if API call fails - local cleanup happens
      console.error('Logout API error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  // Interpolate values based on scroll progress
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const easedProgress = easeOutCubic(scrollProgress);

  // Calculate dynamic styles - scale up when scrolling
  const navWidth = isHeroVariant
    ? `${100 - (easedProgress * 10)}%`
    : '100%';

  const navMaxWidth = isHeroVariant
    ? easedProgress > 0 ? `${600 + (easedProgress * 500)}px` : '100%'
    : '1400px';

  const navBorderRadius = isHeroVariant
    ? easedProgress > 0.1 ? `${easedProgress * 9999}px` : '0px'
    : '0px';

  const navBackground = isHeroVariant
    ? `rgba(255, 255, 255, ${0.3 + (easedProgress * 0.55)})`
    : 'rgba(255, 255, 255, 0.95)';

  const navBlur = isHeroVariant
    ? `${easedProgress * 20}px`
    : '20px';

  const navShadow = isHeroVariant
    ? `0 ${easedProgress * 20}px ${easedProgress * 60}px rgba(0, 0, 0, ${easedProgress * 0.08})`
    : '0 4px 24px rgba(45, 45, 45, 0.08)';

  const navBorder = isHeroVariant
    ? `1px solid rgba(0, 0, 0, ${easedProgress * 0.06})`
    : '1px solid rgba(0, 0, 0, 0.06)';

  const navTop = isHeroVariant
    ? `${easedProgress * 16}px`
    : '0px';

  // Scale elements — hero homepage scroll morph only
  const scaleFactor = isHeroVariant ? 1 + easedProgress * 0.1 : 1;
  const logoScale = isHeroVariant ? 1.15 - easedProgress * 0.05 : 1;
  const textScale = isHeroVariant ? 1.1 - easedProgress * 0.05 : 1;
  const iconScale = scaleFactor;
  const navHeight = isHeroVariant ? 64 + easedProgress * 8 : 64;

  // Floating pill state — hero homepage only (scroll morph animation)
  const isFloating = isHeroVariant && scrollProgress > 0.1;

  const headerPositionClass = isHeroVariant
    ? 'fixed left-0 right-0'
    : 'sticky top-0';

  const headerStyle: React.CSSProperties = isHeroVariant
    ? {
        width: navWidth,
        maxWidth: navMaxWidth,
        top: navTop,
        left: '50%',
        transform: 'translateX(-50%)',
        borderRadius: navBorderRadius,
        background: navBackground,
        backdropFilter: `blur(${navBlur})`,
        WebkitBackdropFilter: `blur(${navBlur})`,
        boxShadow: navShadow,
        border: navBorder,
      }
    : {
        width: '100%',
        maxWidth: '100%',
        top: 0,
        left: 0,
        transform: 'none',
        borderRadius: 0,
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: scrollProgress >= 1 ? '0 4px 24px rgba(45, 45, 45, 0.08)' : 'none',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
      };

  const rowMinHeight = isHeroVariant ? navHeight : 64;

  const dashboardHref =
    user?.role === 'admin'
      ? '/admin/dashboard'
      : user?.role === 'provider'
        ? '/provider/dashboard'
        : '/customer/dashboard';

  return (
    <>
      <header
        ref={headerRef}
        data-testid="main-header"
        className={`z-[100] w-full transition-all duration-300 ease-out ${headerPositionClass}`}
        style={headerStyle}
      >
        <div className="w-full">
        {/* Mobile Header */}
        <div className="md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0" style={{ transform: `scale(${logoScale})`, transition: 'transform 0.3s ease' }}>
              <span className="text-2xl font-serif font-light tracking-wide text-nilin-charcoal">
                NILIN
              </span>
            </Link>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMobileSearch(true)}
                className="p-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 bg-nilin-blush/50 text-nilin-rose hover:bg-nilin-coral hover:text-white active:scale-90 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              >
                <Search className="h-5 w-5" />
              </button>

              <LocationDropdown variant="mobile" />

              {user && (
                <Link
                  to={dashboardHref}
                  className="px-3 py-2 rounded-full text-xs font-bold text-white bg-nilin-coral hover:bg-nilin-rose shadow-sm transition-colors"
                >
                  Dashboard
                </Link>
              )}

              {user ? (
                <button
                  onClick={() => setShowMobileMenu(true)}
                  className="p-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 bg-gradient-to-br from-nilin-blush to-nilin-peach/70 shadow-nilin-warm hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  <User className="h-5 w-5 text-nilin-rose" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="px-5 py-2.5 text-sm font-semibold text-nilin-coral hover:text-nilin-rose hover:bg-nilin-blush/50 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 active:scale-95 transition-all duration-200"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block">
          <div className="max-w-[1400px] mx-auto w-full">
          <div
            className="flex items-center justify-between gap-4 px-6 transition-all duration-300"
            style={{ minHeight: `${rowMinHeight}px` }}
          >
            {/* Logo - With more left padding */}
            <Link
              to="/"
              className="flex-shrink-0 transition-all duration-300 pl-4"
              style={{
                transform: `scale(${logoScale})`,
                marginRight: 'auto',
              }}
            >
              <h1 className="font-serif font-light tracking-widest text-nilin-charcoal drop-shadow-sm hover:scale-[1.02] transition-transform duration-200"
                style={{ fontSize: `${32 * scaleFactor}px` }}
              >
                NILIN
              </h1>
            </Link>

            {/* Right Actions - Always show Location and Track Order */}
            <div className="flex items-center gap-4">
              {/* Location - Always visible */}
              <div style={{ transform: `scale(${textScale})` }}>
                <LocationDropdown variant="desktop" />
              </div>

              {/* Track Order - Always visible */}
              <Link
                to="/track"
                className="flex items-center gap-2 px-4 py-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 text-base font-semibold text-nilin-charcoal bg-white/80 border border-nilin-border/40 hover:border-nilin-coral/50 hover:bg-nilin-blush/30 hover:text-nilin-coral active:scale-[0.97] transition-all duration-150"
                style={{ transform: `scale(${textScale})` }}
              >
                <Package className="h-5 w-5" />
                <span className="hidden lg:inline">Track Order</span>
              </Link>

              {user && (
                <Link
                  to={dashboardHref}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white bg-nilin-coral hover:bg-nilin-rose shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 transition-all duration-150"
                  style={{ transform: `scale(${textScale})` }}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
              )}

              {/* Search Bar - Full width in floating */}
              {showSearch && (
                <div
                  ref={searchContainerRef}
                  className="relative flex-1 max-w-xs lg:max-w-md transition-all duration-300"
                  style={{
                    maxWidth: isFloating ? '400px' : '500px',
                    marginLeft: isFloating ? 'auto' : '0',
                    marginRight: isFloating ? '16px' : '0',
                  }}
                >
                  <button
                    onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                    className={`
                      flex items-center gap-3 w-full px-5 py-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 text-sm transition-all duration-200
                      bg-white/95 border border-nilin-border/40 text-nilin-charcoal placeholder:text-nilin-warmGray
                      hover:border-nilin-coral/50 hover:bg-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-nilin-charcoal/5
                      active:scale-[0.99]
                      ${isFloating ? 'shadow-lg shadow-nilin-charcoal/8' : 'shadow-sm'}
                    `}
                  >
                    <Search className="h-5 w-5 text-nilin-coral" />
                    <span className="text-nilin-charcoal font-medium text-base">
                      {searchQuery || 'Search for services...'}
                    </span>
                    <kbd className="ml-auto px-2.5 py-1 text-xs rounded-lg border border-nilin-border/60 text-nilin-warmGray bg-nilin-blush/30 hidden sm:inline-block font-medium">
                      /
                    </kbd>
                  </button>

                  <HeaderSearchDropdown
                    isOpen={showSearchDropdown}
                    onClose={() => setShowSearchDropdown(false)}
                  />
                </div>
              )}

              {user && (
                <div className="relative -ml-2">
                  {/* Background to blend with navbar */}
                  <div className="absolute inset-0 bg-white/95 rounded-full"
                    style={{
                      opacity: easedProgress > 0.1 ? 0.3 + (easedProgress * 0.65) : 0,
                      backdropFilter: `blur(${easedProgress * 20}px)`,
                      pointerEvents: 'none'
                    }}
                  />
                  <div className="relative">
                    <NotificationBell
                      userId={user.id || (user as { _id?: string })._id}
                      userRole={user.role === 'provider' ? 'provider' : 'customer'}
                    />
                  </div>
                </div>
              )}

              {user ? (
                <div className="relative -mr-4">
                  {/* Background to blend with navbar */}
                  <div className="absolute inset-0 bg-white/95 rounded-full"
                    style={{
                      opacity: easedProgress > 0.1 ? 0.3 + (easedProgress * 0.65) : 0,
                      backdropFilter: `blur(${easedProgress * 20}px)`,
                      pointerEvents: 'none'
                    }}
                  />
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`
                      relative flex items-center gap-3 pl-2 pr-5 py-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 transition-all duration-200
                      bg-white/95 hover:bg-nilin-blush/40 border border-nilin-border/30 hover:border-nilin-coral/30 active:scale-[0.98]
                    `}
                    style={{ transform: `scale(${iconScale})` }}
                  >
                    <div className="w-10 h-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 bg-gradient-to-br from-nilin-blush to-nilin-peach/60 flex items-center justify-center shadow-sm shadow-nilin-warm/30">
                      <User className="h-5 w-5 text-nilin-rose" />
                    </div>
                    <span className="text-base font-semibold max-w-[140px] truncate text-nilin-charcoal hidden lg:inline">
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
                      <div
                        className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl border border-nilin-border/50 overflow-hidden z-50 animate-fade-in"
                        style={{
                          background: 'rgba(253, 251, 249, 0.94)',
                          backdropFilter: 'blur(24px) saturate(180%)',
                          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                        }}
                      >
                        {/* User Info Header */}
                        <div className="px-4 py-4 bg-gradient-to-r from-nilin-blush/70 via-white/90 to-nilin-cream/80 border-b border-nilin-border/40">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 flex items-center justify-center border-2 border-nilin-coral/30">
                              <User className="h-5 w-5 text-nilin-coral" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-nilin-charcoal truncate">{user.name}</p>
                              <p className="text-xs text-nilin-warmGray truncate">{user.email}</p>
                            </div>
                          </div>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2 bg-white/90">
                          {user.role === 'customer' && (
                            <>
                              <Link to="/search" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <Search className="h-4 w-4 text-nilin-coral" /> Browse Services
                              </Link>
                              <Link to="/customer/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <BarChart3 className="h-4 w-4 text-nilin-coral" /> Dashboard
                              </Link>
                              <Link to="/customer/bookings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <Calendar className="h-4 w-4 text-nilin-coral" /> My Bookings
                              </Link>
                              <Link to="/customer/messages" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <MessageCircle className="h-4 w-4 text-nilin-coral" /> Messages
                              </Link>
                              <Link to="/customer/favorites" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <Heart className="h-4 w-4 text-nilin-coral" /> Favorites
                              </Link>
                              <Link to="/customer/analytics" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <BarChart3 className="h-4 w-4 text-nilin-coral" /> Analytics
                              </Link>
                              <Link to="/customer/stats" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <TrendingUp className="h-4 w-4 text-nilin-coral" /> My Stats
                              </Link>
                              <Link to="/customer/data-export" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <Download className="h-4 w-4 text-nilin-coral" /> Data Export
                              </Link>
                              <Link to="/customer/privacy-settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <Shield className="h-4 w-4 text-nilin-coral" /> Privacy Settings
                              </Link>
                            </>
                          )}

                          {user.role === 'provider' && (
                            <>
                              <Link to="/provider/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <BarChart3 className="h-4 w-4 text-nilin-coral" /> Dashboard
                              </Link>
                              <Link to="/provider/bookings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <Calendar className="h-4 w-4 text-nilin-coral" /> Bookings
                              </Link>
                              <Link to="/provider/messages" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <MessageCircle className="h-4 w-4 text-nilin-coral" /> Messages
                              </Link>
                            </>
                          )}

                          {user.role === 'admin' && (
                            <>
                              <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <BarChart3 className="h-4 w-4 text-nilin-coral" /> Admin Dashboard
                              </Link>
                              <Link to="/admin/offers" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                                <Gift className="h-4 w-4 text-nilin-coral" /> Offers Management
                              </Link>
                            </>
                          )}
                        </div>

                        {/* Bottom Actions */}
                        <div className="border-t border-nilin-border/40 py-1 bg-white/90">
                          <Link to="/customer/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/40 hover:text-nilin-coral active:bg-nilin-peach/30 rounded-xl mx-2 transition-all duration-150" onClick={() => setShowUserMenu(false)}>
                            <User className="h-4 w-4 text-nilin-coral" /> Profile
                          </Link>
                          <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50/80 active:bg-red-100/80 rounded-xl mx-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoggingOut ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                className="h-4 w-4 border-2 border-red-500/30 border-t-red-500 rounded-full"
                              />
                            ) : (
                              <LogOut className="h-4 w-4" />
                            )}
                            {isLoggingOut ? 'Logging out...' : 'Logout'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    className="px-6 py-3 text-base font-semibold text-nilin-charcoal hover:text-nilin-coral hover:bg-nilin-blush/40 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 active:scale-95 transition-all duration-200"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register/customer"
                    className="px-8 py-3.5 bg-gradient-to-br from-nilin-coral to-nilin-rose text-white rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 font-bold text-base hover:shadow-xl hover:shadow-nilin-coral/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* Row 2: Category Tabs - Only show when not floating */}
        {showCategoryTabs && !isFloating && <CategoryTabs />}
        </div>
      </header>

      {/* Mobile Full-Screen Search Overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-white/98 backdrop-blur-xl z-[105] md:hidden animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-nilin-border">
            <button onClick={() => setShowMobileSearch(false)} className="min-h-11 min-w-11 flex items-center justify-center text-nilin-warmGray hover:text-nilin-charcoal transition-colors duration-200">
              <X className="h-5 w-5" />
            </button>
            <form onSubmit={handleSearch} className="flex-1">
              <input
                type="text"
                placeholder="Search services, providers, locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full py-2 text-sm text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none"
              />
            </form>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium text-nilin-warmGray uppercase tracking-wider mb-3">Popular searches</p>
            <div className="space-y-1">
              {trendingSearchTerms.map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchQuery(term);
                    addToSearchHistory(term);
                    navigate(`/search?q=${encodeURIComponent(term)}`);
                    setShowMobileSearch(false);
                  }}
                  className="flex items-center gap-3 w-full min-h-11 px-3 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-peach/30 rounded-lg transition-all duration-200"
                >
                  <Search className="h-4 w-4 text-nilin-warmGray flex-shrink-0" />
                  <span className="truncate">{term}</span>
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
            className="fixed inset-0 bg-nilin-charcoal/50 backdrop-blur-sm z-[55] md:hidden transition-all duration-300"
            onClick={closeMobileMenu}
          />
          <div className="fixed inset-y-0 right-0 w-[85%] max-w-[360px] bg-white z-[106] md:hidden shadow-[-12px_0_48px_rgba(0,0,0,0.18)] animate-slide-in-right rounded-l-3xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-nilin-border/60">
                <span className="text-2xl font-serif font-light text-nilin-charcoal tracking-widest">
                  NILIN
                </span>
                <button onClick={closeMobileMenu} className="p-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 bg-nilin-blush/50 text-nilin-rose hover:bg-nilin-coral hover:text-white active:scale-90 transition-all duration-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Info */}
              {user && (
                <div className="px-6 py-5 bg-gradient-to-r from-nilin-blush/30 to-nilin-peach/20 border-b border-nilin-border/60">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 bg-gradient-to-br from-nilin-blush to-nilin-peach/70 flex items-center justify-center shadow-lg shadow-nilin-warm/30">
                      <User className="h-7 w-7 text-nilin-rose" />
                    </div>
                    <div>
                      <p className="font-bold text-nilin-charcoal text-lg">{user.name}</p>
                      <p className="text-sm text-nilin-warmGray">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-1">
                  <Link to="/search" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                    <Search className="h-5 w-5 text-nilin-coral" /> Browse Services
                  </Link>
                  <Link to="/track" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                    <Package className="h-5 w-5 text-nilin-coral" /> Track Order
                  </Link>

                  {user?.role === 'customer' && (
                    <>
                      <Link to="/customer/dashboard" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                        <BarChart3 className="h-5 w-5 text-nilin-coral" /> Dashboard
                      </Link>
                      <Link to="/customer/bookings" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                        <Calendar className="h-5 w-5 text-nilin-coral" /> My Bookings
                      </Link>
                      <Link to="/customer/favorites" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                        <Heart className="h-5 w-5 text-nilin-coral" /> Favorites
                      </Link>
                      <Link to="/customer/analytics" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                        <BarChart3 className="h-5 w-5 text-nilin-coral" /> Analytics
                      </Link>
                      <Link to="/customer/stats" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                        <TrendingUp className="h-5 w-5 text-nilin-coral" /> My Stats
                      </Link>
                      <Link to="/customer/data-export" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                        <Download className="h-5 w-5 text-nilin-coral" /> Data Export
                      </Link>
                      <Link to="/customer/privacy-settings" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                        <Shield className="h-5 w-5 text-nilin-coral" /> Privacy Settings
                      </Link>
                    </>
                  )}

                  {user?.role === 'provider' && (
                    <>
                      <Link to="/provider/dashboard" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                        <BarChart3 className="h-5 w-5 text-nilin-coral" /> Dashboard
                      </Link>
                      <Link to="/provider/bookings" className="flex items-center gap-4 px-4 py-3.5 text-nilin-charcoal hover:bg-nilin-blush/50 active:bg-nilin-peach/40 rounded-xl transition-all duration-150" onClick={closeMobileMenu}>
                        <Calendar className="h-5 w-5 text-nilin-coral" /> Bookings
                      </Link>
                    </>
                  )}
                </div>
              </nav>

              {/* Footer Actions */}
              <div className="p-4 border-t border-nilin-border/60">
                {user ? (
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex items-center justify-center gap-2.5 w-full px-4 py-4 text-red-500 bg-red-50/80 hover:bg-red-100/80 active:bg-red-50 rounded-xl font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoggingOut ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="h-5 w-5 border-2 border-red-500/30 border-t-red-500 rounded-full"
                        />
                        Logging out...
                      </>
                    ) : (
                      <>
                        <LogOut className="h-5 w-5" /> Logout
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <Link to="/login" className="block w-full px-4 py-4 text-center text-nilin-charcoal bg-white border-2 border-nilin-border/40 rounded-xl font-semibold hover:bg-nilin-blush/40 active:bg-nilin-peach/30 transition-all duration-150" onClick={closeMobileMenu}>
                      Login
                    </Link>
                    <Link to="/register/customer" className="block w-full px-4 py-4 text-center text-white bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-xl font-bold shadow-lg shadow-nilin-coral/30 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200" onClick={closeMobileMenu}>
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