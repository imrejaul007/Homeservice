import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface AskNilinAIProps {
  onStartChat: () => void;
}

const AskNilinAI: React.FC<AskNilinAIProps> = ({ onStartChat }) => {
  return (
    <section className="py-6 md:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-nilin-lavender via-nilin-pink to-nilin-blue">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-nilin-primary/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-nilin-accent/20 rounded-full blur-2xl" />

          {/* Content */}
          <div className="relative p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left Content */}
            <div className="flex items-center gap-4 sm:gap-6 text-center md:text-left">
              {/* AI Icon */}
              <div className="flex-shrink-0 relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-nilin-primary via-nilin-secondary to-nilin-accent flex items-center justify-center shadow-xl shadow-nilin-primary/30">
                  <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                {/* Pulse animation */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-nilin-primary to-nilin-accent animate-ping opacity-20" />
              </div>

              {/* Text */}
              <div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Ask NILIN AI
                </h3>
                <p className="text-sm sm:text-base text-gray-700 max-w-md">
                  Let NILIN AI recommend the right specialist for you. Smart matching powered by AI.
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={onStartChat}
              className="group flex-shrink-0 flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-nilin-dark to-nilin-primary text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-nilin-primary/30 transition-all text-sm sm:text-base"
            >
              Start Smart Match
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AskNilinAI;
