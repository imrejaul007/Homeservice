// Referral Share Component - Viral growth
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gift, Share2, Copy, Check, MessageCircle, Users, Clock, TrendingUp } from 'lucide-react';
import { useReferralStore, shareToPlatform, calculateReferralReward, getDeepLink } from '../../services/marketplace/ReferralService';
import { analytics } from '../../services/product/AnalyticsService';
import toast from 'react-hot-toast';

interface ReferralShareProps {
  compact?: boolean;
}

// Mock friend avatars for social proof (in production, these would be real user avatars)
const FRIEND_AVATARS = [
  { initials: 'AK', color: 'bg-blue-500' },
  { initials: 'PS', color: 'bg-green-500' },
  { initials: 'MR', color: 'bg-purple-500' },
  { initials: 'JD', color: 'bg-orange-500' },
  { initials: 'ST', color: 'bg-pink-500' },
];

export function ReferralShare({ compact = false }: ReferralShareProps) {
  const { referralCode, referrals } = useReferralStore();
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number>(24 * 60 * 60 * 1000); // 24h in ms

  const referralCount = referrals.filter((r: { status: string }) => r.status === 'completed').length;
  const totalEarned = referrals.filter((r: { status: string }) => r.status === 'rewarded')
    .reduce((sum: number, r: { earnedCredits?: number }) => sum + (r.earnedCredits || 0), 0);
  const potentialEarnings = calculateReferralReward(referralCount + 1);

  // Progress to next reward tier
  const nextTierThreshold = referralCount < 1 ? 1 : referralCount < 5 ? 5 : referralCount < 10 ? 10 : 15;
  const progressToNext = Math.min(100, Math.round((referralCount / nextTierThreshold) * 100));
  const creditsToNextTier = (nextTierThreshold - referralCount) * 100;

  // Social proof: show "X friends joined" (mock data + real referrals)
  const socialProofCount = Math.max(5, referralCount + 5); // Always show at least 5

  // Countdown timer for urgency
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        const newTime = prev - 1000;
        return newTime > 0 ? newTime : 24 * 60 * 60 * 1000; // Reset after expiry
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleCopy = async () => {
    if (!referralCode?.code) return;

    try {
      const deepLink = getDeepLink(referralCode.code);
      const message = `Hey! Get ₹100 off your first booking on NILIN! Use my code: ${referralCode.code} - You get ₹100, I get ₹100 too! Win-win! 🎉\n\n${deepLink}`;
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success('Copied to clipboard!');
      analytics.trackReferralEvent('copy', { code: referralCode.code });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShare = (platform: 'whatsapp' | 'sms' | 'copy') => {
    analytics.trackReferralEvent('share_click', { platform });
    if (platform === 'copy') {
      handleCopy();
    } else {
      shareToPlatform(platform, referralCode?.code || '');
    }
  };

  if (!referralCode?.code) {
    return null;
  }

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-nilin-coral/10 to-nilin-blush/50 rounded-2xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-nilin-coral/20 flex items-center justify-center">
              <Gift className="w-5 h-5 text-nilin-coral" />
            </div>
            <div>
              <p className="text-sm font-semibold text-nilin-charcoal">Invite friends</p>
              <p className="text-xs text-nilin-warmGray">Earn ₹100 per referral</p>
            </div>
          </div>

          <button
            onClick={() => handleShare('whatsapp')}
            className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium flex items-center gap-1"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream rounded-3xl p-6 relative overflow-hidden"
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-nilin-coral/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-nilin-rose/10 rounded-full blur-3xl" />

      <div className="relative">
        {/* Header with countdown */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-lg flex items-center justify-center">
              <Gift className="w-6 h-6 text-nilin-coral" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-nilin-charcoal">Invite & Earn</h3>
              <p className="text-sm text-nilin-warmGray">Share your code, both of you earn!</p>
            </div>
          </div>

          {/* Countdown urgency */}
          <div className="flex items-center gap-1.5 bg-nilin-coral/10 px-3 py-1.5 rounded-full">
            <Clock className="w-4 h-4 text-nilin-coral" />
            <span className="text-xs font-semibold text-nilin-coral">
              {formatCountdown(countdown)}
            </span>
          </div>
        </div>

        {/* Social Proof - Friend avatars */}
        <div className="flex items-center gap-2 mb-4">
          {/* Friend avatars */}
          <div className="flex -space-x-2">
            {FRIEND_AVATARS.slice(0, 4).map((avatar, index) => (
              <div
                key={index}
                className={`w-8 h-8 rounded-full ${avatar.color} flex items-center justify-center text-white text-xs font-bold border-2 border-white`}
              >
                {avatar.initials}
              </div>
            ))}
            <div className="w-8 h-8 rounded-full bg-nilin-warmGray flex items-center justify-center text-white text-xs font-bold border-2 border-white">
              +{socialProofCount - 4}
            </div>
          </div>
          <p className="text-sm text-nilin-charcoal font-medium">
            <span className="text-nilin-coral font-bold">{socialProofCount}</span> friends joined this week!
          </p>
        </div>

        {/* Progress to next reward */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm font-semibold text-nilin-charcoal">Next reward</span>
            </div>
            <span className="text-xs text-nilin-warmGray">
              {referralCount}/{nextTierThreshold} friends
            </span>
          </div>
          <div className="h-2 bg-nilin-blush/30 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-full"
            />
          </div>
          <p className="text-xs text-nilin-warmGray mt-1.5">
            Invite {creditsToNextTier > 0 ? creditsToNextTier : 0} more friends to unlock ₹{nextTierThreshold >= 10 ? 150 : nextTierThreshold >= 5 ? 150 : 100} per referral!
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-nilin-charcoal">{referralCount}</div>
            <div className="text-xs text-nilin-warmGray">Friends</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-green-600">₹{totalEarned}</div>
            <div className="text-xs text-nilin-warmGray">Earned</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-nilin-coral">₹{potentialEarnings}</div>
            <div className="text-xs text-nilin-warmGray">Potential</div>
          </div>
        </div>

        {/* Referral code */}
        <div className="bg-white rounded-xl p-3 mb-4">
          <p className="text-xs text-nilin-warmGray mb-1">Your referral code</p>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold tracking-wider text-nilin-charcoal">
              {referralCode.code}
            </span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-nilin-blush/50 hover:bg-nilin-blush transition-colors"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5 text-nilin-coral" />
              )}
            </button>
          </div>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleShare('whatsapp')}
            className="flex flex-col items-center gap-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs">WhatsApp</span>
          </button>
          <button
            onClick={() => handleShare('sms')}
            className="flex flex-col items-center gap-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-xs">SMS</span>
          </button>
          <button
            onClick={() => handleShare('copy')}
            className="flex flex-col items-center gap-1 py-3 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors"
          >
            <Copy className="w-5 h-5" />
            <span className="text-xs">Copy</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default ReferralShare;
