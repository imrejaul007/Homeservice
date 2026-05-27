import { motion } from 'framer-motion';
import { Search, Calendar, Inbox, MapPin, ShoppingBag, MessageSquare, Heart, Bell } from 'lucide-react';

type EmptyStateType = 'search' | 'calendar' | 'inbox' | 'location' | 'orders' | 'messages' | 'favorites' | 'notifications';

interface PremiumEmptyStateProps {
  type?: EmptyStateType;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

const icons: Record<EmptyStateType, React.ElementType> = {
  search: Search,
  calendar: Calendar,
  inbox: Inbox,
  location: MapPin,
  orders: ShoppingBag,
  messages: MessageSquare,
  favorites: Heart,
  notifications: Bell,
};

export function PremiumEmptyState({
  type = 'inbox',
  title,
  description,
  actionText,
  onAction,
}: PremiumEmptyStateProps) {
  const Icon = icons[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      {/* Animated icon container */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-nilin-blush to-nilin-peach flex items-center justify-center mb-6 shadow-premium-md"
      >
        <Icon size={36} className="text-nilin-coral" />
      </motion.div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-nilin-charcoal mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-nilin-warmGray mb-6 max-w-xs leading-relaxed">
        {description}
      </p>

      {/* Action button */}
      {actionText && onAction && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onAction}
          className="px-6 py-3 bg-nilin-coral text-white rounded-xl font-medium shadow-premium-sm"
        >
          {actionText}
        </motion.button>
      )}

      {/* Decorative dots */}
      <div className="flex gap-2 mt-8">
        <div className="w-2 h-2 rounded-full bg-nilin-blush" />
        <div className="w-2 h-2 rounded-full bg-nilin-coral/50" />
        <div className="w-2 h-2 rounded-full bg-nilin-blush/50" />
      </div>
    </motion.div>
  );
}

// Pre-built empty states for common scenarios
export const EmptyStates = {
  noBookings: (onAction?: () => void) => (
    <PremiumEmptyState
      type="calendar"
      title="No Bookings Yet"
      description="You haven't made any bookings yet. Start exploring our services and book your first appointment."
      actionText="Explore Services"
      onAction={onAction}
    />
  ),
  noSearchResults: (query: string, onAction?: () => void) => (
    <PremiumEmptyState
      type="search"
      title="No Results Found"
      description={`We couldn't find any services matching "${query}". Try a different search term.`}
      actionText="Clear Search"
      onAction={onAction}
    />
  ),
  noMessages: (onAction?: () => void) => (
    <PremiumEmptyState
      type="messages"
      title="No Messages"
      description="Your inbox is empty. Start a conversation with a service provider."
      actionText="Find Providers"
      onAction={onAction}
    />
  ),
  noFavorites: (onAction?: () => void) => (
    <PremiumEmptyState
      type="favorites"
      title="No Favorites Yet"
      description="Save your favorite services here for quick access later."
      actionText="Explore Services"
      onAction={onAction}
    />
  ),
  noNotifications: () => (
    <PremiumEmptyState
      type="notifications"
      title="All Caught Up!"
      description="You don't have any new notifications right now."
    />
  ),
  error: (onAction?: () => void) => (
    <PremiumEmptyState
      type="inbox"
      title="Something Went Wrong"
      description="We couldn't load this content. Please try again."
      actionText="Try Again"
      onAction={onAction}
    />
  ),
};

export default PremiumEmptyState;
