import React from 'react';
import { ShieldCheck, Star, Award, Sparkles } from 'lucide-react';

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: 'Verified Experts',
    description: 'Every specialist is background-checked and licensed.',
    stat: '2,000+',
    label: 'Vetted pros',
  },
  {
    icon: Star,
    title: 'Premium Quality',
    description: 'Only top-rated professionals stay on our platform.',
    stat: '4.9',
    label: 'Avg. rating',
  },
  {
    icon: Award,
    title: 'Satisfaction Guaranteed',
    description: "Not happy? We'll make it right or refund you.",
    stat: '100%',
    label: 'Guarantee',
  },
];

const WhyNilin: React.FC = () => {
  return (
    <section className="py-16 px-4 bg-nilin-blush/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-nilin-coral" />
            <span className="text-sm text-nilin-charcoal">Why NILIN</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-serif text-nilin-charcoal mb-3">
            Beauty you can trust
          </h2>
          <p className="text-nilin-warmGray">What sets us apart</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRUST_ITEMS.map((item, i) => (
            <div
              key={i}
              className="glass rounded-2xl p-6 text-center gradient-3d"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center shadow-lg">
                <item.icon className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-lg font-medium text-nilin-charcoal mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-nilin-warmGray mb-4">
                {item.description}
              </p>

              <div className="inline-block px-4 py-2 rounded-full bg-nilin-blush">
                <span className="text-2xl font-bold text-nilin-coral">{item.stat}</span>
                <span className="text-sm text-nilin-warmGray ml-2">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyNilin;
