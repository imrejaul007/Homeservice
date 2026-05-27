
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  CheckCircle,
  Star,
  Clock,
  Shield,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Zap,
  Heart,
  Award,
  Quote,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Twitter,
  Facebook,
  Menu,
  X,
} from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';

// ============================================
// Types
// ============================================

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface Testimonial {
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
}

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  buttonText: string;
}

// ============================================
// Counter Animation Hook
// ============================================

const useCounter = (end: number, duration: number = 2000, startOnMount: boolean = true) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!startOnMount && !hasStarted) return;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      setCount(Math.floor(progress * end));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration, startOnMount, hasStarted]);

  return { count, start: () => setHasStarted(true) };
};

// ============================================
// Feature Card Component
// ============================================

const FeatureCard: React.FC<{ feature: Feature; index: number }> = ({ feature, index }) => (
  <div
    className="group p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300 hover:-translate-y-1"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
      <div className="text-white">{feature.icon}</div>
    </div>
    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
    <p className="text-gray-500 dark:text-gray-400">{feature.description}</p>
  </div>
);

// ============================================
// Testimonial Card Component
// ============================================

const TestimonialCard: React.FC<{ testimonial: Testimonial }> = ({ testimonial }) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
    <div className="flex items-center gap-1 mb-4">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-5 h-5 ${i < testimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
    <Quote className="w-8 h-8 text-indigo-200 mb-3" />
    <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">{testimonial.content}</p>
    <div className="flex items-center gap-4">
      <img
        src={testimonial.avatar}
        alt={testimonial.name}
        className="w-12 h-12 rounded-full object-cover"
      />
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role}</p>
      </div>
    </div>
  </div>
);

// ============================================
// Pricing Card Component
// ============================================

