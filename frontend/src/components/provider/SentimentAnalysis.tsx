/**
 * SentimentAnalysis - Review sentiment breakdown
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Star,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Filter,
  Search,
  ChevronDown,
  Loader2,
  Sparkles,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

// =============================================================================
// Type Definitions
// =============================================================================

export type SentimentType = 'positive' | 'neutral' | 'negative';
export type AspectType = 'quality' | 'professionalism' | 'timeliness' | 'communication' | 'value' | 'overall';

export interface Review {
  /** Review ID */
  id: string;
  /** Customer name */
  customerName: string;
  /** Customer avatar */
  customerAvatar?: string;
  /** Rating (1-5) */
  rating: number;
  /** Sentiment */
  sentiment: SentimentType;
  /** Sentiment score (0-100) */
  sentimentScore: number;
  /** Review text */
  text: string;
  /** Service name */
  serviceName: string;
  /** Date */
  date: string;
  /** Key phrases/words */
  keyPhrases?: string[];
  /** Aspects mentioned */
  aspects?: Partial<Record<AspectType, number>>;
}

export interface SentimentAnalysisData {
  /** Total reviews analyzed */
  totalReviews: number;
  /** Positive reviews count */
  positiveCount: number;
  /** Neutral reviews count */
  neutralCount: number;
  /** Negative reviews count */
  negativeCount: number;
  /** Average rating */
  averageRating: number;
  /** Average sentiment score */
  averageSentimentScore: number;
  /** Trend (compared to previous period) */
  trend: number;
  /** Reviews by aspect scores */
  aspectScores: Record<AspectType, number>;
  /** Sentiment distribution data */
  sentimentDistribution: Array<{ name: string; value: number; color: string }>;
  /** Aspect comparison data */
  aspectComparison: Array<{ aspect: string; score: number }>;
  /** Recent reviews */
  recentReviews: Review[];
  /** Common phrases */
  commonPhrases: Array<{ phrase: string; count: number; sentiment: SentimentType }>;
}

export interface SentimentAnalysisProps {
  /** Sentiment analysis data */
  data: SentimentAnalysisData;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when reviewing full review */
  onReviewClick?: (review: Review) => void;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Aspect Configuration
// =============================================================================

const aspectConfig: Record<AspectType, { label: string; icon: React.ElementType }> = {
  quality: { label: 'Service Quality', icon: Star },
  professionalism: { label: 'Professionalism', icon: ThumbsUp },
  timeliness: { label: 'Timeliness', icon: Clock },
  communication: { label: 'Communication', icon: MessageSquare },
  value: { label: 'Value for Money', icon: TrendingUp },
  overall: { label: 'Overall', icon: BarChart3 },
};

const sentimentConfig: Record<SentimentType, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  positive: { label: 'Positive', color: 'text-green-600', bgColor: 'bg-green-100', icon: ThumbsUp },
  neutral: { label: 'Neutral', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Minus },
  negative: { label: 'Negative', color: 'text-red-600', bgColor: 'bg-red-100', icon: ThumbsDown },
};

// =============================================================================
// Custom Tooltip
// =============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { name: string } }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-nilin-md border border-nilin-border p-3">
      <p className="text-sm font-medium text-nilin-charcoal">{payload[0].payload.name}</p>
      <p className="text-lg font-bold text-nilin-coral">{payload[0].value.toFixed(1)}%</p>
    </div>
  );
};

// =============================================================================
// Review Card Component
// =============================================================================

