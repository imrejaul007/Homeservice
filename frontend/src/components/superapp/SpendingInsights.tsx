// Spending Insights - Financial analytics and tips
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Lightbulb, PiggyBank, CreditCard } from 'lucide-react';
import { useRewards } from '../../services/superapp/RewardsEngine';

interface SpendingInsightsProps {
  transactions?: any[];
}

export function SpendingInsights({ transactions = [] }: SpendingInsightsProps) {
  const { cashbackBalance, points, tierInfo } = useRewards();

  // Calculate totals
  const totalSpent = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const thisMonth = transactions
    .filter(t => new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const lastMonth = transactions
    .filter(t => {
      const d = new Date(t.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() - 1 || (now.getMonth() === 0 && d.getMonth() === 11);
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const monthChange = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  transactions.forEach(t => {
    const cat = t.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (t.amount || 0);
  });

  const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Services';
  const topCategoryAmount = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0]?.[1] || 0;

  // Smart tips
  const tips = [
    {
      icon: <PiggyBank size={20} />,
      title: 'Bundle & Save',
      description: 'Book multiple services together for 10% off',
    },
    {
      icon: <TrendingUp size={20} />,
      title: 'Best Time to Book',
      description: 'Weekday mornings have better availability',
    },
    {
      icon: <CreditCard size={20} />,
      title: 'Cashback Active',
      description: `You're earning ${tierInfo.cashbackBonus * 100}% extra cashback`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#2D2D2D] to-[#1a1a1a] rounded-2xl p-4 text-white"
        >
          <p className="text-sm text-white/60 mb-1">Total Spent</p>
          <p className="text-2xl font-bold">₹{totalSpent.toLocaleString()}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 shadow-aaa-card"
        >
          <p className="text-sm text-nilin-warmGray mb-1">This Month</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-nilin-charcoal">₹{thisMonth.toLocaleString()}</p>
            <span className={`flex items-center gap-1 text-xs font-medium ${monthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(monthChange).toFixed(0)}%
            </span>
          </div>
        </motion.div>
      </div>

      {/* Category Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-4 shadow-aaa-card"
      >
        <h3 className="font-semibold text-nilin-charcoal mb-4">Spending by Category</h3>

        <div className="space-y-3">
          {Object.entries(categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([category, amount], index) => (
              <div key={category} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-nilin-charcoal">{category}</span>
                    <span className="text-sm text-nilin-warmGray">₹{amount.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(amount / topCategoryAmount) * 100}%` }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-full"
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </motion.div>

      {/* Smart Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100"
      >
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-green-800">Smart Tips</h3>
        </div>

        <div className="space-y-3">
          {tips.map((tip, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-green-600 shadow-sm">
                {tip.icon}
              </div>
              <div>
                <p className="font-medium text-green-800 text-sm">{tip.title}</p>
                <p className="text-xs text-green-600/80">{tip.description}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Rewards Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-br from-nilin-coral/10 to-nilin-blush/50 rounded-2xl p-4"
      >
        <h3 className="font-semibold text-nilin-charcoal mb-3">Your Rewards</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-nilin-coral">₹{cashbackBalance}</p>
            <p className="text-xs text-nilin-warmGray">Cashback</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-500">{points}</p>
            <p className="text-xs text-nilin-warmGray">Points</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default SpendingInsights;
