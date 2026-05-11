import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, TrendingUp, Clock, Sparkles } from 'lucide-react';

const ProviderCTA: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="py-10 md:py-14 mx-4 sm:mx-6 lg:mx-8 mb-8 md:mb-12">
      <div className="relative max-w-7xl mx-auto rounded-3xl overflow-hidden">
        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&fit=crop"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/80 to-gray-900/60" />
        </div>

        {/* Decorative accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-nilin-accent/20 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-nilin-primary/20 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />

        <div className="relative px-6 sm:px-10 lg:px-14 py-12 md:py-16">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
            {/* Left Content */}
            <div className="text-center lg:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full mb-5 border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-nilin-accent" />
                <span className="text-xs font-semibold text-white/90">FOR PROFESSIONALS</span>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                Work anytime, earn more,
                <br className="hidden sm:block" />
                <span className="text-nilin-accent">grow your business</span>
              </h2>
              <p className="text-sm sm:text-base text-white/60 mb-7 max-w-lg mx-auto lg:mx-0">
                Join Dubai's fastest-growing beauty platform. Set your own hours, connect with clients, and earn more.
              </p>

              {/* Benefits */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-3 mb-0 lg:mb-0">
                <div className="flex items-center gap-2 px-3.5 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-white font-medium">Flexible Hours</span>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-white font-medium">Higher Earnings</span>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white font-medium">Smart Tools</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex-shrink-0">
              <button
                onClick={() => navigate('/register/provider')}
                className="group flex items-center gap-3 px-8 sm:px-10 py-4 bg-white text-gray-900 rounded-full font-bold hover:shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all text-base"
              >
                Join as Provider
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-center text-white/40 text-xs mt-3">Free to join. No commitments.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProviderCTA;
