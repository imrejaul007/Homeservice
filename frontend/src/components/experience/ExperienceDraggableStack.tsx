import React, { useRef, useState } from 'react';
import { Star, User } from 'lucide-react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  animate,
} from 'framer-motion';
import type { Experience } from '../../types/experience';
import ExperienceDetailModal from './ExperienceDetailModal';
import { cn } from '@/lib/utils';

/** Centered scatter — keeps cards inside the canvas */
const CARD_LAYOUTS = [
  'absolute top-[5%] left-[6%] rotate-[-5deg] z-[1]',
  'absolute top-[26%] left-[16%] rotate-[4deg] z-[2]',
  'absolute top-[3%] left-[30%] rotate-[-3deg] z-[3]',
  'absolute top-[30%] left-[42%] rotate-[6deg] z-[4]',
  'absolute top-[6%] right-[30%] rotate-[-2deg] z-[5]',
  'absolute top-[28%] right-[16%] rotate-[5deg] z-[6]',
  'absolute top-[18%] left-[22%] rotate-[2deg] z-[7]',
  'absolute top-[38%] left-[34%] rotate-[-4deg] z-[8]',
  'absolute top-[10%] right-[8%] rotate-[3deg] z-[9]',
  'absolute top-[36%] right-[6%] rotate-[-5deg] z-[10]',
];

interface ExperienceDraggableCardProps {
  experience: Experience;
  layoutClass: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onOpen: () => void;
}

const springConfig = { stiffness: 120, damping: 22, mass: 0.5 };

const renderStars = (rating: number) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={cn(
          'h-4 w-4',
          star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'
        )}
      />
    ))}
  </div>
);

const ExperienceDraggableCard: React.FC<ExperienceDraggableCardProps> = ({
  experience,
  layoutClass,
  containerRef,
  onOpen,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);

  const rotateX = useSpring(useTransform(mouseY, [-200, 200], [12, -12]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-200, 200], [-12, 12]), springConfig);

  const imageUrl =
    experience.images?.[0] ||
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
  const userName = `${experience.userId?.firstName || 'Guest'} ${experience.userId?.lastName?.charAt(0) || ''}.`.trim();

  const snapToHome = () => {
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
    animate(y, 0, { type: 'spring', stiffness: 420, damping: 32 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - (rect.left + rect.width / 2));
    mouseY.set(e.clientY - (rect.top + rect.height / 2));
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      drag
      dragConstraints={containerRef}
      dragElastic={0.42}
      dragMomentum={false}
      style={{ x, y, rotateX, rotateY, zIndex: isDragging ? 50 : undefined }}
      onDragStart={() => {
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
      }}
      onDragEnd={() => {
        setIsDragging(false);
        document.body.style.cursor = 'default';
        snapToHome();
      }}
      onTap={() => onOpen()}
      whileHover={{ scale: 1.02 }}
      whileDrag={{ scale: 1.04, cursor: 'grabbing' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        layoutClass,
        'w-[300px] sm:w-[360px] md:w-[400px]',
        'rounded-2xl bg-white/95 backdrop-blur-sm p-5',
        'border border-white shadow-[0_24px_60px_rgba(45,45,45,0.14)]',
        '[transform-style:preserve-3d] cursor-grab touch-none select-none'
      )}
    >
      <div className="relative z-10 pointer-events-none">
        <div className="relative overflow-hidden rounded-xl ring-1 ring-nilin-charcoal/5">
          <img
            src={imageUrl}
            alt={experience.title}
            className="h-60 w-full object-cover sm:h-64 md:h-72"
            loading="lazy"
            draggable={false}
          />
          {experience.isFeatured && (
            <span className="absolute top-3 left-3 px-3 py-1.5 bg-nilin-coral text-white text-xs font-semibold rounded-full shadow-sm">
              Featured
            </span>
          )}
          {experience.images && experience.images.length > 1 && (
            <span className="absolute top-3 right-3 px-3 py-1.5 bg-white/95 text-nilin-charcoal text-xs font-medium rounded-full shadow-sm">
              +{experience.images.length - 1}
            </span>
          )}
        </div>

        <div className="mt-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            {renderStars(experience.rating)}
            <span className="text-sm font-semibold text-nilin-charcoal">{experience.rating}.0</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-serif font-medium text-nilin-charcoal line-clamp-2 leading-snug">
            {experience.title}
          </h3>

          <p className="text-sm sm:text-base text-nilin-warmGray line-clamp-2 leading-relaxed">
            {experience.description}
          </p>

          <div className="flex items-center gap-2.5 pt-1">
            <div className="w-8 h-8 rounded-full bg-nilin-blush flex items-center justify-center overflow-hidden flex-shrink-0">
              {experience.userId?.avatar ? (
                <img src={experience.userId.avatar} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-nilin-warmGray" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-nilin-charcoal truncate">{userName}</p>
              {experience.serviceId?.name && (
                <p className="text-xs text-nilin-coral truncate">{experience.serviceId.name}</p>
              )}
            </div>
          </div>

          <p className="pt-2 text-sm font-semibold text-nilin-coral">Tap to read full story</p>
        </div>
      </div>
    </motion.div>
  );
};

interface ExperienceDraggableStackProps {
  experiences: Experience[];
  subtitle?: string;
}

const ExperienceDraggableStack: React.FC<ExperienceDraggableStackProps> = ({
  experiences,
  subtitle = 'Crafted for perfection',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);

  return (
    <>
      <div
        ref={containerRef}
        className="relative mx-auto w-full min-h-[700px] sm:min-h-[780px] md:min-h-[820px] overflow-hidden rounded-[2rem] border border-white/60 bg-white/25 shadow-inner [perspective:2000px]"
      >
        <p className="pointer-events-none absolute top-1/2 left-1/2 z-0 max-w-lg -translate-x-1/2 -translate-y-1/2 text-center text-2xl font-serif text-nilin-charcoal/15 md:text-5xl select-none">
          {subtitle}
        </p>
        <p className="pointer-events-none absolute bottom-5 left-1/2 z-0 -translate-x-1/2 text-sm text-nilin-warmGray select-none">
          Drag to play · Tap a card to open the full story
        </p>

        {experiences.map((experience, index) => (
          <ExperienceDraggableCard
            key={experience._id}
            experience={experience}
            layoutClass={CARD_LAYOUTS[index % CARD_LAYOUTS.length]}
            containerRef={containerRef}
            onOpen={() => setSelectedExperience(experience)}
          />
        ))}
      </div>

      {selectedExperience && (
        <ExperienceDetailModal
          experience={selectedExperience}
          isOpen={!!selectedExperience}
          onClose={() => setSelectedExperience(null)}
        />
      )}
    </>
  );
};

export default ExperienceDraggableStack;
