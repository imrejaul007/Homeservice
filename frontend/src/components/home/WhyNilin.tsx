import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Star, Award, Sparkles, ArrowRight } from 'lucide-react';
import analytics from '../../services/product/AnalyticsService';

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: 'Verified Experts',
    description: 'Every specialist is background-checked and licensed.',
    stat: '2,000+',
    label: 'Vetted pros',
    href: '/about',
    analyticsEvent: 'trust_card_verified_experts',
  },
  {
    icon: Star,
    title: 'Premium Quality',
    description: 'Only top-rated professionals stay on our platform.',
    stat: '4.9',
    label: 'Avg. rating',
    href: '/search?sortBy=rating',
    analyticsEvent: 'trust_card_premium_quality',
  },
  {
    icon: Award,
    title: 'Satisfaction Guaranteed',
    description: "Not happy? We'll make it right or refund you.",
    stat: '100%',
    label: 'Guarantee',
    href: '/terms#cancellations',
    analyticsEvent: 'trust_card_satisfaction_guarantee',
  },
] as const;

const WhyNilin: React.FC = () => {
  const navigate = useNavigate();

  const handleCardClick = (href: string, analyticsEvent: string) => {
    analytics.track(analyticsEvent, { source: 'homepage_why_nilin' });
    navigate(href);
  };

  return (
    <section
      className="py-12 md:py-16 px-4 bg-nilin-blush/30 animate-nilin-in"
      aria-labelledby="why-nilin-heading"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-nilin rounded-nilin mb-4">
            <Sparkles className="w-4 h-4 text-nilin-coral" aria-hidden="true" />
            <span className="text-sm text-nilin-charcoal">Why NILIN</span>
          </div>
          <h2
            id="why-nilin-heading"
            className="text-3xl md:text-4xl font-serif text-nilin-charcoal mb-3"
          >
            Beauty you can trust
          </h2>
          <p className="text-nilin-charcoal/70">What sets us apart</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRUST_ITEMS.map((item) => (
            <article
              key={item.title}
              className="glass-nilin rounded-nilin p-6 text-center card-3d hover-lift shadow-nilin-warm flex flex-col"
            >
              <div
                className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center shadow-lg"
                aria-hidden="true"
              >
                <item.icon className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-lg font-medium text-nilin-charcoal mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-nilin-charcoal/70 mb-4 flex-1">
                {item.description}
              </p>

              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-nilin-coral to-nilin-rose text-white text-sm font-semibold shadow-nilin-warm mx-auto">
                <span className="text-lg font-bold">{item.stat}</span>
                <span>{item.label}</span>
              </div>

              <button
                type="button"
                onClick={() => handleCardClick(item.href, item.analyticsEvent)}
                className="mt-4 inline-flex items-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded-nilin px-2 py-1"
              >
                Learn more
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyNilin;
