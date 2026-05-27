import User from '../models/user.model';
import Booking from '../models/booking.model';
import logger from '../utils/logger';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'booking' | 'spending' | 'engagement' | 'social' | 'milestone';
  criteria: {
    type: 'bookings_count' | 'total_spent' | 'referrals' | 'streak' | 'reviews';
    value: number;
  };
  reward: {
    type: 'coins' | 'badge' | 'tier_upgrade';
    amount: number;
  };
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: Date;
  progress: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Booking achievements
  {
    id: 'first_booking',
    name: 'First Steps',
    description: 'Complete your first booking',
    icon: '🎯',
    category: 'booking',
    criteria: { type: 'bookings_count', value: 1 },
    reward: { type: 'coins', amount: 10 },
  },
  {
    id: 'five_bookings',
    name: 'Regular Customer',
    description: 'Complete 5 bookings',
    icon: '⭐',
    category: 'booking',
    criteria: { type: 'bookings_count', value: 5 },
    reward: { type: 'coins', amount: 50 },
  },
  {
    id: 'ten_bookings',
    name: 'Loyal Patron',
    description: 'Complete 10 bookings',
    icon: '🌟',
    category: 'booking',
    criteria: { type: 'bookings_count', value: 10 },
    reward: { type: 'coins', amount: 100 },
  },
  {
    id: 'twentyfive_bookings',
    name: 'VIP Customer',
    description: 'Complete 25 bookings',
    icon: '💫',
    category: 'booking',
    criteria: { type: 'bookings_count', value: 25 },
    reward: { type: 'tier_upgrade', amount: 1 },
  },
  {
    id: 'fifty_bookings',
    name: 'Platinum Member',
    description: 'Complete 50 bookings',
    icon: '👑',
    category: 'booking',
    criteria: { type: 'bookings_count', value: 50 },
    reward: { type: 'tier_upgrade', amount: 1 },
  },

  // Spending achievements
  {
    id: 'spent_100',
    name: 'Big Spender',
    description: 'Spend AED 100 in total',
    icon: '💰',
    category: 'spending',
    criteria: { type: 'total_spent', value: 100 },
    reward: { type: 'coins', amount: 20 },
  },
  {
    id: 'spent_500',
    name: 'Premium Spender',
    description: 'Spend AED 500 in total',
    icon: '💎',
    category: 'spending',
    criteria: { type: 'total_spent', value: 500 },
    reward: { type: 'coins', amount: 100 },
  },
  {
    id: 'spent_1000',
    name: 'Elite Member',
    description: 'Spend AED 1,000 in total',
    icon: '🏆',
    category: 'spending',
    criteria: { type: 'total_spent', value: 1000 },
    reward: { type: 'tier_upgrade', amount: 1 },
  },

  // Social achievements
  {
    id: 'first_referral',
    name: 'Word of Mouth',
    description: 'Refer your first friend',
    icon: '🤝',
    category: 'social',
    criteria: { type: 'referrals', value: 1 },
    reward: { type: 'coins', amount: 25 },
  },
  {
    id: 'five_referrals',
    name: 'Network Builder',
    description: 'Refer 5 friends',
    icon: '🌐',
    category: 'social',
    criteria: { type: 'referrals', value: 5 },
    reward: { type: 'coins', amount: 150 },
  },
  {
    id: 'ten_referrals',
    name: 'Ambassador',
    description: 'Refer 10 friends',
    icon: '🎖️',
    category: 'social',
    criteria: { type: 'referrals', value: 10 },
    reward: { type: 'coins', amount: 300 },
  },

  // Engagement achievements
  {
    id: 'first_review',
    name: 'Reviewer',
    description: 'Write your first review',
    icon: '✍️',
    category: 'engagement',
    criteria: { type: 'reviews', value: 1 },
    reward: { type: 'coins', amount: 15 },
  },
  {
    id: 'five_reviews',
    name: 'Prolific Reviewer',
    description: 'Write 5 reviews',
    icon: '📝',
    category: 'engagement',
    criteria: { type: 'reviews', value: 5 },
    reward: { type: 'coins', amount: 75 },
  },
];

