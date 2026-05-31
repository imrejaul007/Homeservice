import React, { useState } from 'react';
import {
  Search,
  Book,
  MessageCircle,
  Phone,
  Mail,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags?: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  articleCount: number;
}

// ============================================
// CONSTANT DATA
// ============================================

const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    description: 'Learn the basics of using our platform',
    articleCount: 8,
  },
  {
    id: 'booking',
    title: 'Booking & Scheduling',
    icon: '📅',
    description: 'Everything about booking services',
    articleCount: 15,
  },
  {
    id: 'payments',
    title: 'Payments & Billing',
    icon: '💳',
    description: 'Payment methods, invoices, and refunds',
    articleCount: 12,
  },
  {
    id: 'account',
    title: 'Account & Profile',
    icon: '👤',
    description: 'Manage your account settings',
    articleCount: 10,
  },
  {
    id: 'providers',
    title: 'For Service Providers',
    icon: '🛠️',
    description: 'Provider guides and tutorials',
    articleCount: 20,
  },
  {
    id: 'technical',
    title: 'Technical Support',
    icon: '⚙️',
    description: 'Troubleshoot technical issues',
    articleCount: 14,
  },
];

const POPULAR_ARTICLES: Array<{ title: string; url: string; views: number }> = [
  { title: 'How to book a service', url: '/help/booking', views: 15420 },
  { title: 'Cancel or reschedule booking', url: '/help/cancel', views: 12350 },
  { title: 'Payment methods accepted', url: '/help/payments', views: 8920 },
  { title: 'How refunds work', url: '/help/refunds', views: 7650 },
  { title: 'Account verification process', url: '/help/verification', views: 5430 },
];

const SAMPLE_FAQS: FAQ[] = [
  {
    id: '1',
    question: 'How do I book a service?',
    answer: 'Booking a service is easy! Simply browse our service categories, select the service you need, choose a provider, pick a date and time that works for you, and confirm your booking. You will receive a confirmation email and push notification with all the details.',
    category: 'booking',
    tags: ['booking', 'how-to', 'basics'],
  },
  {
    id: '2',
    question: 'Can I cancel or reschedule my booking?',
    answer: 'Yes, you can cancel or reschedule your booking up to 4 hours before the scheduled appointment time without any cancellation fees. For cancellations within 4 hours, a cancellation fee may apply. To modify your booking, go to My Bookings and select the booking you want to change.',
    category: 'booking',
    tags: ['cancel', 'reschedule', 'booking'],
  },
  {
    id: '3',
    question: 'What payment methods are accepted?',
    answer: 'We accept multiple payment methods including credit/debit cards (Visa, Mastercard, American Express), Apple Pay, Google Pay, and cash payment directly to the service provider. Some providers may offer additional payment options.',
    category: 'payments',
    tags: ['payment', 'methods', 'billing'],
  },
  {
    id: '4',
    question: 'How long does a refund take?',
    answer: 'Refunds are typically processed within 5-7 business days after the refund has been approved. The refund will be credited to your original payment method. For card payments, please allow up to 10 business days for the refund to appear on your statement.',
    category: 'payments',
    tags: ['refund', 'payment', 'timeline'],
  },
  {
    id: '5',
    question: 'How do I verify my account?',
    answer: 'Account verification is completed through email verification. After registering, you will receive a verification email at your registered email address. Click the verification link to activate your account. You can also verify your phone number through SMS verification for additional security.',
    category: 'account',
    tags: ['verification', 'email', 'account'],
  },
  {
    id: '6',
    question: 'What if my provider does not show up?',
    answer: 'If your service provider does not arrive within 15 minutes of the scheduled time, please contact our support team immediately. We will work to reschedule your appointment with another provider or issue a full refund if preferred. You can reach us through live chat, phone, or email.',
    category: 'booking',
    tags: ['no-show', 'provider', 'support'],
  },
];

// ============================================
// FAQ ITEM COMPONENT
// ============================================

