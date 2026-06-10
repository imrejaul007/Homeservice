// SuperApp Home - Ecosystem dashboard with dynamic modules
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SmartQuickActions } from './SmartQuickActions';
import { SmartDiscovery } from '../marketplace/SmartDiscovery';
import { WalletBalance } from '../marketplace/WalletBalance';
import { MilestoneProgress } from '../marketplace/MilestoneProgress';
import { useHabits } from '../../services/superapp/HabitEngine';
import { useBookingSuggestions } from '../../services/superapp/PredictiveEngine';
import { Bell, User, Wallet } from 'lucide-react';

interface SuperAppHomeProps {
  userId: string;
  services: any[];
  onNavigate: (screen: string) => void;
}

export function SuperAppHome({ userId, services, onNavigate }: SuperAppHomeProps) {
  const [greeting, setGreeting] = useState('');
  const [timeContext, setTimeContext] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('afternoon');
  const { currentStreak, status } = useHabits();

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours();
    let context: typeof timeContext = 'afternoon';
    let greet = 'Good afternoon';

    if (hour >= 5 && hour < 12) {
      context = 'morning';
      greet = 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      context = 'afternoon';
      greet = 'Good afternoon';
    } else if (hour >= 17 && hour < 21) {
      context = 'evening';
      greet = 'Good evening';
    } else {
      context = 'night';
      greet = 'Good night';
    }

    setTimeContext(context);
    setGreeting(greet);
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFBF9] pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-nilin-warmGray"
            >
              {greeting}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl font-bold text-nilin-charcoal"
            >
              Welcome back!
            </motion.h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Streak indicator */}
            {currentStreak > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 rounded-full"
              >
                <span className="text-lg">🔥</span>
                <span className="text-sm font-bold text-orange-600">{currentStreak}</span>
              </motion.div>
            )}

            {/* Notifications */}
            <button
              onClick={() => onNavigate('notifications')}
              className="w-10 h-10 rounded-full bg-white shadow-aaa-subtle flex items-center justify-center relative"
            >
              <Bell className="w-5 h-5 text-nilin-charcoal" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                3
              </span>
            </button>

            {/* Profile */}
            <button
              onClick={() => onNavigate('profile')}
              className="w-10 h-10 rounded-full bg-nilin-coral flex items-center justify-center"
            >
              <User className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="px-4 space-y-6">
        {/* Quick Actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SmartQuickActions
            onAction={(action) => onNavigate(action.action)}
            timeContext={timeContext}
          />
        </motion.section>

        {/* Wallet Card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <WalletBalance compact walletContext="customer" />
        </motion.section>

        {/* Smart Discovery / Recommendations */}
        {services.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <SmartDiscovery
              services={services}
              onServiceClick={(service) => onNavigate(`service:${service.id}`)}
              title="Recommended for you"
            />
          </motion.section>
        )}

        {/* Progress / Milestones */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <MilestoneProgress stats={{ bookings: 5, referrals: 1, reviews: 2 }} />
        </motion.section>

        {/* Engagement Widget */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-nilin-coral/10 to-nilin-blush/50 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-nilin-charcoal">Your Progress</h3>
            <span className="text-sm text-nilin-warmGray">Keep it up!</span>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 bg-white rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-nilin-coral">12</div>
              <div className="text-xs text-nilin-warmGray">Bookings</div>
            </div>
            <div className="flex-1 bg-white rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-600">₹850</div>
              <div className="text-xs text-nilin-warmGray">Saved</div>
            </div>
            <div className="flex-1 bg-white rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-yellow-500">5.0★</div>
              <div className="text-xs text-nilin-warmGray">Rating</div>
            </div>
          </div>
        </motion.section>

        {/* Quick Bookings */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-nilin-charcoal">Active Bookings</h3>
            <button
              onClick={() => onNavigate('bookings')}
              className="text-sm text-nilin-coral font-medium"
            >
              View all
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-aaa-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <span className="text-2xl">🧹</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-nilin-charcoal">Home Cleaning</h4>
                <p className="text-sm text-nilin-warmGray">Tomorrow, 10:00 AM</p>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                Confirmed
              </span>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

export default SuperAppHome;
