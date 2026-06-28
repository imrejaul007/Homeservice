// Referral Attribution - Customer Analytics Component
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Gift, Users, TrendingUp, Copy, Share2, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface ReferralAttributionProps {
  customerId?: string;
  referralCode?: string;
}

interface ReferralData {
  referralId: string;
  referrerName: string;
  referralDate: string;
  status: 'pending' | 'converted' | 'expired';
  reward?: {
    amount: number;
    type: string;
    claimedAt?: string;
  };
}

interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  conversionRate: number;
  totalEarnings: number;
  referralCode: string;
  shareUrl: string;
}

interface ChannelData {
  channel: string;
  referrals: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  color: string;
}

const EMPTY_STATS: ReferralStats = {
  totalReferrals: 0,
  successfulReferrals: 0,
  pendingReferrals: 0,
  conversionRate: 0,
  totalEarnings: 0,
  referralCode: '',
  shareUrl: '',
};

export const ReferralAttribution: React.FC<ReferralAttributionProps> = ({
  customerId,
  referralCode,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats>(EMPTY_STATS);
  const [referrals, setReferrals] = useState<ReferralData[]>([]);
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'referrals' | 'channels'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getCustomerReferralAttribution(customerId);
        setStats({
          ...apiData.stats,
          referralCode: referralCode || apiData.stats.referralCode,
          shareUrl: apiData.stats.shareUrl,
        });
        setReferrals(
          apiData.referrals.map((referral) => ({
            referralId: referral.referralId,
            referrerName: referral.referrerName,
            referralDate: new Date(referral.referralDate).toISOString().split('T')[0],
            status: referral.status,
            reward: referral.reward
              ? {
                  amount: referral.reward.amount,
                  type: referral.reward.type,
                  claimedAt: referral.reward.claimedAt
                    ? new Date(referral.reward.claimedAt).toISOString().split('T')[0]
                    : undefined,
                }
              : undefined,
          })),
        );
        setChannelData(apiData.channels || []);
      } catch (err) {
        setStats(EMPTY_STATS);
        setReferrals([]);
        setChannelData([]);
        setError(err instanceof Error ? err.message : 'Failed to load referral data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [customerId, referralCode]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(stats.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = (platform: string) => {
    const text = `Join me on Rezin and get 50 coins free! Use my code: ${stats.referralCode}`;
    const url = stats.shareUrl;

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      email: `mailto:?subject=${encodeURIComponent('Join me on Rezin!')}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChannelData;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{data.channel}</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">
              Referrals: <span className="font-medium">{data.referrals}</span>
            </p>
            <p className="text-gray-600">
              Conversions: <span className="font-medium">{data.conversions}</span>
            </p>
            <p className="text-gray-600">
              Conversion Rate: <span className="font-medium">{data.conversionRate}%</span>
            </p>
            <p className="text-green-600">
              Revenue: <span className="font-medium">{formatCurrency(data.revenue)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-600" />
            Referral Program
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Track your referrals and earnings
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['overview', 'referrals', 'channels'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Referrals</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Successful</p>
          <p className="text-2xl font-bold text-green-600">{stats.successfulReferrals}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Conversion Rate</p>
          <p className="text-2xl font-bold text-blue-600">{stats.conversionRate}%</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Total Earnings</p>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalEarnings)}</p>
        </div>
      </div>

      {/* Referral Code Section */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Your Referral Code</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-gray-900 tracking-wider">
                {stats.referralCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
              >
                {copied ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Copy className="h-5 w-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleShare('whatsapp')}
              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              title="Share via WhatsApp"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </button>

            <button
              onClick={() => handleShare('twitter')}
              className="p-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors"
              title="Share via Twitter"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
              </svg>
            </button>

            <button
              onClick={() => handleShare('email')}
              className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              title="Share via Email"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>

            <button
              onClick={() => navigator.share?.({
                title: 'Join me on Rezin!',
                text: `Use my referral code ${stats.referralCode} to get 50 coins free!`,
                url: stats.shareUrl,
              })}
              className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              title="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Channel Performance Chart */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4">Channel Performance</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="channel"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="referrals" name="Referrals" radius={[4, 4, 0, 0]}>
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Recent Referrals</h4>
          {referrals.map((referral) => (
            <div
              key={referral.referralId}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{referral.referrerName}</p>
                  <p className="text-sm text-gray-500">{referral.referralDate}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    referral.status === 'converted'
                      ? 'bg-green-100 text-green-700'
                      : referral.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {referral.status}
                </span>
                {referral.reward && (
                  <span className="text-sm font-medium text-purple-600">
                    +{referral.reward.amount} coins
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'channels' && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Channel Breakdown</h4>
          {channelData.map((channel) => (
            <div key={channel.channel} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: channel.color }}
                  />
                  <span className="font-medium text-gray-900">{channel.channel}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(channel.revenue)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Referrals</p>
                  <p className="font-medium">{channel.referrals}</p>
                </div>
                <div>
                  <p className="text-gray-500">Conversions</p>
                  <p className="font-medium">{channel.conversions}</p>
                </div>
                <div>
                  <p className="text-gray-500">Rate</p>
                  <p className="font-medium text-green-600">{channel.conversionRate}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ReferralAttribution;