const FAQItem: React.FC<{ faq: FAQ }> = ({ faq }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-nilin-charcoal pr-4">{faq.question}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="pb-4 text-gray-600 whitespace-pre-wrap">
          {faq.answer}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN HELP CENTER COMPONENT
// ============================================

export const HelpCenter: React.FC<{
  className?: string;
  onNavigateToContact?: () => void;
  onNavigateToTickets?: () => void;
  onNavigateToChat?: () => void;
}> = ({ className, onNavigateToContact, onNavigateToTickets, onNavigateToChat }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter FAQs based on search
  const filteredFAQs = searchQuery
    ? SAMPLE_FAQS.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : selectedCategory
    ? SAMPLE_FAQS.filter((faq) => faq.category === selectedCategory)
    : SAMPLE_FAQS;

  return (
    <div className={cn('bg-gray-50 min-h-screen', className)}>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-nilin-rose to-nilin-coral text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl md:text-3xl font-bold mb-2">How can we help you?</h1>
          <p className="text-white/80 mb-6">
            Search our knowledge base or browse categories below
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for answers..."
              className="w-full pl-12 pr-4 py-3 rounded-xl text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Search Results or Categories */}
        {searchQuery ? (
          <div>
            <h2 className="text-lg font-semibold text-nilin-charcoal mb-4">
              Search Results ({filteredFAQs.length})
            </h2>
            {filteredFAQs.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-200">
                {filteredFAQs.map((faq) => (
                  <FAQItem key={faq.id} faq={faq} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No results found for "{searchQuery}"</p>
                <p className="text-sm text-gray-400">
                  Try different keywords or browse categories below
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Help Categories */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-nilin-charcoal mb-4">Browse by Category</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {HELP_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      'bg-white rounded-xl p-4 text-left border transition-all hover:shadow-md hover:border-nilin-coral/30',
                      selectedCategory === category.id && 'border-nilin-coral ring-2 ring-nilin-coral/10'
                    )}
                  >
                    <span className="text-2xl mb-2 block">{category.icon}</span>
                    <h3 className="font-semibold text-nilin-charcoal mb-1">{category.title}</h3>
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">{category.description}</p>
                    <p className="text-xs text-gray-400">{category.articleCount} articles</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Category or Popular Articles */}
            {selectedCategory ? (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-nilin-charcoal">
                    {HELP_CATEGORIES.find((c) => c.id === selectedCategory)?.title}
                  </h2>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-sm text-nilin-coral hover:underline"
                  >
                    View all categories
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  {SAMPLE_FAQS.filter((f) => f.category === selectedCategory).length > 0 ? (
                    SAMPLE_FAQS.filter((f) => f.category === selectedCategory).map((faq) => (
                      <FAQItem key={faq.id} faq={faq} />
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No articles in this category yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-nilin-charcoal mb-4">Popular Articles</h2>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {POPULAR_ARTICLES.map((article, index) => (
                    <a
                      key={index}
                      href={article.url}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-nilin-blush/50 rounded-lg flex items-center justify-center">
                          <FileText className="h-4 w-4 text-nilin-coral" />
                        </div>
                        <span className="font-medium text-nilin-charcoal">{article.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{article.views.toLocaleString()} views</span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* FAQs */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-nilin-charcoal mb-4">
                Frequently Asked Questions
              </h2>
              <div className="bg-white rounded-xl border border-gray-200">
                {SAMPLE_FAQS.map((faq) => (
                  <FAQItem key={faq.id} faq={faq} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Contact Options */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-nilin-charcoal mb-4 text-center">
            Still need help?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Live Chat */}
            <button
              onClick={onNavigateToChat}
              className="flex flex-col items-center p-4 rounded-xl border border-gray-200 hover:border-nilin-coral/50 hover:bg-nilin-blush/30 transition-all"
            >
              <div className="w-12 h-12 bg-nilin-coral/10 rounded-full flex items-center justify-center mb-3">
                <MessageCircle className="h-6 w-6 text-nilin-coral" />
              </div>
              <h3 className="font-semibold text-nilin-charcoal mb-1">Chat with Us</h3>
              <p className="text-sm text-gray-500 text-center">Get instant help via live chat</p>
            </button>

            {/* Phone */}
            <button
              onClick={onNavigateToContact}
              className="flex flex-col items-center p-4 rounded-xl border border-gray-200 hover:border-green-500/50 hover:bg-green-50/50 transition-all"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-nilin-charcoal mb-1">Call Support</h3>
              <p className="text-sm text-gray-500 text-center">+971 800 123 4567</p>
            </button>

            {/* Email */}
            <button
              onClick={onNavigateToContact}
              className="flex flex-col items-center p-4 rounded-xl border border-gray-200 hover:border-blue-500/50 hover:bg-blue-50/50 transition-all"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-nilin-charcoal mb-1">Email Us</h3>
              <p className="text-sm text-gray-500 text-center">support@homeservice.com</p>
            </button>
          </div>

          {/* Additional Actions */}
          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onNavigateToTickets}
              className="flex items-center gap-2 px-4 py-2 text-nilin-coral hover:bg-nilin-blush/50 rounded-lg transition-colors"
            >
              <Book className="h-4 w-4" />
              View my tickets
            </button>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <a
              href="/help/knowledge-base"
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Browse full knowledge base
            </a>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="h-4 w-4" />
            <span>Support Hours: Saturday - Thursday, 9:00 AM - 9:00 PM (GST)</span>
          </div>
          <p>Response time: Usually within 2 hours during business hours</p>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
