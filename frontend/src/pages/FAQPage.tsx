import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Search, Calendar, CreditCard, MapPin, User, Shield, Clock, MessageCircle } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    // Booking Related
    {
      question: 'How do I book a service?',
      answer: 'Simply browse our categories, select a service provider, choose your preferred date and time, and confirm your booking. You will receive a confirmation email and SMS with all the details.',
      category: 'Booking',
    },
    {
      question: 'Can I book same-day appointments?',
      answer: 'Yes, same-day bookings are available depending on provider availability. Look for the "Today" filter when browsing services to see same-day options.',
      category: 'Booking',
    },
    {
      question: 'How do I reschedule my booking?',
      answer: 'Go to "My Bookings," select the booking you want to reschedule, and choose "Reschedule." You can reschedule up to 24 hours before your appointment without any fees.',
      category: 'Booking',
    },
    {
      question: 'What happens if the provider cancels?',
      answer: 'If a provider cancels, you will be notified immediately and your payment will be refunded in full. You can then book another provider or contact our support team for assistance.',
      category: 'Booking',
    },

    // Payment Related
    {
      question: 'What payment methods are accepted?',
      answer: 'We accept all major credit cards, debit cards, Apple Pay, Google Pay, and cash payments. Payment is processed securely through our trusted payment partners.',
      category: 'Payment',
    },
    {
      question: 'Is my payment information secure?',
      answer: 'Absolutely. We use industry-standard encryption and work with certified payment processors. We never store your complete card details on our servers.',
      category: 'Payment',
    },
    {
      question: 'Do I need to pay upfront?',
      answer: 'Yes, payment is processed at the time of booking to confirm your appointment. This ensures the provider\'s time is reserved for you.',
      category: 'Payment',
    },

    // Cancellation & Refunds
    {
      question: 'What is your cancellation policy?',
      answer: 'You can cancel free of charge up to 24 hours before your appointment. Cancellations within 24 hours may incur a 50% fee. No-shows will be charged the full amount.',
      category: 'Cancellation',
    },
    {
      question: 'How do I get a refund?',
      answer: 'Refund requests can be submitted through "My Bookings" within 48 hours of the service. Approved refunds are processed within 5-7 business days to your original payment method.',
      category: 'Cancellation',
    },
    {
      question: 'What if I am not satisfied with the service?',
      answer: 'We take quality seriously. If you are not satisfied, please contact us within 48 hours with details. We will investigate and work to resolve the issue, which may include a partial or full refund.',
      category: 'Cancellation',
    },

    // Service Providers
    {
      question: 'How do you verify your service providers?',
      answer: 'All providers undergo a rigorous verification process including ID verification, background checks, skill certification verification, and portfolio review. We also continuously monitor reviews and performance.',
      category: 'Providers',
    },
    {
      question: 'Can I request a specific provider?',
      answer: 'Yes! When booking, you can select a specific provider you have previously used and liked. Their availability will be shown during the booking process.',
      category: 'Providers',
    },
    {
      question: 'What if I have a bad experience with a provider?',
      answer: 'Please report any issues through the app immediately. We take all feedback seriously and may remove providers who do not meet our quality standards.',
      category: 'Providers',
    },

    // Account & Profile
    {
      question: 'How do I update my profile?',
      answer: 'Go to "Profile" in the menu, then select "Edit Profile" to update your name, phone number, profile photo, and notification preferences.',
      category: 'Account',
    },
    {
      question: 'Can I delete my account?',
      answer: 'Yes, you can request account deletion through Settings > Privacy > Delete Account. Your data will be removed in accordance with our privacy policy.',
      category: 'Account',
    },

    // Technical & App
    {
      question: 'The app is not working properly. What should I do?',
      answer: 'First, try closing and reopening the app. If the issue persists, check for app updates in your app store. You can also contact support with details of the issue.',
      category: 'Technical',
    },
    {
      question: 'Will my data be saved if I reinstall the app?',
      answer: 'Yes, your account data is stored on our servers, not on your device. Simply log in with your credentials after reinstalling to restore all your information.',
      category: 'Technical',
    },
  ];

  const categories = ['All', ...Array.from(new Set(faqs.map(faq => faq.category)))];

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Booking': return <Calendar className="w-4 h-4" />;
      case 'Payment': return <CreditCard className="w-4 h-4" />;
      case 'Cancellation': return <Clock className="w-4 h-4" />;
      case 'Providers': return <User className="w-4 h-4" />;
      case 'Account': return <Shield className="w-4 h-4" />;
      case 'Technical': return <HelpCircle className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-12">
        <div className="max-w-3xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-8 h-8 text-nilin-coral" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-lg text-nilin-warmGray max-w-xl mx-auto">
              Find answers to common questions about NILIN services, bookings, and payments.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
            <input
              type="text"
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 glass-nilin rounded-nilin text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
            />
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-sm bg-nilin-blush/50 hover:bg-nilin-blush text-nilin-charcoal rounded-full transition-all duration-200 hover:shadow-nilin-warm"
              >
                {category}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="space-y-4">
            {filteredFAQs.length === 0 ? (
              <div className="glass-nilin rounded-nilin-lg p-8 text-center">
                <MessageCircle className="w-12 h-12 text-nilin-warmGray mx-auto mb-4" />
                <p className="text-nilin-warmGray">No FAQs found matching your search.</p>
                <p className="text-sm text-nilin-lightGray mt-2">Try different keywords or contact support.</p>
              </div>
            ) : (
              filteredFAQs.map((faq, index) => (
                <div
                  key={index}
                  className={`glass-nilin rounded-nilin-lg overflow-hidden transition-all duration-200 ${
                    expandedIndex === index ? 'shadow-nilin-warm-lg' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleExpand(index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-nilin-blush/20 transition-colors duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-nilin-coral">
                        {getCategoryIcon(faq.category)}
                      </span>
                      <span className="font-medium text-nilin-charcoal pr-4">
                        {faq.question}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-nilin-warmGray flex-shrink-0 transition-transform duration-200 ${
                        expandedIndex === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedIndex === index && (
                    <div className="px-6 pb-5">
                      <p className="text-nilin-warmGray leading-relaxed pl-9">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Still Need Help */}
          <div className="mt-12 glass-nilin rounded-nilin-lg p-8 text-center">
            <h2 className="text-xl font-serif text-nilin-charcoal mb-2">Still have questions?</h2>
            <p className="text-nilin-warmGray mb-4">Our support team is here to help you.</p>
            <a
              href="mailto:support@nilin.com"
              className="inline-flex items-center gap-2 px-6 py-3 bg-nilin-coral text-white rounded-nilin font-medium hover:bg-nilin-rose transition-all duration-200 shadow-lg shadow-nilin-coral/30"
            >
              <MessageCircle className="w-4 h-4" />
              Contact Support
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FAQPage;
