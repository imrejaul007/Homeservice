import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import { ChatWindow } from '../../components/chat';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';

// =============================================================================
// Customer Messages Page
// =============================================================================

export default function MessagesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  // Handlers
  const handleClose = useCallback(() => {
    navigate('/customer/dashboard');
  }, [navigate]);

  const handleMinimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const handleExpand = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const handleSelectRoom = useCallback((room: any) => {
    setSelectedRoom(room);
    setIsMinimized(false);
  }, []);

  const handleBackToRooms = useCallback(() => {
    setSelectedRoom(null);
  }, []);

  const handleNewMessage = useCallback((message: any) => {
    console.log('New message:', message);
  }, []);

  const handleUnreadChange = useCallback((count: number) => {
    // Could update a badge or title here
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

      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/customer/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        </div>

        {/* Chat Window */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <ChatWindow
            userId={user._id || user.id || ''}
            userName={user.firstName || user.name || 'Customer'}
            userAvatar={user.avatar}
            initialSelectedRoom={selectedRoom}
            isMinimized={isMinimized}
            onClose={handleClose}
            onMinimize={handleMinimize}
            onExpand={handleExpand}
            onSelectRoom={handleSelectRoom}
            onBackToRooms={handleBackToRooms}
            onNewMessage={handleNewMessage}
            onUnreadChange={handleUnreadChange}
            className="h-[600px] md:h-[700px]"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
