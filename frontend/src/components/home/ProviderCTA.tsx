import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, TrendingUp, Clock, Sparkles, CheckCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import analytics from '../../services/product/AnalyticsService';
import { TextRevealCard, TextRevealCardTitle, TextRevealCardDescription } from '../ui/text-reveal-card';
import { TextHoverEffect } from '../ui/text-hover-effect';
import { CardSpotlight } from '../ui/sparkles';

const PROVIDER_CTA_BG =
  'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=1400&q=80&fit=crop';

const BENEFITS = [
  { icon: Clock, label: 'Flexible Hours', desc: 'Set your own schedule' },
  { icon: TrendingUp, label: 'Higher Earnings', desc: 'Up to 80% commission' },
  { icon: Briefcase, label: 'Smart Tools', desc: 'Built-in management' },
  { icon: ShieldCheck, label: 'Verified Profile', desc: 'Stand out to clients' },
] as const;

const REVEAL_CARDS = [
  {
    text: "Set Your",
    revealText: "Own Hours",
    title: "Be Your Own Boss",
    description: "Work when it suits you. Morning, evening, or weekends — you decide.",
  },
  {
    text: "Connect",
    revealText: "With Clients",
    title: "Growing Network",
    description: "Access thousands of clients looking for beauty services in Dubai.",
  },
  {
    text: "Earn",
    revealText: "More Today",
    title: "Premium Earnings",
    description: "Set your own rates and earn up to 80% commission on every booking.",
  },
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
      className="py-8 md:py-12 mb-6 md:mb-8 animate-nilin-in"
      aria-labelledby="provider-cta-heading"
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Main CTA Banner */}
        <div className="relative rounded-2xl overflow-hidden min-h-[420px] md:min-h-[460px] lg:min-h-[480px]">
          <div className="absolute inset-0">
            {!imageFailed && (
              <img
                src={PROVIDER_CTA_BG}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="w-full h-full object-cover object-center scale-105"
                onError={() => setImageFailed(true)}
              />
            )}
            {/* Lighter overlay — keeps text readable while showing the salon photo */}
            <div className="absolute inset-0 bg-gradient-to-r from-nilin-charcoal/75 via-nilin-charcoal/55 to-nilin-charcoal/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-nilin-charcoal/60 via-transparent to-nilin-charcoal/20" />
          </div>

          {/* Subtle glow */}
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-nilin-coral/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative px-6 sm:px-10 lg:px-14 py-12 md:py-16 lg:py-[4.5rem]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10 lg:gap-14 max-w-7xl mx-auto">
              {/* Left Content */}
              <div className="flex-1 w-full lg:max-w-[58%]">
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="inline-flex items-center gap-2 px-4 py-2 glass-nilin-dark rounded-full mb-5"
                >
                  <Sparkles className="w-4 h-4 text-nilin-coral" />
                  <span className="text-sm font-medium text-white/95 tracking-wide">
                    For Beauty Professionals
                  </span>
                </motion.div>

                {/* Heading */}
                <motion.h2
                  id="provider-cta-heading"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="text-3xl sm:text-4xl md:text-5xl font-serif text-white mb-4 leading-[1.15]"
                >
                  Work anytime,{' '}
                  <span className="bg-gradient-to-r from-nilin-coral via-nilin-rose to-nilin-blush bg-clip-text text-transparent">
                    earn more.
                  </span>
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  className="text-base sm:text-lg text-white/85 mb-8 max-w-xl leading-relaxed"
                >
                  Join Dubai's fastest-growing beauty platform. Set your own hours, connect with clients.
                </motion.p>

                {/* Benefits Grid */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-xl"
                >
                  {BENEFITS.map(({ icon: Icon, label, desc }, index) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.25 + index * 0.05 }}
                      className="flex items-start gap-3 p-4 glass-nilin-dark rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-nilin-coral/25 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-nilin-coral" />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-white font-semibold text-sm sm:text-base leading-snug">{label}</p>
                        <p className="text-white/60 text-sm leading-snug mt-0.5">{desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {/* Right CTA Card */}
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="w-full lg:w-[320px] xl:w-[340px] flex-shrink-0 lg:self-center"
              >
                <CardSpotlight className="p-7 sm:p-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center mb-5 shadow-lg shadow-nilin-coral/25">
                      <Briefcase className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="text-xl sm:text-2xl font-serif text-white mb-2">
                      Start Your Journey
                    </h3>
                    <p className="text-white/65 text-sm sm:text-base mb-6 leading-relaxed">
                      Join beauty professionals on NILIN
                    </p>

                    <button
                      type="button"
                      onClick={handleJoinClick}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-full font-semibold text-base hover:shadow-lg hover:shadow-nilin-coral/25 transition-all"
                    >
                      Join as Provider
                      <ArrowRight className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-5 mt-5 text-white/55 text-sm">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-nilin-coral" />
                        Free
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-nilin-coral" />
                        No commitment
                      </span>
                    </div>
                  </div>
                </CardSpotlight>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Text Hover Effect Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mt-12 mb-8"
        >
          <div className="h-20 md:h-28">
            <TextHoverEffect text="NILIN PRO" />
          </div>
        </motion.div>

        {/* Text Reveal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REVEAL_CARDS.map((card, index) => (
            <motion.div
              key={card.text}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <TextRevealCard text={card.text} revealText={card.revealText}>
                <TextRevealCardTitle>{card.title}</TextRevealCardTitle>
                <TextRevealCardDescription>{card.description}</TextRevealCardDescription>
              </TextRevealCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProviderCTA;