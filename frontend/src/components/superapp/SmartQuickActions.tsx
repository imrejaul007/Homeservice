// Smart Quick Actions - Context-aware shortcuts
import { motion } from 'framer-motion';
import { Wrench, Zap, Droplets, Sparkles, Clock, MapPin, Calendar, Repeat } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  action: string;
  context?: 'time' | 'location' | 'history';
}

interface SmartQuickActionsProps {
  onAction: (action: QuickAction) => void;
  timeContext?: 'morning' | 'afternoon' | 'evening' | 'night';
  recentServices?: string[];
  location?: string;
}

// Base quick actions
const BASE_ACTIONS: QuickAction[] = [
  { id: 'plumbing', label: 'Plumber', icon: <Droplets size={20} />, color: 'bg-blue-100 text-blue-600', action: 'service:plumbing' },
  { id: 'electrical', label: 'Electrician', icon: <Zap size={20} />, color: 'bg-yellow-100 text-yellow-600', action: 'service:electrical' },
  { id: 'cleaning', label: 'Cleaning', icon: <Sparkles size={20} />, color: 'bg-green-100 text-green-600', action: 'service:cleaning' },
  { id: 'repair', label: 'Repair', icon: <Wrench size={20} />, color: 'bg-orange-100 text-orange-600', action: 'service:repair' },
  { id: 'scheduled', label: 'Scheduled', icon: <Calendar size={20} />, color: 'bg-purple-100 text-purple-600', action: 'bookings:scheduled' },
  { id: 'nearby', label: 'Nearby', icon: <MapPin size={20} />, color: 'bg-red-100 text-red-600', action: 'search:nearby' },
  { id: 'history', label: 'History', icon: <Clock size={20} />, color: 'bg-gray-100 text-gray-600', action: 'bookings:history' },
  { id: 'repeat', label: 'Reorder', icon: <Repeat size={20} />, color: 'bg-pink-100 text-pink-600', action: 'service:repeat' },
];

// Contextual suggestions
const CONTEXTUAL_ACTIONS: Record<string, QuickAction[]> = {
  morning: [
    { id: 'plumbing', label: 'Plumber', icon: <Droplets size={20} />, color: 'bg-blue-100 text-blue-600', action: 'service:plumbing', context: 'time' },
    { id: 'electrical', label: 'Electrician', icon: <Zap size={20} />, color: 'bg-yellow-100 text-yellow-600', action: 'service:electrical', context: 'time' },
  ],
  afternoon: [
    { id: 'cleaning', label: 'Cleaning', icon: <Sparkles size={20} />, color: 'bg-green-100 text-green-600', action: 'service:cleaning', context: 'time' },
    { id: 'repair', label: 'Repair', icon: <Wrench size={20} />, color: 'bg-orange-100 text-orange-600', action: 'service:repair', context: 'time' },
  ],
  evening: [
    { id: 'scheduled', label: 'Scheduled', icon: <Calendar size={20} />, color: 'bg-purple-100 text-purple-600', action: 'bookings:scheduled', context: 'time' },
    { id: 'nearby', label: 'Nearby', icon: <MapPin size={20} />, color: 'bg-red-100 text-red-600', action: 'search:nearby', context: 'time' },
  ],
};

export function SmartQuickActions({ onAction, timeContext = 'afternoon', recentServices = [] }: SmartQuickActionsProps) {
  // Get contextual actions based on time
  const contextualActions = CONTEXTUAL_ACTIONS[timeContext] || [];

  // Prioritize recent services
  const recentActionIds = recentServices.slice(0, 2).map(service => {
    if (service.includes('plumb')) return 'plumbing';
    if (service.includes('electr')) return 'electrical';
    if (service.includes('clean')) return 'cleaning';
    if (service.includes('repair')) return 'repair';
    return null;
  }).filter(Boolean);

  // Build final actions list
  const finalActions = [
    // Recent services first
    ...recentActionIds.map(id => BASE_ACTIONS.find(a => a.id === id)!).filter(Boolean).slice(0, 2),
    // Contextual actions
    ...contextualActions.slice(0, 2),
    // Fill with base actions
    ...BASE_ACTIONS.slice(0, 4),
  ].slice(0, 8);

  return (
    <div className="grid grid-cols-4 gap-3">
      {finalActions.map((action, index) => (
        <motion.button
          key={action.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onAction(action)}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-aaa-subtle hover:shadow-aaa-card transition-shadow"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color}`}>
            {action.icon}
          </div>
          <span className="text-xs font-medium text-nilin-charcoal text-center">
            {action.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

export default SmartQuickActions;
