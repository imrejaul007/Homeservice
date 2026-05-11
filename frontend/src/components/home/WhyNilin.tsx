import React from 'react';
import { ShieldCheck, Star, ThumbsUp, Sparkles } from 'lucide-react';

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: 'Verified Professionals',
    description: 'Every specialist is background-checked, licensed, and reviewed before joining NILIN.',
    stat: '2,000+',
    statLabel: 'Vetted pros',
    gradient: 'from-indigo-500 to-purple-500',
    bg: 'bg-indigo-50',
  },
  {
    icon: Star,
    title: 'Top-Rated Services',
    description: 'Only professionals with consistently high ratings and positive reviews stay on our platform.',
    stat: '4.8',
    statLabel: 'Avg. rating',
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
  },
  {
    icon: ThumbsUp,
    title: 'Satisfaction Guaranteed',
    description: "Not happy with your service? We'll make it right or give you a full refund. No questions asked.",
    stat: '100%',
    statLabel: 'Money-back',
    gradient: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50',
  },
];

const WhyNilin: React.FC = () => {
  return (
    <section className="py-14 md:py-20 bg-white relative overflow-hidden">
      {/* Subtle decorative elements */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-nilin-pink/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-nilin-lavender/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 md:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-nilin-primary/10 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-nilin-primary" />
            <span className="text-sm font-semibold text-nilin-primary">Why NILIN</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Dubai's most trusted beauty platform
          </h2>
          <p className="text-gray-500 text-sm md:text-base max-w-lg mx-auto">
            We set the standard for at-home beauty services with verified professionals and guaranteed satisfaction
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.title}
              className="relative group bg-white rounded-2xl border border-gray-100 p-6 md:p-7 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-5 shadow-lg shadow-${item.gradient.split('-')[1]}-500/20 group-hover:scale-110 transition-transform`}>
                <item.icon className="w-7 h-7 text-white" />
              </div>

              {/* Stat */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">{item.stat}</span>
                <span className="text-sm text-gray-400 ml-2">{item.statLabel}</span>
              </div>

              {/* Content */}
              <h3 className="font-bold text-gray-900 text-lg mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {item.description}
              </p>

              {/* Decorative corner accent */}
              <div className={`absolute top-0 right-0 w-20 h-20 ${item.bg} rounded-bl-3xl rounded-tr-2xl opacity-50 group-hover:opacity-80 transition-opacity`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyNilin;
