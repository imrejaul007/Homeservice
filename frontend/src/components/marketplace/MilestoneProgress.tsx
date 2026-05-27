// Milestone Progress Component - Growth rewards
import { motion } from 'framer-motion';
import { Target, Trophy, TrendingUp, Gift, Star } from 'lucide-react';
import { useGrowthMilestones, GROWTH_MILESTONES } from '../../services/marketplace/ReferralService';

interface MilestoneProgressProps {
  stats: {
    bookings: number;
    referrals: number;
    reviews: number;
  };
}

const milestoneIcons: Record<string, any> = {
  bookings: Target,
  referrals: Gift,
  reviews: Star,
};

export function MilestoneProgress({ stats }: MilestoneProgressProps) {
  const { getNextMilestone, getProgress, getCompletedMilestones } = useGrowthMilestones();

  const completedMilestones = getCompletedMilestones(stats);
  const nextMilestone = getNextMilestone(stats);
  const progress = getProgress(stats);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 shadow-aaa-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-bold text-nilin-charcoal">Your Milestones</h3>
            <p className="text-sm text-nilin-warmGray">
              {completedMilestones.length} of {GROWTH_MILESTONES.length} completed
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-nilin-coral">{progress}%</div>
          <div className="text-xs text-nilin-warmGray">Progress</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-full"
        />
      </div>

      {/* Next milestone */}
      {nextMilestone && (
        <div className="bg-nilin-blush/30 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              {(() => {
                const Icon = milestoneIcons[nextMilestone.type] || TrendingUp;
                return <Icon className="w-5 h-5 text-nilin-coral" />;
              })()}
            </div>
            <div className="flex-1">
              <p className="text-sm text-nilin-warmGray mb-1">Next milestone</p>
              <h4 className="font-semibold text-nilin-charcoal mb-1">{nextMilestone.title}</h4>
              <p className="text-xs text-nilin-warmGray">{nextMilestone.description}</p>
              {nextMilestone.reward && (
                <div className="mt-2 flex items-center gap-1 text-nilin-coral text-sm font-medium">
                  <Gift className="w-4 h-4" />
                  <span>+₹{nextMilestone.reward} reward</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completed milestones */}
      {completedMilestones.length > 0 && (
        <div>
          <p className="text-sm font-medium text-nilin-charcoal mb-3">Completed</p>
          <div className="space-y-2">
            {completedMilestones.map((milestone: typeof GROWTH_MILESTONES[0]) => (
              <div
                key={milestone.id}
                className="flex items-center gap-3 py-2"
              >
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-nilin-charcoal">{milestone.title}</p>
                </div>
                {milestone.reward && (
                  <span className="text-xs text-green-600 font-medium">+₹{milestone.reward}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default MilestoneProgress;