interface ReviewCardProps {
  review: Review;
  onClick?: () => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onClick }) => {
  const sentiment = sentimentConfig[review.sentiment];
  const SentimentIcon = sentiment.icon;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-nilin-border p-4 hover:shadow-nilin-sm cursor-pointer transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-nilin-coral">
              {review.customerName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h4 className="font-medium text-nilin-charcoal">{review.customerName}</h4>
            <p className="text-xs text-nilin-warmGray">{review.serviceName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              sentiment.bgColor,
              sentiment.color
            )}
          >
            <SentimentIcon className="w-3 h-3" />
            {sentiment.label}
          </span>
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              'w-4 h-4',
              i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            )}
          />
        ))}
        <span className="ml-2 text-sm text-nilin-warmGray">{review.rating}/5</span>
      </div>

      {/* Review Text */}
      <p className="text-sm text-nilin-charcoal line-clamp-3 mb-3">{review.text}</p>

      {/* Key Phrases */}
      {review.keyPhrases && review.keyPhrases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {review.keyPhrases.slice(0, 3).map((phrase, index) => (
            <span
              key={index}
              className="px-2 py-0.5 bg-nilin-muted text-nilin-warmGray text-xs rounded-full"
            >
              {phrase}
            </span>
          ))}
        </div>
      )}

      {/* Date */}
      <p className="text-xs text-nilin-lightGray mt-3">
        {new Date(review.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const SentimentAnalysis: React.FC<SentimentAnalysisProps> = ({
  data,
  isLoading = false,
  onReviewClick,
  className,
}) => {
  const [view, setView] = useState<'overview' | 'detailed' | 'phrases'>('overview');
  const [filterSentiment, setFilterSentiment] = useState<SentimentType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter reviews
  const filteredReviews = useMemo(() => {
    return data.recentReviews.filter((review) => {
      if (filterSentiment !== 'all' && review.sentiment !== filterSentiment) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          review.text.toLowerCase().includes(query) ||
          review.customerName.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [data.recentReviews, filterSentiment, searchQuery]);

  // Prepare aspect data for radar chart
  const radarData = useMemo(() => {
    return Object.entries(data.aspectScores).map(([key, value]) => ({
      aspect: aspectConfig[key as AspectType]?.label || key,
      score: value,
      fullMark: 100,
    }));
  }, [data.aspectScores]);

  // Prepare bar chart data
  const barData = useMemo(() => {
    return [
      { name: 'Positive', count: data.positiveCount, fill: '#22C55E' },
      { name: 'Neutral', count: data.neutralCount, fill: '#9CA3AF' },
      { name: 'Negative', count: data.negativeCount, fill: '#EF4444' },
    ];
  }, [data]);

  const isPositiveTrend = data.trend >= 0;

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-nilin-muted rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-nilin-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Sentiment Analysis
            </h3>
            <p className="text-sm text-nilin-warmGray">
              AI-powered review insights
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-nilin-muted rounded-lg p-1">
          {(['overview', 'detailed', 'phrases'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize',
                view === v
                  ? 'bg-white text-nilin-charcoal shadow-sm'
                  : 'text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Average Rating */}
        <div className="bg-nilin-coral/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-nilin-coral" />
            <span className="text-xs text-nilin-warmGray">Avg Rating</span>
          </div>
          <p className="text-2xl font-bold text-nilin-charcoal">
            {data.averageRating.toFixed(1)}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'w-3 h-3',
                  i < Math.round(data.averageRating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                )}
              />
            ))}
          </div>
        </div>

        {/* Sentiment Score */}
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-purple-600">Sentiment Score</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">
            {data.averageSentimentScore.toFixed(0)}%
          </p>
          <div
            className={cn(
              'flex items-center gap-1 mt-1 text-xs',
              isPositiveTrend ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isPositiveTrend ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{isPositiveTrend ? '+' : ''}{data.trend.toFixed(1)}% vs last period</span>
          </div>
        </div>

        {/* Positive Reviews */}
        <div className="bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ThumbsUp className="w-4 h-4 text-green-600" />
            <span className="text-xs text-green-600">Positive</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{data.positiveCount}</p>
          <p className="text-xs text-green-600/70 mt-1">
            {data.totalReviews > 0
              ? ((data.positiveCount / data.totalReviews) * 100).toFixed(0)
              : 0}
            % of reviews
          </p>
        </div>

        {/* Needs Attention */}
        <div className="bg-red-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs text-red-600">Needs Attention</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{data.negativeCount}</p>
          <p className="text-xs text-red-600/70 mt-1">
            {data.totalReviews > 0
              ? ((data.negativeCount / data.totalReviews) * 100).toFixed(0)
              : 0}
            % of reviews
          </p>
        </div>
      </div>

      {/* Charts Section */}
      {view === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sentiment Distribution */}
          <div className="bg-nilin-muted/30 rounded-xl p-4">
            <h4 className="text-sm font-medium text-nilin-charcoal mb-4">
              Sentiment Distribution
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.sentimentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.sentimentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Aspect Scores Radar */}
          <div className="bg-nilin-muted/30 rounded-xl p-4">
            <h4 className="text-sm font-medium text-nilin-charcoal mb-4">
              Aspect Scores
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E8E4E0" />
                  <PolarAngleAxis dataKey="aspect" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#E8B4A8"
                    fill="#E8B4A8"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Detailed View - Bar Chart */}
      {view === 'detailed' && (
        <div className="bg-nilin-muted/30 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-medium text-nilin-charcoal mb-4">
            Review Count by Sentiment
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Phrases View */}
      {view === 'phrases' && (
        <div className="bg-nilin-muted/30 rounded-xl p-4 mb-6">
          <h4 className="text-sm font-medium text-nilin-charcoal mb-4">
            Common Phrases
          </h4>
          <div className="space-y-3">
            {data.commonPhrases.slice(0, 10).map((phrase, index) => {
              const sentiment = sentimentConfig[phrase.sentiment];
              const PhraseIcon = sentiment.icon;
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        sentiment.bgColor,
                        sentiment.color
                      )}
                    >
                      <PhraseIcon className="w-3 h-3" />
                    </span>
                    <span className="text-sm text-nilin-charcoal">{phrase.phrase}</span>
                  </div>
                  <span className="text-sm text-nilin-warmGray">x{phrase.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-nilin-charcoal">Recent Reviews</h4>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-lightGray" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reviews..."
                className="pl-9 pr-4 py-1.5 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm w-48"
              />
            </div>
            <select
              value={filterSentiment}
              onChange={(e) => setFilterSentiment(e.target.value as SentimentType | 'all')}
              className="px-3 py-1.5 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
            >
              <option value="all">All Sentiment</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReviews.slice(0, 6).map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onClick={onReviewClick ? () => onReviewClick(review) : undefined}
            />
          ))}
        </div>

        {filteredReviews.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
            <p className="text-nilin-warmGray">No reviews found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default SentimentAnalysis;