const PricingCard: React.FC<{ tier: PricingTier }> = ({ tier }) => (
  <div
    className={`relative rounded-2xl p-8 ${
      tier.highlighted
        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white scale-105 shadow-2xl'
        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
    }`}
  >
    {tier.highlighted && (
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-gray-900 text-sm font-semibold rounded-full flex items-center gap-1">
        <Award className="w-4 h-4" />
        Most Popular
      </div>
    )}

    <h3 className={`text-xl font-bold mb-2 ${tier.highlighted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
      {tier.name}
    </h3>
    <p className={`text-sm mb-4 ${tier.highlighted ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
      {tier.description}
    </p>

    <div className="mb-6">
      <span className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
        {tier.price}
      </span>
      <span className={`${tier.highlighted ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
        {' '}{tier.period}
      </span>
    </div>

    <ul className="space-y-3 mb-8">
      {tier.features.map((feature, idx) => (
        <li key={idx} className="flex items-center gap-3">
          <CheckCircle className={`w-5 h-5 flex-shrink-0 ${tier.highlighted ? 'text-indigo-200' : 'text-green-500'}`} />
          <span className={tier.highlighted ? 'text-white' : 'text-gray-600 dark:text-gray-300'}>{feature}</span>
        </li>
      ))}
    </ul>

    <button
      className={`w-full py-3 rounded-xl font-semibold transition-colors ${
        tier.highlighted
          ? 'bg-white text-indigo-600 hover:bg-indigo-50'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
      }`}
    >
      {tier.buttonText}
    </button>
  </div>
);

// ============================================
// Main Landing Page Component
// ============================================

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const statsRef = useRef<HTMLDivElement>(null);

  const statsSectionInView = useState(false);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ============================================
  // Data
  // ============================================

  const features: Feature[] = [
    {
      icon: <Zap className="w-7 h-7" />,
      title: 'Instant Booking',
      description: 'Book appointments in seconds with real-time availability and instant confirmation.',
    },
    {
      icon: <Shield className="w-7 h-7" />,
      title: 'Verified Providers',
      description: 'Every service provider is background-checked and verified for your peace of mind.',
    },
    {
      icon: <Star className="w-7 h-7" />,
      title: 'AI Recommendations',
      description: 'Get personalized service suggestions based on your preferences and booking history.',
    },
    {
      icon: <Clock className="w-7 h-7" />,
      title: 'Real-time Tracking',
      description: 'Track your booking status in real-time with push notifications and live updates.',
    },
    {
      icon: <DollarSign className="w-7 h-7" />,
      title: 'Secure Payments',
      description: 'Multiple payment options with bank-level security and encrypted transactions.',
    },
    {
      icon: <Heart className="w-7 h-7" />,
      title: 'Loyalty Rewards',
      description: 'Earn coins and unlock exclusive benefits with every booking you make.',
    },
  ];

  const testimonials: Testimonial[] = [
    {
      name: 'Sarah Al Maktoum',
      role: 'Regular Customer',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      content: 'NILIN has completely transformed how I book beauty services. The instant booking and real-time tracking are incredible!',
      rating: 5,
    },
    {
      name: 'Fatima Hassan',
      role: 'Salon Owner',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
      content: 'Managing my salon has never been easier. My bookings have increased by 40% since I joined NILIN.',
      rating: 5,
    },
    {
      name: 'Amira Khan',
      role: 'Premium Member',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      content: 'The AI recommendations always suggest exactly what I need. Plus, the loyalty rewards are amazing!',
      rating: 5,
    },
  ];

  const pricingTiers: PricingTier[] = [
    {
      name: 'Basic',
      price: 'Free',
      period: '',
      description: 'For customers just getting started',
      features: [
        'Browse services',
        'Book appointments',
        'Basic loyalty rewards',
        'Email support',
      ],
      buttonText: 'Get Started',
    },
    {
      name: 'Premium',
      price: 'AED 29',
      period: '/month',
      description: 'For regular beauty service lovers',
      features: [
        'Everything in Basic',
        'Priority booking',
        '10% off all bookings',
        'Exclusive promotions',
        'Premium loyalty rewards',
        '24/7 chat support',
      ],
      highlighted: true,
      buttonText: 'Go Premium',
    },
    {
      name: 'Business',
      price: 'Custom',
      period: '',
      description: 'For service providers and salons',
      features: [
        'Unlimited bookings',
        'Analytics dashboard',
        'AI business insights',
        'Custom branding',
        'API access',
        'Dedicated account manager',
      ],
      buttonText: 'Contact Sales',
    },
  ];

  const stats = [
    { value: 10000, label: 'Active Users', suffix: '+' },
    { value: 50000, label: 'Monthly Bookings', suffix: '+' },
    { value: 4.9, label: 'App Rating', suffix: '', decimals: 1 },
    { value: 2, label: 'Million AED Processed', suffix: 'M+' },
  ];

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                NILIN
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 transition-colors">
                How It Works
              </a>
              <a href="#testimonials" className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 transition-colors">
                Reviews
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 transition-colors">
                Pricing
              </a>
            </nav>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/demo')}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
              >
                Try Demo
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block py-2 text-gray-600 hover:text-indigo-600">Features</a>
              <a href="#how-it-works" className="block py-2 text-gray-600 hover:text-indigo-600">How It Works</a>
              <a href="#testimonials" className="block py-2 text-gray-600 hover:text-indigo-600">Reviews</a>
              <a href="#pricing" className="block py-2 text-gray-600 hover:text-indigo-600">Pricing</a>
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                  className="w-full py-2 text-gray-600 hover:text-indigo-600"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/demo'); }}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium"
                >
                  Try Demo
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(120,119,198,0.1),transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                The Future of Beauty Services
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                Book Beauty Services
                <span className="block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Instantly & Effortlessly
                </span>
              </h1>

              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-lg">
                Discover and book verified beauty professionals near you. AI-powered recommendations,
                real-time tracking, and rewarding loyalty programs.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <button
                  onClick={() => navigate('/demo')}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Try Demo
                </button>
                <button
                  onClick={() => navigate('/register/customer')}
                  className="px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-white dark:border-gray-900" />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-900 dark:text-white">10k+</strong> Happy Users
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                  <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-900 dark:text-white">4.9</strong> Rating
                  </span>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div className="relative hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-2xl opacity-20" />
                <div className="relative bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-3xl aspect-[4/5] overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=1000&fit=crop"
                    alt="Beauty Services"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>

                {/* Floating Cards */}
                <div className="absolute -left-8 top-1/4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 animate-float">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Booking Confirmed!</p>
                      <p className="text-sm text-gray-500">Today at 3:00 PM</p>
                    </div>
                  </div>
                </div>

                <div className="absolute -right-4 bottom-1/4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 animate-float-delayed">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <Star className="w-5 h-5 text-amber-600 fill-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">+500 Coins</p>
                      <p className="text-sm text-gray-500">Loyalty Reward</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section ref={statsRef} className="py-12 bg-white dark:bg-gray-800 border-y border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1">
                  {stat.decimals ? stat.value.toFixed(stat.decimals) : stat.value.toLocaleString()}{stat.suffix}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need for
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> Effortless Booking</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Our platform combines cutting-edge technology with user-friendly design to deliver
              the best beauty service experience in the UAE.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={index} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 md:py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How It <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Works</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Getting started with NILIN is simple. Follow these easy steps to book your first service.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: 1, icon: <Users className="w-8 h-8" />, title: 'Create Account', desc: 'Sign up in seconds with your email or phone' },
              { step: 2, icon: <Search className="w-8 h-8" />, title: 'Browse Services', desc: 'Explore verified providers and services near you' },
              { step: 3, icon: <Calendar className="w-8 h-8" />, title: 'Book & Pay', desc: 'Select time, confirm, and pay securely' },
              { step: 4, icon: <Star className="w-8 h-8" />, title: 'Enjoy & Review', desc: 'Get amazing service and share your experience' },
            ].map((item, idx) => (
              <div key={idx} className="relative text-center">
                {idx < 3 && (
                  <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-indigo-200 to-purple-200 dark:from-indigo-800 dark:to-purple-800" />
                )}
                <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
                  <div className="text-white">{item.icon}</div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-sm font-bold text-gray-900">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/demo')}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all inline-flex items-center gap-2"
            >
              Try It Now
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 md:py-24 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-indigo-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Loved by <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Thousands</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              See what our users have to say about their NILIN experience.
            </p>
          </div>

          <div className="relative max-w-3xl mx-auto">
            <button
              onClick={() => setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>

            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500"
                style={{ transform: `translateX(-${currentTestimonial * 100}%)` }}
              >
                {testimonials.map((testimonial, idx) => (
                  <div key={idx} className="w-full flex-shrink-0 px-4">
                    <TestimonialCard testimonial={testimonial} />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentTestimonial(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === currentTestimonial ? 'bg-indigo-600 w-8' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Simple, <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Transparent</span> Pricing
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Choose the plan that fits your needs. No hidden fees, no surprises.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
            {pricingTiers.map((tier, idx) => (
              <PricingCard key={idx} tier={tier} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-indigo-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Beauty Experience?
          </h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers and discover the future of beauty services.
            Your first booking is on us!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/demo')}
              className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Try Demo (Free)
            </button>
            <button
              onClick={() => navigate('/register/customer')}
              className="px-8 py-4 border-2 border-white text-white rounded-xl font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              Create Account
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Logo & Description */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">NILIN</span>
              </div>
              <p className="text-gray-400 mb-4 max-w-sm">
                The premier beauty services marketplace in the UAE. Book verified professionals,
                earn rewards, and discover your perfect look.
              </p>
              <div className="flex gap-4">
                {[Instagram, Twitter, Facebook].map((Icon, idx) => (
                  <a key={idx} href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-indigo-600 transition-colors">
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                {['About Us', 'Careers', 'Press', 'Blog'].map((item) => (
                  <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2">
                {['Help Center', 'Contact Us', 'Privacy Policy', 'Terms of Service'].map((item) => (
                  <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm">&copy; 2024 NILIN. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Dubai, UAE
              </span>
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                hello@nilin.app
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Add Search import that was missing
const Search: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

export default LandingPage;
