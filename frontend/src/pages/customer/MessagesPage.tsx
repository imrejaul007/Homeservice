import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import { ChatWindow } from '../../components/chat';
import { useAuthStore } from '../../stores/authStore';
import { chatApi, ChatRoom } from '../../services/chatApi';
import { toast } from 'react-hot-toast';

// =============================================================================
// Messages Page (customer + provider)
// =============================================================================

interface MessagesLocationState {
  providerId?: string;
  customerId?: string;
  bookingId?: string;
  roomId?: string;
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const deepLinkHandled = useRef(false);

  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const userId = user?._id || user?.id || '';
  const isProvider = user?.role === 'provider';
  const dashboardPath = isProvider ? '/provider/dashboard' : '/customer/dashboard';

  // Deep-link: open provider or booking chat from navigation state
  useEffect(() => {
    const state = location.state as MessagesLocationState | null;
    if (!state?.providerId && !state?.bookingId && !state?.customerId && !state?.roomId) return;
    if (!userId || deepLinkHandled.current) return;

    deepLinkHandled.current = true;
    setIsOpeningChat(true);

    const openChat = async () => {
      try {
        let chatRoom: ChatRoom | undefined;

        if (state.roomId) {
          const result = await chatApi.getChatRoom(state.roomId);
          chatRoom = result.chatRoom;
        } else if (state.bookingId) {
          const customerId = isProvider
            ? state.customerId
            : userId;
          const providerId = isProvider
            ? userId
            : state.providerId;

          if (!customerId || !providerId) {
            throw new Error('Missing booking chat participants');
          }

          const result = await chatApi.getOrCreateBookingChat({
            bookingId: state.bookingId,
            customerId,
            providerId,
          });
          chatRoom = result.chatRoom;
        } else if (state.providerId || state.customerId) {
          const result = await chatApi.getOrCreateDirectChat({
            participantId: (isProvider ? state.customerId : state.providerId) || state.providerId || state.customerId || '',
          });
          chatRoom = result.chatRoom;
        }

        if (chatRoom) {
          setSelectedRoom(chatRoom);
          setIsMinimized(false);
        }
      } catch (error) {
        console.error('Failed to open chat from deep link:', error);
        toast.error('Could not open conversation. Try again from Messages.');
      } finally {
        setIsOpeningChat(false);
        navigate(location.pathname, { replace: true, state: null });
      }
    };

    openChat();
  }, [location.state, location.pathname, navigate, userId, isProvider]);

  const handleClose = useCallback(() => {
    navigate(dashboardPath);
  }, [navigate, dashboardPath]);

  const handleMinimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const handleExpand = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const handleSelectRoom = useCallback((room: ChatRoom | null) => {
    setSelectedRoom(room);
    setIsMinimized(false);
  }, []);

  const handleBackToRooms = useCallback(() => {
    setSelectedRoom(null);
  }, []);

  const handleNewMessage = useCallback(() => {
    // Reserved for future sound/badge updates
  }, []);

  const handleUnreadChange = useCallback((count: number) => {
    document.title = count > 0 ? `(${count}) Messages - NILIN` : 'Messages - NILIN';
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <NavigationHeader />

      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl flex flex-col min-h-0">
        <div className="flex items-center gap-4 mb-6 shrink-0">
          <button
            onClick={() => navigate(dashboardPath)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative flex flex-col">
          {isOpeningChat && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral" />
                <p className="text-sm text-gray-600">Opening conversation...</p>
              </div>
            </div>
          )}
          <ChatWindow
            userId={userId}
            userName={user.firstName || user.name || (isProvider ? 'Provider' : 'Customer')}
            userAvatar={user.avatar}
            initialSelectedRoom={selectedRoom}
            isMinimized={isMinimized}
            layout="page"
            onClose={handleClose}
            onMinimize={handleMinimize}
            onExpand={handleExpand}
            onSelectRoom={handleSelectRoom}
            onBackToRooms={handleBackToRooms}
            onNewMessage={handleNewMessage}
            onUnreadChange={handleUnreadChange}
            className="flex-1 min-h-[min(700px,70vh)] h-full"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
