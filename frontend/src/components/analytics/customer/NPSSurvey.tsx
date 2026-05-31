// Net Promoter Score Survey - Customer Analytics Component
import React, { useState, useEffect } from 'react';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Star, ThumbsUp, ThumbsDown, Loader, MessageSquare, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NPSSurveyProps {
  customerId?: string;
  onSubmit?: (score: number, feedback?: string) => void;
  autoShow?: boolean;
}

interface NPSData {
  score: number;
  feedback?: string;
  submittedAt?: Date;
}

interface NPSStats {
  currentScore: number;
  responseCount: number;
  promoters: number;
  passives: number;
  detractors: number;
  averageScore: number;
  trend: number;
  responseRate: number;
}

const MOCK_STATS: NPSStats = {
  currentScore: 72,
  responseCount: 156,
  promoters: 112,
  passives: 28,
  detractors: 16,
  averageScore: 8.4,
  trend: 5,
  responseRate: 68,
};

const SCORE_LABELS: Record<number, string> = {
  0: 'Not at all likely',
  1: '',
  2: '',
  3: '',
  4: '',
  5: '',
  6: '',
  7: 'Neutral',
  8: '',
  9: '',
  10: 'Extremely likely',
};

const PROMOTER_THRESHOLD = 9;
const DETRACTOR_THRESHOLD = 6;

export const NPSSurvey: React.FC<NPSSurveyProps> = ({
  customerId,
  onSubmit,
  autoShow = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NPSStats>(MOCK_STATS);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showSurvey, setShowSurvey] = useState(autoShow);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setLoading(false);
    };
    fetchData();
  }, [customerId]);

  const handleScoreSelect = (score: number) => {
    setCurrentScore(score);
  };

  const handleSubmit = async () => {
    if (currentScore === null) return;

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onSubmit?.(currentScore, feedback);
    setIsSubmitting(false);
    setIsSubmitted(true);

    // Update local stats
    const newPromoters = currentScore >= PROMOTER_THRESHOLD ? stats.promoters + 1 : stats.promoters;
    const newDetractors = currentScore < DETRACTOR_THRESHOLD ? stats.detractors + 1 : stats.detractors;
    const newPassives = currentScore >= DETRACTOR_THRESHOLD && currentScore < PROMOTER_THRESHOLD
      ? stats.passives + 1
      : stats.passives;
    const total = stats.responseCount + 1;
    const newScore = Math.round(((newPromoters - newDetractors) / total) * 100);

    setStats({
      ...stats,
      currentScore: newScore,
      responseCount: total,
      promoters: newPromoters,
      passives: newPassives,
      detractors: newDetractors,
    });
  };

  const renderScoreButton = (score: number) => {
    const isSelected = currentScore === score;
    const isPromoter = score >= PROMOTER_THRESHOLD;
    const isDetractor = score < DETRACTOR_THRESHOLD;

    return (
      <motion.button
        key={score}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleScoreSelect(score)}
        className={`
          w-10 h-10 rounded-lg font-semibold text-sm transition-all
          ${isSelected
            ? isPromoter
              ? 'bg-green-600 text-white shadow-lg'
              : isDetractor
              ? 'bg-red-600 text-white shadow-lg'
              : 'bg-yellow-500 text-white shadow-lg'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }
        `}
      >
        {score}
      </motion.button>
    );
  };

  const getCategoryLabel = () => {
    if (currentScore === null) return '';
    if (currentScore >= PROMOTER_THRESHOLD) return 'Promoter';
    if (currentScore >= DETRACTOR_THRESHOLD) return 'Passive';
    return 'Detractor';
  };

  const getCategoryColor = () => {
    if (currentScore === null) return '';
    if (currentScore >= PROMOTER_THRESHOLD) return 'text-green-600 bg-green-100';
    if (currentScore >= DETRACTOR_THRESHOLD) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getCategoryIcon = () => {
    if (currentScore === null) return null;
    if (currentScore >= PROMOTER_THRESHOLD) return <ThumbsUp className="h-4 w-4" />;
    if (currentScore >= DETRACTOR_THRESHOLD) return <Star className="h-4 w-4" />;
    return <ThumbsDown className="h-4 w-4" />;
  };

  // Chart data
  const chartData = [
    { name: 'Promoters', value: stats.promoters, fill: '#10B981' },
    { name: 'Passives', value: stats.passives, fill: '#F59E0B' },
    { name: 'Detractors', value: stats.detractors, fill: '#EF4444' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Net Promoter Score
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            How likely are you to recommend us?
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              stats.currentScore >= 70
                ? 'bg-green-100 text-green-700'
                : stats.currentScore >= 50
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {stats.currentScore > 0 ? '+' : ''}{stats.currentScore}
          </span>
        </div>
      </div>

      {/* Survey Section */}
      <AnimatePresence mode="wait">
        {!showSurvey && !isSubmitted ? (
          <motion.div
            key="trigger"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <button
              onClick={() => setShowSurvey(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Share Your Feedback
            </button>
          </motion.div>
        ) : isSubmitted ? (
          <motion.div
            key="submitted"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ThumbsUp className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Thank You!</h4>
            <p className="text-gray-600">
              Your feedback helps us improve our services.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="survey"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Score Labels */}
            <div className="flex justify-between text-xs text-gray-500 mb-2 px-1">
              <span>Not at all likely</span>
              <span>Extremely likely</span>
            </div>

            {/* Score Buttons */}
            <div className="flex justify-center gap-2 mb-6">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(renderScoreButton)}
            </div>

            {/* Selected Score Feedback */}
            <AnimatePresence>
              {currentScore !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <div className={`flex items-center justify-center gap-2 mb-4 ${getCategoryColor()} px-4 py-2 rounded-lg`}>
                    {getCategoryIcon()}
                    <span className="font-medium">You selected: {getCategoryLabel()}</span>
                  </div>

                  {/* Feedback Textarea */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <MessageSquare className="h-4 w-4 inline mr-1" />
                      Tell us more about your experience (optional)
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="What could we do better?"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowSurvey(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Submit Feedback
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NPS Breakdown Chart */}
      {stats.responseCount > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Score Breakdown</h4>

          <div className="flex items-center gap-8">
            {/* Donut Chart */}
            <div className="h-32 w-32">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="60%"
                  outerRadius="100%"
                  data={chartData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    dataKey="value"
                    background={{ fill: '#f3f4f6' }}
                    cornerRadius={4}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600">Promoters (9-10)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">{stats.promoters}</span>
                  <span className="text-sm text-gray-500 ml-1">
                    ({((stats.promoters / stats.responseCount) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-gray-600">Passives (7-8)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">{stats.passives}</span>
                  <span className="text-sm text-gray-500 ml-1">
                    ({((stats.passives / stats.responseCount) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-600">Detractors (0-6)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-900">{stats.detractors}</span>
                  <span className="text-sm text-gray-500 ml-1">
                    ({((stats.detractors / stats.responseCount) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Response Rate */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {stats.responseCount} total responses
            </span>
            <span className="text-sm font-medium text-gray-700">
              {stats.responseRate}% response rate
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default NPSSurvey;
