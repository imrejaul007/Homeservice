import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Search, User, MessageCircle } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../stores/authStore';
import { chatApi } from '../../services/chatApi';
import { showDeduplicatedError } from '../../utils/toastUtils';
import toast from 'react-hot-toast';

interface Provider {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  serviceName?: string;
}

const NewMessagePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();

  // Get providerId from query params
  const providerId = searchParams.get('providerId');
  const providerName = searchParams.get('providerName');

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [existingRoomId, setExistingRoomId] = useState<string | null>(null);

  // Check if conversation already exists
  useEffect(() => {
    if (providerId) {
      checkExistingConversation();
    }
  }, [providerId]);

  const checkExistingConversation = async () => {
    if (!providerId) return;

    try {
      const response = await chatApi.getChatRooms();
      const rooms = response.rooms || [];
      const existingRoom = rooms.find((room: any) => {
        const participants = room.participants || room.participantsWithDetails || [];
        return participants.some((p: any) => {
          const pId = typeof p.userId === 'object' ? p.userId._id : p.userId;
          return pId === providerId;
        });
      });

      if (existingRoom) {
        setExistingRoomId(existingRoom._id);
      }
    } catch (error) {
      showDeduplicatedError('Failed to check conversation');
    }
  };

  const handleStartConversation = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!providerId) {
      toast.error('Provider not found');
      return;
    }

    setSending(true);

    try {
      // Use existing room or create new one
      let roomId = existingRoomId;

      if (!roomId) {
        // Create a direct chat room with the provider
        const { chatRoom } = await chatApi.getOrCreateDirectChat({
          participantId: providerId
        });
        roomId = chatRoom._id;
      }

      // Now send the message to the created/found room
      await chatApi.sendMessage(roomId, {
        receiverId: providerId,
        content: message,
        type: 'text'
      });

      toast.success('Message sent successfully!');
      navigate('/customer/messages', { state: { roomId } });
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      showDeduplicatedError('Failed to send message', axiosErr.response?.data?.message || 'Please try again');
    } finally {
      setSending(false);
    }
  };

  const handleGoToConversation = () => {
    if (existingRoomId) {
      navigate('/customer/messages', { state: { roomId: existingRoomId } });
    } else {
      navigate('/customer/messages');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Sign in required</h2>
          <p className="text-gray-500 mb-4">Please sign in to contact the provider</p>
          <Button onClick={() => navigate('/login', { state: { returnTo: `/customer/messages/new?providerId=${providerId}&providerName=${providerName}` } })}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavigationHeader />

      <div className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Message</h1>
            {providerName && (
              <p className="text-sm text-gray-500">To: {decodeURIComponent(providerName)}</p>
            )}
          </div>
        </div>

        {/* Provider Info Card */}
        {providerId && (
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-nilin-coral/20 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-nilin-coral" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {providerName ? decodeURIComponent(providerName) : 'Service Provider'}
                </p>
                <p className="text-sm text-gray-500">
                  {existingRoomId ? 'Continue existing conversation' : 'Start new conversation'}
                </p>
              </div>
              {existingRoomId && (
                <button
                  onClick={handleGoToConversation}
                  className="text-nilin-coral text-sm font-medium hover:underline"
                >
                  View Conversation
                </button>
              )}
            </div>
          </div>
        )}

        {/* Message Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi! I'm interested in your services..."
              rows={5}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral resize-none"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate(-1)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartConversation}
              loading={sending}
              disabled={!message.trim() || !providerId}
              className="flex-1"
            >
              Send Message
            </Button>
          </div>
        </div>

        {/* Quick Messages */}
        <div className="mt-6">
          <p className="text-sm text-gray-500 mb-3">Quick Messages</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Hi! I'm interested in your services.",
              'Can you share more details about this package?',
              'I would like to book this service.',
              'What availability do you have this week?',
            ].map((quickMessage, idx) => (
              <button
                key={idx}
                onClick={() => setMessage(quickMessage)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
              >
                {quickMessage}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default NewMessagePage;