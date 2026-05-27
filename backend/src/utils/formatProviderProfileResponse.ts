import type { IProviderProfile } from '../models/providerProfile.model';

/**
 * Full provider profile payload for auth/me and profile updates.
 * Keeps dashboard fields while including data needed by the profile editor.
 */
export function formatProviderProfileForClient(
  providerProfile: IProviderProfile,
  pendingBalance = 0
) {
  const pp = providerProfile.toObject ? providerProfile.toObject() : providerProfile;

  return {
    id: pp._id,
    _id: pp._id,
    userId: pp.userId,
    businessName: pp.businessInfo?.businessName,
    completionPercentage: pp.completionPercentage,
    verificationStatus: pp.verificationStatus,
    servicesCount: pp.services?.length ?? 0,
    isActive: pp.isActive,
    isVerified: pp.instagramStyleProfile?.isVerified ?? false,
    bio: pp.instagramStyleProfile?.bio ?? '',
    instagramStyleProfile: pp.instagramStyleProfile,
    businessInfo: pp.businessInfo,
    locationInfo: pp.locationInfo,
    yearsExperience: (pp.businessInfo as { yearsExperience?: number })?.yearsExperience,
    serviceAreas: pp.locationInfo?.serviceAreas ?? [],
    ratings: {
      average: pp.reviewsData?.averageRating ?? 0,
      count: pp.reviewsData?.totalReviews ?? 0,
      distribution: pp.reviewsData?.ratingDistribution,
    },
    earnings: {
      total: pp.analytics?.revenueStats?.totalEarnings ?? 0,
      thisMonth: pp.analytics?.revenueStats?.currentMonthEarnings ?? 0,
      pending: pendingBalance,
      totalEarned: pp.analytics?.revenueStats?.totalEarnings ?? 0,
      availableBalance: (pp.analytics?.revenueStats?.totalEarnings ?? 0) - pendingBalance,
      pendingBalance,
    },
    analytics: pp.analytics,
    reviewsData: pp.reviewsData,
  };
}
