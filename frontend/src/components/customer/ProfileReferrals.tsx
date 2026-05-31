import React, { useState, useEffect } from 'react';
import {
  Gift,
  Share2,
  Copy,
  Check,
  Users,
  Coins,
  TrendingUp,
  ChevronRight,
  Twitter,
  Facebook,
  Link as LinkIcon,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

interface ReferralData {
  referralCode: string;
  referralUrl?: string;
  referrerReward?: number;
  refereeReward?: number;
}

interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  totalRewardsEarned: number;
  recentReferrals?: Array<{
    name: string;
    joinedAt: string;
  }>;
}

const ProfileReferrals: React.FC = () => {
  const { user } = useAuthStore();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    setIsLoading(true);
    try {
      const [codeRes, statsRes] = await Promise.all([
        api.get('/referrals/my-code'),
        api.get('/referrals/stats'),
      ]);
      setReferralData(codeRes.data.data);
      setStats(statsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (referralData?.referralCode) {
      await navigator.clipboard.writeText(referralData.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = (platform: 'twitter' | 'facebook' | 'copy') => {
    const shareText = `Join NILIN and get exclusive beauty services! Use my referral code: ${referralData?.referralCode}`;
    const shareUrl = referralData?.referralUrl;

    switch (platform) {
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;
      case 'copy':
        handleCopyCode();
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Code Card */}
      <div className="glass-nilin rounded-nilin p-6 hover-lift bg-gradient-to-br from-nilin-blush to-nilin-peach">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-nilin-coral flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-serif text-xl text-nilin-charcoal">Share & Earn</h3>
            <p className="text-sm text-nilin-warmGray">
              Invite friends and earn {referralData?.referrerReward || 500} coins!
            </p>
          </div>
        </div>

        <div className="bg-white/80 rounded-nilin-lg p-4 mb-4">
          <p className="text-xs text-nilin-warmGray mb-2">Your Referral Code</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-nilin-charcoal tracking-wider">
              {referralData?.referralCode || 'NILINXX'}
            </span>
            <button
              onClick={handleCopyCode}
              className="btn-nilin flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleShare('twitter')}
            className="flex-1 py-3 rounded-nilin bg-[#1DA1F2] text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Twitter className="w-5 h-5" />
            Twitter
          </button>
          <button
            onClick={() => handleShare('facebook')}
            className="flex-1 py-3 rounded-nilin bg-[#4267B2] text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Facebook className="w-5 h-5" />
            Facebook
          </button>
          <button
            onClick={() => handleShare('copy')}
            className="flex-1 py-3 rounded-nilin border border-nilin-border bg-white text-nilin-charcoal font-medium flex items-center justify-center gap-2 hover:bg-nilin-muted transition-colors"
          >
            <LinkIcon className="w-5 h-5" />
            Copy Link
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-nilin rounded-nilin p-4 text-center hover-lift">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-2">
            <Users className="w-5 h-5 text-nilin-coral" />
          </div>
          <p className="text-2xl font-bold text-nilin-charcoal">{stats?.totalReferrals || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Referrals</p>
        </div>

        <div className="glass-nilin rounded-nilin p-4 text-center hover-lift">
          <div className="w-10 h-10 rounded-full bg-nilin-success/20 flex items-center justify-center mx-auto mb-2">
            <Check className="w-5 h-5 text-nilin-success" />
          </div>
          <p className="text-2xl font-bold text-nilin-charcoal">{stats?.successfulReferrals || 0}</p>
          <p className="text-xs text-nilin-warmGray">Successful</p>
        </div>

        <div className="glass-nilin rounded-nilin p-4 text-center hover-lift">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-2">
            <Coins className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-nilin-charcoal">{stats?.totalRewardsEarned || 0}</p>
          <p className="text-xs text-nilin-warmGray">Coins Earned</p>
        </div>
      </div>

      {/* How it Works */}
      <div className="glass-nilin rounded-nilin p-6 hover-lift">
        <h3 className="font-serif text-lg text-nilin-charcoal mb-4">How it Works</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-nilin-coral text-white flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-medium text-nilin-charcoal">Share Your Code</p>
              <p className="text-sm text-nilin-warmGray">Share your unique referral code with friends</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-nilin-coral text-white flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-medium text-nilin-charcoal">Friend Signs Up</p>
              <p className="text-sm text-nilin-warmGray">They use your code when creating their account</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-nilin-coral text-white flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-medium text-nilin-charcoal">Complete First Booking</p>
              <p className="text-sm text-nilin-warmGray">When they complete their first service booking, you both earn coins!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Referrals */}
      {stats?.recentReferrals && stats.recentReferrals.length > 0 && (
        <div className="glass-nilin rounded-nilin p-6 hover-lift">
          <h3 className="font-serif text-lg text-nilin-charcoal mb-4">Recent Referrals</h3>
          <div className="space-y-3">
            {stats.recentReferrals.map((referral, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b border-nilin-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nilin-blush to-nilin-coral flex items-center justify-center text-white font-medium">
                    {referral.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-nilin-charcoal">{referral.name}</p>
                    <p className="text-xs text-nilin-warmGray">
                      Joined {new Date(referral.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-yellow-600">
                  <Coins className="w-4 h-4" />
                  <span className="text-sm font-medium">+250</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewards Info */}
      <div className="glass-nilin rounded-nilin p-6 hover-lift">
        <h3 className="font-serif text-lg text-nilin-charcoal mb-4">Reward Tiers</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-nilin-muted rounded-nilin p-4 text-center">
            <p className="text-sm text-nilin-warmGray mb-1">When you refer</p>
            <p className="text-xl font-bold text-nilin-charcoal">You earn</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-lg font-bold text-yellow-600">{referralData?.referrerReward || 500}</span>
            </div>
          </div>
          <div className="bg-nilin-muted rounded-nilin p-4 text-center">
            <p className="text-sm text-nilin-warmGray mb-1">Your friend gets</p>
            <p className="text-xl font-bold text-nilin-charcoal">Welcome bonus</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-lg font-bold text-yellow-600">{referralData?.refereeReward || 250}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileReferrals;
