import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Sparkles, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  icon: string;
  query: string;
  slug: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Hair', icon: '💇', query: 'Hair styling at home', slug: 'hair', color: 'from-nilin-pink to-nilin-pink/70 hover:from-nilin-pink/80 hover:to-nilin-pink' },
  { label: 'Makeup', icon: '💄', query: 'Makeup artist at home', slug: 'makeup', color: 'from-rose-100 to-rose-200/70 hover:from-rose-200/80 hover:to-rose-200' },
  { label: 'Nails', icon: '💅', query: 'Nail services at home', slug: 'nails', color: 'from-nilin-lavender to-nilin-lavender/70 hover:from-nilin-lavender/80 hover:to-nilin-lavender' },
  { label: 'Massage', icon: '💆', query: 'Massage therapy at home', slug: 'massage-body', color: 'from-nilin-blue to-nilin-blue/70 hover:from-nilin-blue/80 hover:to-nilin-blue' },
];

const WELCOME_MESSAGE = `Hi! I'm NILIN AI. How can I help you find the perfect service today?`;

interface AIChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIChatWidget: React.FC<AIChatWidgetProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Simulate AI typing
    setIsTyping(true);

    // Simulate AI response after delay
    setTimeout(() => {
      const aiResponse = generateAIResponse(content);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();

    if (input.includes('hair') || input.includes('haircut') || input.includes('color') || input.includes('blowout')) {
      return "We have amazing hair stylists! From cuts and coloring to blowouts and bridal hair — all at your doorstep. Let me show you our top-rated hair professionals!";
    }
    if (input.includes('makeup') || input.includes('bridal') || input.includes('glam')) {
      return "Our certified makeup artists can come to you! Whether it's bridal, party, or everyday makeup. Want me to show you available artists?";
    }
    if (input.includes('nail') || input.includes('manicure') || input.includes('pedicure') || input.includes('gel')) {
      return "From manicures and pedicures to gel nails and nail art — our nail technicians come to your home. Let me find the best options for you!";
    }
    if (input.includes('facial') || input.includes('skin') || input.includes('peel') || input.includes('acne')) {
      return "We have expert estheticians for facials, chemical peels, anti-aging treatments and more. Would you like to see available skin professionals?";
    }
    if (input.includes('massage') || input.includes('spa') || input.includes('relax') || input.includes('body')) {
      return "Treat yourself to a professional massage at home! We offer Swedish, deep tissue, hot stone, and aromatherapy. What sounds good?";
    }
    if (input.includes('wax') || input.includes('thread') || input.includes('lash') || input.includes('brow') || input.includes('henna')) {
      return "Our personal care experts offer threading, waxing, lash extensions, brow shaping, and henna art. What would you like to book?";
    }

    return "I can help you find the perfect beauty service! Browse our categories: Hair, Makeup, Nails, Skin & Aesthetics, Massage & Body, or Personal Care. What are you looking for?";
  };

  const handleQuickAction = (action: QuickAction) => {
    handleSendMessage(action.query);
    // Navigate after a short delay
    setTimeout(() => {
      navigate(`/category/${action.slug}`);
      onClose();
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
      />

      {/* Chat Widget */}
      <div className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm md:max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[80vh] md:max-h-[600px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-nilin-primary via-nilin-secondary to-nilin-accent p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">NILIN AI</h3>
                <p className="text-xs text-white/80">Always here to help</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] bg-gradient-to-b from-gray-50 to-white">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.type === 'user'
                      ? 'bg-gradient-to-r from-nilin-primary to-nilin-secondary text-white rounded-br-md shadow-lg shadow-nilin-primary/20'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-md border border-gray-100'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-md border border-gray-100">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-nilin-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-nilin-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-nilin-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions (show only for first message) */}
            {messages.length === 1 && !isTyping && (
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-3 font-medium">Quick options:</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.slug}
                      onClick={() => handleQuickAction(action)}
                      className={`flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r ${action.color} rounded-xl transition-all text-left shadow-sm hover:shadow-md`}
                    >
                      <span className="text-xl">{action.icon}</span>
                      <span className="text-sm font-medium text-gray-700">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 bg-white">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nilin-primary/30 focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="p-3 bg-gradient-to-r from-nilin-primary to-nilin-secondary text-white rounded-xl hover:shadow-lg hover:shadow-nilin-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

// Floating Chat Button Component
export const ChatToggleButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="fixed bottom-4 right-4 z-40 w-14 h-14 bg-gradient-to-r from-nilin-primary via-nilin-secondary to-nilin-accent rounded-2xl shadow-lg hover:shadow-xl hover:shadow-nilin-primary/30 transition-all hover:scale-105 flex items-center justify-center group"
    aria-label="Open AI Chat"
  >
    <MessageCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
    <span className="absolute -top-1 -right-1 w-4 h-4 bg-nilin-success rounded-full border-2 border-white animate-pulse" />
  </button>
);

export default AIChatWidget;
