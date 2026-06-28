import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Users, Shield, Heart, ArrowRight } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import { homeTrendingApi, type PlatformStats } from '../services/homeTrendingApi';

const formatStat = (value: number, suffix = '+'): string => {
  if (value <= 0) return '0';
  return `${value.toLocaleString()}${suffix}`;
};

const AboutPage: React.FC = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    homeTrendingApi
      .getPlatformStats(abortController.signal)
      .then(setStats)
      .catch(() => setStats(null));
    return () => abortController.abort();
  }, []);

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col overflow-x-hidden">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-5">
          {/* Hero Section */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-nilin-charcoal mb-4 break-words">
              About NILIN
            </h1>
            <p className="text-base sm:text-lg text-nilin-warmGray max-w-2xl mx-auto">
              Flow of Opportunity. Connecting professionals and clients in a trusted, intelligent ecosystem.
            </p>
          </div>

          <div className="glass-nilin rounded-nilin-lg p-5 sm:p-8 md:p-10 mb-6 sm:mb-8">
            {/* Our Story */}
            <section className="mb-8 sm:mb-10">
              <h2 className="text-xl sm:text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-nilin-coral flex-shrink-0" />
                Our Story
              </h2>
              <p className="text-sm sm:text-base text-nilin-warmGray leading-relaxed mb-4">
                NILIN was born from a simple observation: the beauty and wellness industry in the Middle East was fragmented, making it difficult for clients to find trusted professionals and for skilled artisans to reach their full potential.
              </p>
              <p className="text-sm sm:text-base text-nilin-warmGray leading-relaxed">
                We set out to create something different—a platform that treats beauty professionals with the respect they deserve and connects them with clients who appreciate quality craftsmanship. NILIN is more than an app; it's a movement towards a more connected, trusted, and flourishing beauty ecosystem.
              </p>
            </section>

            {/* Our Mission */}
            <section className="mb-8 sm:mb-10">
              <h2 className="text-xl sm:text-2xl font-serif text-nilin-charcoal mb-4">Our Mission</h2>
              <p className="text-sm sm:text-base text-nilin-warmGray leading-relaxed">
                To empower beauty professionals with technology and opportunity while providing clients with seamless access to verified, high-quality services. We believe everyone deserves to feel confident and beautiful.
              </p>
            </section>

            {/* Values */}
            <section>
              <h2 className="text-xl sm:text-2xl font-serif text-nilin-charcoal mb-6">What We Stand For</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="p-4 sm:p-5 bg-nilin-blush/30 rounded-nilin">
                  <div className="w-10 h-10 rounded-full bg-nilin-peach flex items-center justify-center mb-3">
                    <Users className="w-5 h-5 text-nilin-rose" />
                  </div>
                  <h3 className="font-serif text-lg text-nilin-charcoal mb-2">Community First</h3>
                  <p className="text-sm text-nilin-warmGray">Building relationships that last, not just transactions.</p>
                </div>
                <div className="p-4 sm:p-5 bg-nilin-blush/30 rounded-nilin">
                  <div className="w-10 h-10 rounded-full bg-nilin-peach flex items-center justify-center mb-3">
                    <Shield className="w-5 h-5 text-nilin-rose" />
                  </div>
                  <h3 className="font-serif text-lg text-nilin-charcoal mb-2">Trust & Safety</h3>
                  <p className="text-sm text-nilin-warmGray">Verified professionals and secure bookings you can rely on.</p>
                </div>
                <div className="p-4 sm:p-5 bg-nilin-blush/30 rounded-nilin">
                  <div className="w-10 h-10 rounded-full bg-nilin-peach flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-nilin-rose" />
                  </div>
                  <h3 className="font-serif text-lg text-nilin-charcoal mb-2">Excellence</h3>
                  <p className="text-sm text-nilin-warmGray">Only the best professionals join our curated network.</p>
                </div>
                <div className="p-4 sm:p-5 bg-nilin-blush/30 rounded-nilin">
                  <div className="w-10 h-10 rounded-full bg-nilin-peach flex items-center justify-center mb-3">
                    <Heart className="w-5 h-5 text-nilin-rose" />
                  </div>
                  <h3 className="font-serif text-lg text-nilin-charcoal mb-2">Empathy</h3>
                  <p className="text-sm text-nilin-warmGray">We understand the needs of both clients and professionals.</p>
                </div>
              </div>
            </section>
          </div>

          {/* Stats Section */}
          <div className="glass-nilin rounded-nilin-lg p-5 sm:p-8 md:p-10 mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-serif text-nilin-charcoal mb-6 text-center">NILIN By The Numbers</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-nilin-coral mb-1">
                  {stats ? formatStat(stats.verifiedProfessionals) : '—'}
                </p>
                <p className="text-xs sm:text-sm text-nilin-warmGray">Verified Professionals</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-nilin-coral mb-1">
                  {stats ? formatStat(stats.happyClients) : '—'}
                </p>
                <p className="text-xs sm:text-sm text-nilin-warmGray">Happy Clients</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-nilin-coral mb-1">
                  {stats ? formatStat(stats.serviceCategories) : '—'}
                </p>
                <p className="text-xs sm:text-sm text-nilin-warmGray">Service Categories</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-serif text-nilin-coral mb-1">
                  {stats && stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'}
                </p>
                <p className="text-xs sm:text-sm text-nilin-warmGray">Average Rating</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center px-2">
            <p className="text-sm sm:text-base text-nilin-warmGray mb-4">Ready to experience NILIN?</p>
            <Link
              to="/search"
              className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-3 bg-nilin-coral text-white rounded-nilin font-medium hover:bg-nilin-rose transition-all duration-200 shadow-lg shadow-nilin-coral/30"
            >
              Explore Services
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AboutPage;
