// SuperApp API - Streak, Habits, Achievements

import { api } from './api';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCheckIn: string | null;
  totalCheckIns: number;
  streakHistory: Array<{
    date: string;
    streak: number;
  }>;
}

export interface CheckInResult {
  success: boolean;
  newStreak: number;
  pointsEarned: number;
  message: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'bookings' | 'spending' | 'engagement' | 'social' | 'special';
  requirement: number;
  progress: number;
  unlockedAt?: number;
  reward?: number;
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  type: 'bookings' | 'spending' | 'checkin' | 'referral';
  target: number;
  progress: number;
  reward: number;
  expiresAt: number;
  completed: boolean;
}

class SuperAppApiService {
  // ============================================
  // Streak API
  // ============================================

  /**
   * Get current streak data
   */
  async getStreak(): Promise<{ success: boolean; data: StreakData }> {
    const response = await api.get('/streak');
    return response.data;
  }

  /**
   * Check in to maintain/increase streak
   */
  async checkIn(): Promise<{ success: boolean; data: CheckInResult }> {
    const response = await api.post('/streak/checkin');
    return response.data;
  }

  /**
   * Get streak history
   */
  async getStreakHistory(days: number = 30): Promise<{ success: boolean; data: Array<{ date: string; streak: number }> }> {
    const response = await api.get(`/streak/history?days=${days}`);
    return response.data;
  }

  /**
   * Get streak leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<{ success: boolean; data: Array<{ userId: string; streak: number; rank: number }> }> {
    const response = await api.get(`/streak/leaderboard?limit=${limit}`);
    return response.data;
  }

  // ============================================
  // Habits/Achievements API
  // ============================================

  /**
   * Get all habits and achievements
   */
  async getHabits(): Promise<{ success: boolean; data: { achievements: Achievement[]; weeklyChallenge: WeeklyChallenge | null } }> {
    const response = await api.get('/habits');
    return response.data;
  }

  /**
   * Get weekly challenge
   */
  async getWeeklyChallenge(): Promise<{ success: boolean; data: WeeklyChallenge | null }> {
    const response = await api.get('/habits/weekly');
    return response.data;
  }

  /**
   * Claim weekly challenge reward
   */
  async claimWeeklyReward(): Promise<{ success: boolean; message: string; data: { success: boolean; reward: number } }> {
    const response = await api.post('/habits/claim');
    return response.data;
  }

  /**
   * Update weekly progress
   */
  async updateProgress(type: string, amount: number): Promise<{ success: boolean }> {
    const response = await api.post('/habits/progress', { type, amount });
    return response.data;
  }

  /**
   * Unlock achievement (admin/system use)
   */
  async unlockAchievement(achievementId: string): Promise<{ success: boolean; message: string; data: Achievement | null }> {
    const response = await api.post('/habits/unlock', { achievementId });
    return response.data;
  }
}

export const superAppApi = new SuperAppApiService();
export default superAppApi;
