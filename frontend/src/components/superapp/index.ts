// SuperApp components export
export { SuperAppHome } from './SuperAppHome';
export { SmartQuickActions } from './SmartQuickActions';
export { StreakWidget, AchievementBadges } from './AchievementBadges';
export { SpendingInsights } from './SpendingInsights';

// SuperApp services export
export { predictiveEngine, useBookingSuggestions } from '../../services/superapp/PredictiveEngine';
export { useHabitStore, useHabits, ACHIEVEMENTS } from '../../services/superapp/HabitEngine';
export { useRewardsStore, useRewards, pointsToCurrency } from '../../services/superapp/RewardsEngine';
