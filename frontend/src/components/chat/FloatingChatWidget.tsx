import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Loader2 } from 'lucide-react';
import { chatAnalytics } from '../../services/analyticsService';

// Lazy load the AutoChatbot component
const AutoChatbot = lazy(() => import('../support/AutoChatbot'));

// Routes where the floating widget should be hidden (moved outside component)
const HIDDEN_ROUTES = [
  '/customer/messages',
  '/customer/messages/new',
  '/customer/support',
  '/provider/messages',
  '/admin/chatbot-builder',
];

// Skeleton fallback for the chat widget
const ChatWidgetSkeleton: React.FC = () => (
  <div
    className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-[#E8B4A8] to-[#D4948A] shadow-xl animate-pulse-smooth"
    style={{
      animation: 'fadeInScale 0.3s ease-out forwards',
    }}
  />
);

// CSS animation for smooth appearance
const styleSheet = `
  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes pulse-smooth {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
  .animate-pulse-smooth {
    animation: pulse-smooth 2s ease-in-out infinite;
  }
`;

// Inject styles once
if (typeof document !== 'undefined' && !document.getElementById('chat-widget-styles')) {
  const style = document.createElement('style');
  style.id = 'chat-widget-styles';
  style.textContent = styleSheet;
  document.head.appendChild(style);
}

interface FloatingChatWidgetProps {
  /** Custom bot name */
  botName?: string;
  /** Custom welcome message */
  welcomeMessage?: string;
  /** Position of the widget */
  position?: 'bottom-right' | 'bottom-left';
}

const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  botName = 'NILIN Assistant',
  welcomeMessage = 'Hi there! How can I help you today?',
  position = 'bottom-right',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleOpenChat = () => {
      chatAnalytics.trackWidgetOpened();
      setIsOpen(true);
    };
    window.addEventListener('nilin:open-chat', handleOpenChat);
    return () => window.removeEventListener('nilin:open-chat', handleOpenChat);
  }, []);

  // Check if current route should hide the widget
  const shouldHideOnRoute = HIDDEN_ROUTES.some(route =>
    location.pathname.startsWith(route)
  );

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) chatAnalytics.trackWidgetOpened();
      else chatAnalytics.trackWidgetClosed();
      return !prev;
    });
  }, []);

  const handleClose = useCallback(() => {
    chatAnalytics.trackWidgetClosed();
    setIsOpen(false);
  }, []);

  // Show widget immediately (removed artificial 2-second delay)
  useEffect(() => {
    setIsReady(true);
  }, []);

  // Close widget when navigating to chat pages
  useEffect(() => {
    if (shouldHideOnRoute) {
      setIsOpen(false);
    }
  }, [location.pathname, shouldHideOnRoute]);

  const handleStartConversation = () => {
    setIsOpen(false);
    // Navigate to new message page
    navigate('/customer/messages/new');
  };

  const handleHumanTransfer = () => {
    // Close chatbot and navigate to message creation
    setIsOpen(false);
    navigate('/customer/messages/new');
  };

  // Don't render if on hidden route or not authenticated or not ready yet
  if (shouldHideOnRoute || !isAuthenticated || !isReady) {
    return null;
  }

  return (
    <Suspense fallback={<ChatWidgetSkeleton />}>
      <AutoChatbot
        isOpen={isOpen}
        onToggle={handleToggle}
        onClose={handleClose}
        welcomeMessage={welcomeMessage}
        onHumanTransfer={handleHumanTransfer}
        position={position}
      />
    </Suspense>
  );
};

export default FloatingChatWidget;