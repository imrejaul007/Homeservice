import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, MessageCircle, Lightbulb, Zap, Calendar, Search, Bot } from 'lucide-react';
import { handleApiError } from '../../utils/toastUtils';
import authService from '../../services/AuthService';

interface AIChatResponse {
  success: boolean;
  data?: {
    response?: string;
    message?: string;
    conversationId?: string;
  };
  error?: string;
}

const AIAssistantPage: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Array<{id: string; role: 'user' | 'assistant'; content: string; timestamp: Date}>>([
    { id: '1', role: 'assistant', content: "Hi! I'm your NILIN AI assistant. How can I help you today?", timestamp: new Date() }
  ]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await authService.post<AIChatResponse>('/ai/chat', {
        message: content
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to get response');
      }

      // Support both 'response' (backend) and 'message' (frontend expectation) fields
      const aiResponseText = response.data?.response || response.data?.message || '';

      if (!aiResponseText) {
        throw new Error('Invalid response format from server');
      }

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: aiResponseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      handleApiError(error, 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    { icon: Calendar, text: 'Book a cleaning service', query: 'I need a cleaning service' },
    { icon: Search, text: 'Find massage near me', query: 'massage services nearby' },
    { icon: Lightbulb, text: 'Get home maintenance tips', query: 'home maintenance tips' },
    { icon: Zap, text: 'Best time to book?', query: 'when is the best time to book a service' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-6">
        <div className="flex items-center gap-4 mb-2">
          <Link to="/customer/profile" className="p-2 -ml-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            NILIN AI Assistant
          </h1>
        </div>
        <p className="text-white/80 text-sm">Your personal home service advisor</p>
      </div>

      {/* Quick Actions */}
      <div className="p-4">
        <h2 className="font-semibold text-nilin-charcoal mb-3">Quick Help</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickQuestions.map((item, index) => (
            <button
              key={index}
              className="bg-white rounded-xl p-4 shadow-sm flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
              onClick={() => handleSendMessage(item.query)}
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-center">{item.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Chat Widget */}
      <div className="flex-1 px-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-nilin-charcoal">NILIN AI</p>
                <p className="text-xs text-gray-500">Powered by smart recommendations</p>
              </div>
            </div>
          </div>

          {/* Chat messages area */}
          <div className="h-64 p-4 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 mb-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-indigo-600" />
                  </div>
                )}
                <div className={`p-3 rounded-2xl max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-gray-100 rounded-tl-none'}`}>
                  <p className="text-sm">{msg.content}</p>
                  <span className={`text-xs ${msg.role === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                id="ai-chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(input);
                  }
                }}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-3 bg-gray-100 rounded-full outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:outline-none focus:border-indigo-400 transition-all"
                aria-label="Chat message input"
              />
              <button
                onClick={() => handleSendMessage(input)}
                className="w-12 h-12 bg-indigo-500 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <div className="px-4 mt-4">
        <p className="text-xs text-gray-500 text-center mb-2">Try asking:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {['Best cleaning service?', 'How to save on booking?', 'Recommend a spa'].map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(suggestion)}
              className="px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600 hover:bg-gray-200"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
