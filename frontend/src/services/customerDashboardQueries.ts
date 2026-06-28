import {
  customerDashboardApi,
  type DashboardStats,
  type BookingSummary,
  type LoyaltyData,
  type StreakData,
} from './customerDashboardApi';

export interface CustomerDashboardQueryData {
  stats: DashboardStats | null;
  recentBookings: BookingSummary[];
  upcomingBookings: BookingSummary[];
  loyaltyPoints: LoyaltyData | null;
  currentStreak: StreakData | null;
}

const countActiveBookings = (bookings: BookingSummary[]): number =>
  bookings.filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length;

export async function fetchCustomerDashboardData(): Promise<CustomerDashboardQueryData> {
  let statsData: DashboardStats | null = null;
  let recent: BookingSummary[] = [];
  let upcoming: BookingSummary[] = [];
  let loyalty: LoyaltyData | null = null;
  let streak: StreakData | null = null;

  try {
    const dashboard = await customerDashboardApi.getDashboard();
    statsData = dashboard.stats;
    recent = dashboard.recentBookings || [];
    upcoming = dashboard.upcomingBookings || [];
    loyalty = dashboard.loyaltyPoints || null;
    streak = dashboard.currentStreak || null;
  } catch {
    const [statsResult, bookingsResult, loyaltyResult, streakResult] = await Promise.allSettled([
      customerDashboardApi.getStats(),
      customerDashboardApi.getRecentBookings(5),
      customerDashboardApi.getLoyalty(),
      customerDashboardApi.getStreak(),
    ]);

    if (statsResult.status === 'fulfilled') {
      statsData = statsResult.value;
    }
    if (bookingsResult.status === 'fulfilled') {
      recent = bookingsResult.value || [];
    }
    if (loyaltyResult.status === 'fulfilled') {
      loyalty = loyaltyResult.value;
    }
    if (streakResult.status === 'fulfilled') {
      streak = streakResult.value;
    }
  }

  const activeFromList = countActiveBookings(recent);
  if (statsData && (statsData.activeBookings ?? 0) === 0 && activeFromList > 0) {
    statsData = { ...statsData, activeBookings: activeFromList };
  }

  return {
    stats: statsData,
    recentBookings: recent,
    upcomingBookings: upcoming,
    loyaltyPoints: loyalty,
    currentStreak: streak,
  };
}

export const customerDashboardQueryKey = ['customer', 'dashboard'] as const;
export const customerWalletQueryKey = ['customer', 'wallet'] as const;
