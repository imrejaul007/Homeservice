import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Star, Award, Sparkles, ArrowRight } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import analytics from '../../services/product/AnalyticsService';
import ThreeDMarqueeDemo from '../3d-marquee-demo';
import TextHoverEffect from '../text-hover-effect-demo';
import {
  TextRevealCard,
  TextRevealCardTitle,
  TextRevealCardDescription,
} from '../ui/text-reveal-card';

// Animated counter hook
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentCount = Math.floor(easeOut * end);
      setCount(currentCount);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isInView, end, duration]);

  return { count, ref };
}

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: 'Verified Experts',
    description: 'Every specialist is background-checked and licensed.',
    stat: 2000,
    suffix: '+',
    label: 'Vetted pros',
    href: '/about',
    analyticsEvent: 'trust_card_verified_experts',
  },
  {
    icon: Star,
    title: 'Premium Quality',
    description: 'Only top-rated professionals stay on our platform.',
    stat: 4.9,
    suffix: '',
    label: 'Avg. rating',
    href: '/search?sortBy=rating',
    analyticsEvent: 'trust_card_premium_quality',
    isDecimal: true,
  },
  {
    icon: Award,
    title: 'Satisfaction Guaranteed',
    description: "Not happy? We'll make it right or refund you.",
    stat: 100,
    suffix: '%',
    label: 'Guarantee',
    href: '/terms#cancellations',
    analyticsEvent: 'trust_card_satisfaction_guarantee',
  },
] as const;

// Text Reveal Card Data
const REVEAL_CARDS = [
  {
    text: "Your Beauty",
    revealText: "Our Passion",
    title: "Crafted for You",
    description: "Experience premium beauty services tailored to your unique style.",
  },
  {
    text: "Expert Care",
    revealText: "At Home",
    title: "Convenience Meets Luxury",
    description: "Top-rated professionals bring their skills directly to your doorstep.",
  },
  {
    text: "Book with",
    revealText: "Confidence",
    title: "100% Satisfaction",
    description: "Not happy? We'll make it right or refund you. No questions asked.",
  },
] as const;

const WhyNilin: React.FC = () => {
  const navigate = useNavigate();

  const handleCardClick = (href: string, analyticsEvent: string) => {
    analytics.track(analyticsEvent, { source: 'homepage_why_nilin' });
    navigate(href);
  };

  return (
    <section className="py-10 md:py-14 bg-nilin-blush/30 animate-nilin-in" aria-labelledby="why-nilin-heading">
      <div className="w-full">
        {/* Header with Text Hover Effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 px-4"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 glass-nilin rounded-full mb-4">
            <Sparkles className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
            <span className="text-sm font-medium text-nilin-charcoal">Why NILIN</span>
          </div>
          <h2 id="why-nilin-heading" className="text-4xl md:text-5xl lg:text-6xl font-serif text-nilin-charcoal mb-3">
            Beauty you can trust
          </h2>
          <p className="text-lg md:text-xl text-nilin-charcoal/70 mb-4">What sets us apart</p>

          {/* Text Hover Effect */}
          <div className="-my-2">
            <TextHoverEffect />
          </div>
        </motion.div>

        {/* Trust Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-20">
          {TRUST_ITEMS.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="glass-nilin rounded-3xl p-8 md:p-10 text-center card-3d hover-lift shadow-nilin-warm flex flex-col"
            >
              <div className="w-18 h-18 md:w-20 md:h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center shadow-xl">
                <item.icon className="w-9 h-9 md:w-10 md:h-10 text-white" />
              </div>

              <h3 className="text-xl md:text-2xl font-semibold text-nilin-charcoal mb-3">
                {item.title}
              </h3>
              <p className="text-sm md:text-base text-nilin-charcoal/70 mb-5 flex-1 leading-relaxed">
                {item.description}
              </p>

              {/* Animated Stat */}
              <div className="inline-flex items-center gap-3 px-6 py-3 md:px-8 md:py-4 rounded-2xl bg-gradient-to-r from-nilin-coral to-nilin-rose text-white shadow-lg mx-auto">
                <AnimatedNumber stat={item.stat} suffix={item.suffix} />
                <span className="text-sm md:text-base font-medium">{item.label}</span>
              </div>

              <button
                type="button"
                onClick={() => handleCardClick(item.href, item.analyticsEvent)}
                className="mt-5 inline-flex items-center gap-2 text-nilin-coral hover:text-nilin-rose transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded-2xl px-4 py-2"
              >
                Learn more
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </motion.article>
          ))}
        </div>

        {/* Text Reveal Cards Section */}
        <div className="mb-20 px-4 md:px-8 lg:px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h3 className="text-3xl md:text-4xl font-serif text-nilin-charcoal mb-4">
              The NILIN Experience
            </h3>
            <p className="text-nilin-charcoal/70 text-lg">Hover over each card to reveal more</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {REVEAL_CARDS.map((card, index) => (
              <motion.div
                key={card.text}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <TextRevealCard text={card.text} revealText={card.revealText}>
                  <TextRevealCardTitle>{card.title}</TextRevealCardTitle>
                  <TextRevealCardDescription>{card.description}</TextRevealCardDescription>
                </TextRevealCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 3D Marquee Gallery Section */}
        <div className="mt-8">
          <ThreeDMarqueeDemo />
        </div>
      </div>
    </section>
  );
};

// Animated Number Component
const AnimatedNumber: React.FC<{ stat: number; suffix: string }> = ({ stat, suffix }) => {
  const isDecimal = !Number.isInteger(stat);
  const { count, ref } = useCountUp(stat, 2500);

  if (isDecimal) {
    return <span ref={ref}>{count.toFixed(1)}{suffix}</span>;
  }

  const formatted = count >= 1000
    ? `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}k`
    : count.toLocaleString();

  return <span ref={ref}>{formatted}{suffix}</span>;
};

export default WhyNilin;