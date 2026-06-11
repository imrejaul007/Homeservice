import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, TrendingUp, Clock, Sparkles } from 'lucide-react';
import analytics from '../../services/product/AnalyticsService';

const PROVIDER_CTA_BG =
  'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=1400&q=80&fit=crop&sat=-100';

const BENEFITS = [
  { icon: Clock, label: 'Flexible Hours' },
  { icon: TrendingUp, label: 'Higher Earnings' },
  { icon: Briefcase, label: 'Smart Tools' },
] as const;

const ProviderCTA: React.FC = () => {
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);

  const handleJoinClick = () => {
    analytics.track('provider_cta_click', { source: 'homepage_banner' });
    navigate('/register/provider');
  };

  return (
    <section
      className="py-12 md:py-16 mx-4 sm:mx-6 lg:mx-8 mb-8 md:mb-12 animate-nilin-in"
      aria-labelledby="provider-cta-heading"
    >
      <div className="relative max-w-7xl mx-auto rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-nilin-charcoal">
          {!imageFailed && (
            <img
              src={PROVIDER_CTA_BG}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-nilin-charcoal/95 via-nilin-charcoal/85 to-nilin-charcoal/60" />
        </div>

        <div
          className="absolute top-0 right-0 w-96 h-96 bg-nilin-coral/20 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-0 w-72 h-72 bg-nilin-primary/20 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative px-6 sm:px-10 lg:px-14 py-12 md:py-16">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
            <div className="text-center lg:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 glass-nilin-dark rounded-full mb-5">
                <Sparkles className="w-3.5 h-3.5 text-nilin-coral" aria-hidden="true" />
                <span className="text-xs font-semibold text-white/90 tracking-wide">
                  FOR PROFESSIONALS
                </span>
              </div>

              <h2
                id="provider-cta-heading"
                className="text-2xl sm:text-3xl md:text-4xl font-serif text-white mb-4 leading-tight"
              >
                Work anytime, earn more,
              </h2>
              <p className="text-sm sm:text-base text-white/70 mb-7 max-w-lg mx-auto lg:mx-0">
                Join Dubai&apos;s fastest-growing beauty platform. Set your own hours, connect with
                clients, and earn more.
              </p>

              <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                {BENEFITS.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-3.5 py-2 glass-nilin-dark rounded-xl"
                  >
                    <Icon className="w-4 h-4 text-nilin-coral" aria-hidden="true" />
                    <span className="text-sm text-white font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleJoinClick}
                className="group flex w-full sm:w-auto items-center justify-center gap-3 px-8 sm:px-10 py-4 bg-white text-nilin-charcoal rounded-full font-bold hover:shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-nilin-charcoal"
              >
                Join as Provider
                <ArrowRight
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  aria-hidden="true"
                />
              </button>
              <p className="text-center text-white/50 text-xs mt-3">
                Free to join. No commitment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProviderCTA;
