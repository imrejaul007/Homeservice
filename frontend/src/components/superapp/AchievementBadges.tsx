// Streak Widget - Daily engagement
import { motion, AnimatePresence } from 'framer-motion';
import { useHabits } from '../../services/superapp/HabitEngine';
import { Flame, Gift, ChevronRight } from 'lucide-react';

interface StreakWidgetProps {
  onCheckIn?: () => void;
  compact?: boolean;
}

export function StreakWidget({ onCheckIn, compact = false }: StreakWidgetProps) {
  const { currentStreak, longestStreak, checkIn, status } = useHabits();

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl p-4"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
          <span className="text-2xl">🔥</span>
        </div>
        <div className="flex-1">
          <p className="text-xl font-bold text-nilin-charcoal">{currentStreak} day streak</p>
          <p className="text-xs text-nilin-warmGray">{status.encouragement}</p>
        </div>
        {status.status !== 'active' && (
          <button
            onClick={onCheckIn}
            className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium"
          >
            Check in
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 rounded-3xl p-6 text-white relative overflow-hidden"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-4 right-4 text-6xl">🔥</div>
        <div className="absolute bottom-4 left-4 text-4xl">⭐</div>
      </div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-white/70">Current Streak</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold">{currentStreak}</span>
              <span className="text-lg text-white/70">days</span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-white/70">Best Streak</p>
            <p className="text-2xl font-bold">{longestStreak} days</p>
          </div>
        </div>

        {/* Progress to next milestone */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Next milestone</span>
            <span>{Math.min(currentStreak + 1, 7)} days</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((currentStreak / 7) * 100, 100)}%` }}
              className="h-full bg-white rounded-full"
            />
          </div>
        </div>

        {/* Status message */}
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <p className="text-center font-medium">{status.encouragement}</p>
        </div>

        {/* Actions */}
        {status.status !== 'active' && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onCheckIn}
            className="w-full py-3 bg-white text-orange-600 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <Flame className="w-5 h-5" />
            Check in now
          </motion.button>
        )}

        {status.status === 'active' && (
          <div className="flex items-center justify-center gap-2 text-sm text-white/80">
            <Gift className="w-4 h-4" />
            <span>You're on fire! Keep it going!</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Achievement Badges Component
interface AchievementBadgesProps {
  showUnlocked?: boolean;
}

export function AchievementBadges({ showUnlocked = true }: AchievementBadgesProps) {
  const { achievements } = useHabits();

  const unlockedAchievements = achievements.filter(a => a.unlockedAt);
  const lockedAchievements = achievements.filter(a => !a.unlockedAt);

  return (
    <div className="space-y-4">
      {/* Unlocked achievements */}
      {showUnlocked && unlockedAchievements.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-nilin-warmGray mb-3">Unlocked</h3>
          <div className="grid grid-cols-4 gap-3">
            {unlockedAchievements.map(achievement => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg">
                  {achievement.icon}
                </div>
                <span className="text-xs text-nilin-charcoal mt-1 text-center">{achievement.title}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Locked achievements */}
      {lockedAchievements.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-nilin-warmGray mb-3">In Progress</h3>
          <div className="space-y-2">
            {lockedAchievements.slice(0, 4).map(achievement => (
              <div key={achievement.id} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl grayscale opacity-50">
                  {achievement.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-nilin-charcoal text-sm">{achievement.title}</p>
                  <p className="text-xs text-nilin-warmGray">{achievement.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-nilin-charcoal">
                    {achievement.progress}/{achievement.requirement}
                  </p>
                  <div className="w-16 h-1 bg-gray-200 rounded-full mt-1">
                    <div
                      className="h-full bg-nilin-coral rounded-full"
                      style={{ width: `${(achievement.progress / achievement.requirement) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StreakWidget;
