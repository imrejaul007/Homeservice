// Customer Effort Score Survey - Customer Analytics Component
import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ThumbsUp, ThumbsDown, Loader, Send, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CESSurveyProps {
  customerId?: string;
  onSubmit?: (score: number, feedback?: string) => void;
  autoShow?: boolean;
}

interface CESData {
  date: string;
  score: number;
  responses: number;
}

interface CESStats {
  currentScore: number;
  benchmark: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  totalResponses: number;
  veryEasy: number;
  easy: number;
  neutral: number;
  difficult: number;
  veryDifficult: number;
  responseRate: number;
}

const MOCK_TREND_DATA: CESData[] = [
  { date: 'Jan', score: 5.2, responses: 45 },
  { date: 'Feb', score: 5.4, responses: 52 },
  { date: 'Mar', score: 5.3, responses: 48 },
  { date: 'Apr', score: 5.6, responses: 61 },
  { date: 'May', score: 5.8, responses: 58 },
  { date: 'Jun', score: 6.0, responses: 72 },
];

const MOCK_STATS: CESStats = {
  currentScore: 6.0,
  benchmark: 5.5,
  change: 0.4,
  changePercent: 7.1,
  trend: 'up',
  totalResponses: 336,
  veryEasy: 156,
  easy: 112,
  neutral: 48,
  difficult: 14,
  veryDifficult: 6,
  responseRate: 72,
};

const SCORE_LABELS: Record<number, { label: string; color: string; bgColor: string }> = {
  1: { label: 'Very Difficult', color: '#EF4444', bgColor: 'bg-red-100' },
  2: { label: 'Difficult', color: '#F97316', bgColor: 'bg-orange-100' },
  3: { label: 'Somewhat Difficult', color: '#F59E0B', bgColor: 'bg-amber-100' },
  4: { label: 'Neutral', color: '#6B7280', bgColor: 'bg-gray-100' },
  5: { label: 'Somewhat Easy', color: '#84CC16', bgColor: 'bg-lime-100' },
  6: { label: 'Easy', color: '#10B981', bgColor: 'bg-green-100' },
  7: { label: 'Very Easy', color: '#059669', bgColor: 'bg-emerald-100' },
};

export const CESSurvey: React.FC<CESSurveyProps> = ({
  customerId,
  onSubmit,
  autoShow = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<CESData[]>(MOCK_TREND_DATA);
  const [stats, setStats] = useState<CESStats>(MOCK_STATS);
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
    const newResponses = stats.totalResponses + 1;
    let newVeryEasy = stats.veryEasy;
    let newEasy = stats.easy;
    let newNeutral = stats.neutral;
    let newDifficult = stats.difficult;
    let newVeryDifficult = stats.veryDifficult;

    if (currentScore === 7) newVeryEasy++;
    else if (currentScore === 6) newEasy++;
    else if (currentScore === 4) newNeutral++;
    else if (currentScore === 2) newDifficult++;
    else if (currentScore === 1) newVeryDifficult++;

    // Recalculate score
    const newTotal = newVeryEasy * 7 + newEasy * 6 + newNeutral * 4 + newDifficult * 2 + newVeryDifficult * 1;
    const newScore = newTotal / newResponses;

    setStats({
      ...stats,
      currentScore: newScore,
      totalResponses: newResponses,
      veryEasy: newVeryEasy,
      easy: newEasy,
      neutral: newNeutral,
      difficult: newDifficult,
      veryDifficult: newVeryDifficult,
    });
  };

  const renderScoreButton = (score: number) => {
    const isSelected = currentScore === score;
    const config = SCORE_LABELS[score];

    return (
      <motion.button
        key={score}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleScoreSelect(score)}
        className={`
          w-12 h-12 rounded-lg font-semibold text-sm transition-all flex flex-col items-center justify-center
          ${isSelected
            ? `${config.bgColor} ${config.color} shadow-lg ring-2 ring-offset-2`
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }
        `}
      >
        <span className="font-bold">{score}</span>
        <span className="text-[8px]">{config.label.split(' ')[0]}</span>
      </motion.button>
    );
  };

  const getSelectedConfig = () => {
    if (currentScore === null) return null;
    return SCORE_LABELS[currentScore];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-purple-600">
              CES Score: <span className="font-medium">{payload[0]?.value?.toFixed(1) || 0}</span>
            </p>
            <p className="text-gray-600">
              Responses: <span className="font-medium">{payload[1]?.value || 0}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const distributionData = [
    { label: 'Very Easy', count: stats.veryEasy, color: '#059669' },
    { label: 'Easy', count: stats.easy, color: '#10B981' },
    { label: 'Neutral', count: stats.neutral, color: '#6B7280' },
    { label: 'Difficult', count: stats.difficult, color: '#F97316' },
    { label: 'Very Difficult', count: stats.veryDifficult, color: '#EF4444' },
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
            <Clock className="h-5 w-5 text-purple-600" />
            Customer Effort Score
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            How easy was it to complete your task?
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              stats.currentScore >= stats.benchmark
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {stats.currentScore.toFixed(1)} / 7.0
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
            className="text-center py-6"
          >
            <button
              onClick={() => setShowSurvey(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Rate Your Experience
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
              Your feedback helps us identify friction points.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="survey"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Score Scale */}
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-3 text-center">
                Very Difficult (1) - Very Easy (7)
              </p>
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7].map(renderScoreButton)}
              </div>
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
                  <div
                    className={`flex items-center justify-center gap-2 mb-4 px-4 py-3 rounded-lg ${getSelectedConfig()?.bgColor}`}
                    style={{ color: getSelectedConfig()?.color }}
                  >
                    {currentScore >= 5 ? (
                      <ThumbsUp className="h-5 w-5" />
                    ) : (
                      <ThumbsDown className="h-5 w-5" />
                    )}
                    <span className="font-medium">{getSelectedConfig()?.label}</span>
                  </div>

                  {/* Feedback Textarea */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What could we do to make it easier? (optional)
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Share your suggestions..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Submit
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

      {/* Score Trend Chart */}
      {stats.totalResponses > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-4">CES Trend</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  domain={[0, 7]}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={stats.benchmark}
                  stroke="#6B7280"
                  strokeDasharray="5 5"
                  label={{ value: `Benchmark: ${stats.benchmark}`, fill: '#6B7280', fontSize: 10 }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fill="url(#cesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution */}
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Score Distribution</h4>
            <div className="space-y-2">
              {distributionData.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28">{item.label}</span>
                  <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(item.count / stats.totalResponses) * 100}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-16 text-right">
                    {item.count} ({((item.count / stats.totalResponses) * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Response Rate */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {stats.totalResponses} total responses
            </span>
            <span className="text-sm font-medium text-gray-700">
              {stats.responseRate}% response rate
            </span>
          </div>
        </div>
      )}

      {/* Benchmark Comparison */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Your Score</p>
            <p className={`text-2xl font-bold ${
              stats.currentScore >= stats.benchmark ? 'text-green-600' : 'text-red-600'
            }`}>
              {stats.currentScore.toFixed(1)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Industry Benchmark</p>
            <p className="text-2xl font-bold text-gray-900">{stats.benchmark.toFixed(1)}</p>
          </div>
        </div>
        <div className="mt-4 text-center text-sm">
          <span className={`font-medium ${
            stats.currentScore >= stats.benchmark ? 'text-green-600' : 'text-red-600'
          }`}>
            {stats.currentScore >= stats.benchmark
              ? 'Above benchmark - Great job reducing friction!'
              : 'Below benchmark - Focus on reducing effort'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default CESSurvey;