class AchievementService {
  async checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
    const awarded: Achievement[] = [];

    const [user, bookingCount, totalSpent, referralCount, reviewCount] = await Promise.all([
      User.findById(userId),
      Booking.countDocuments({ customerId: userId, status: 'completed' }),
      Booking.aggregate([
        { $match: { customerId: userId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
      ]),
      User.countDocuments({ 'loyaltySystem.referredBy': { $ne: null } }),
      Booking.countDocuments({ customerId: userId, review: { $exists: true } }),
    ]);

    const unlockedIds = ((user?.loyaltySystem as any)?.achievements || []).map((a: any) => a.achievementId);
    const totalSpentAmount = totalSpent[0]?.total || 0;

    for (const achievement of ACHIEVEMENTS) {
      if (unlockedIds.includes(achievement.id)) continue;

      let currentValue = 0;
      switch (achievement.criteria.type) {
        case 'bookings_count':
          currentValue = bookingCount;
          break;
        case 'total_spent':
          currentValue = totalSpentAmount;
          break;
        case 'referrals':
          currentValue = referralCount;
          break;
        case 'reviews':
          currentValue = reviewCount;
          break;
      }

      if (currentValue >= achievement.criteria.value) {
        // Award achievement
        await this.awardAchievement(userId, achievement);
        awarded.push(achievement);
      }
    }

    return awarded;
  }

  private async awardAchievement(userId: string, achievement: Achievement): Promise<void> {
    // Update user achievements
    await User.findByIdAndUpdate(userId, {
      $push: {
        'loyaltySystem.achievements': {
          achievementId: achievement.id,
          unlockedAt: new Date(),
        },
      },
    });

    // Award reward
    if (achievement.reward.type === 'coins') {
      await User.findByIdAndUpdate(userId, {
        $inc: { 'loyaltySystem.coins': achievement.reward.amount },
      });
    }

    logger.info('Achievement awarded', { userId, achievement: achievement.id });
  }

  async getUserAchievements(userId: string): Promise<{ unlocked: Achievement[]; locked: Achievement[] }> {
    const user = await User.findById(userId);
    const unlockedIds = ((user?.loyaltySystem as any)?.achievements || []).map((a: any) => a.achievementId);

    return {
      unlocked: ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id)),
      locked: ACHIEVEMENTS.filter(a => !unlockedIds.includes(a.id)),
    };
  }

  async getAchievementProgress(userId: string): Promise<{ achievementId: string; progress: number; target: number }[]> {
    const user = await User.findById(userId);
    const unlockedIds = ((user?.loyaltySystem as any)?.achievements || []).map((a: any) => a.achievementId);

    const [bookingCount, totalSpent, referralCount, reviewCount] = await Promise.all([
      Booking.countDocuments({ customerId: userId, status: 'completed' }),
      Booking.aggregate([
        { $match: { customerId: userId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
      ]),
      User.countDocuments({ 'loyaltySystem.referredBy': { $ne: null } }),
      Booking.countDocuments({ customerId: userId, review: { $exists: true } }),
    ]);

    const totalSpentAmount = totalSpent[0]?.total || 0;

    return ACHIEVEMENTS.filter(a => !unlockedIds.includes(a.id)).map(achievement => {
      let currentValue = 0;
      switch (achievement.criteria.type) {
        case 'bookings_count': currentValue = bookingCount; break;
        case 'total_spent': currentValue = totalSpentAmount; break;
        case 'referrals': currentValue = referralCount; break;
        case 'reviews': currentValue = reviewCount; break;
      }

      return {
        achievementId: achievement.id,
        progress: currentValue,
        target: achievement.criteria.value,
      };
    });
  }
}

export const achievementService = new AchievementService();
