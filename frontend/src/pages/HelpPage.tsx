import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Book, Video, MessageCircle, ExternalLink, ChevronRight, Search, Phone, Mail, Clock, FileText, Users, Star, ChevronDown, ChevronUp } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import { useAuthStore } from '../stores/authStore';

interface HelpCategory {
  icon: React.ElementType;
  title: string;
  description: string;
  link: string;
  articles: number;
}

interface HelpArticle {
  title: string;
  excerpt: string;
  link: string;
  category: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

const HelpPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const categories: HelpCategory[] = [
    {
      icon: Book,
      title: 'Getting Started',
      description: 'Learn the basics of using NILIN',
      link: '/help/getting-started',
      articles: 8,
    },
    {
      icon: Users,
      title: 'Account & Profile',
      description: 'Manage your account settings',
      link: '/help/account',
      articles: 6,
    },
    {
      icon: Star,
      title: 'Reviews & Ratings',
      description: 'Leave and read reviews',
      link: '/help/reviews',
      articles: 4,
    },
    {
      icon: FileText,
      title: 'Bookings & Scheduling',
      description: 'Manage your appointments',
      link: '/help/bookings',
      articles: 10,
    },
    {
      icon: MessageCircle,
      title: 'Messages & Chat',
      description: 'Communicate with providers',
      link: '/help/messages',
      articles: 5,
    },
    {
      icon: Phone,
      title: 'Payments & Billing',
      description: 'Payment methods and invoices',
      link: '/help/payments',
      articles: 7,
    },
  ];

  const popularArticles: HelpArticle[] = [
    {
      title: 'How to book your first service',
      excerpt: 'A step-by-step guide to finding and booking your first beauty service on NILIN.',
      link: '/help/article/booking-first-service',
      category: 'Getting Started',
    },
    {
      title: 'Updating your profile photo',
      excerpt: 'Learn how to add or change your profile picture to help providers recognize you.',
      link: '/help/article/update-profile-photo',
      category: 'Account & Profile',
    },
    {
      title: 'Understanding your booking receipt',
      excerpt: 'Everything you need to know about the information shown on your booking confirmation.',
      link: '/help/article/booking-receipt',
      category: 'Bookings',
    },
    {
      title: 'How to write a helpful review',
      excerpt: 'Tips for leaving constructive reviews that help other users and providers.',
      link: '/help/article/write-review',
      category: 'Reviews',
    },
    {
      title: 'Accepted payment methods',
      excerpt: 'Learn about all the payment options available when booking on NILIN.',
      link: '/help/article/payment-methods',
      category: 'Payments',
    },
    {
      title: 'Chatting with your provider',
      excerpt: 'How to use the in-app messaging feature to coordinate with your service provider.',
      link: '/help/article/chat-providers',
      category: 'Messages',
    },
  ];

  const faqItems: FAQItem[] = [
    // Booking FAQs
    {
      question: 'How do I book a service on NILIN?',
      answer: 'Browse through our categories, select a service provider, choose your preferred date and time, and confirm your booking. You will receive a confirmation notification once your booking is confirmed. You can also add specific notes or requests during the booking process.',
    },
    {
      question: 'Can I book a service for someone else?',
      answer: 'Yes, you can book a service for a family member or friend. During the booking process, you can specify who will be receiving the service. The confirmation and updates will be sent to your account, and you can share the booking details with the recipient.',
    },
    {
      question: 'How do I find a specific service or provider?',
      answer: 'Use the search bar at the top of the page to search by service name, provider name, or category. You can also filter results by location, rating, price range, and availability to find the perfect match for your needs.',
    },
    {
      question: 'What happens if my preferred time slot is not available?',
      answer: 'If your preferred time is not available, you will see an error message. We recommend checking the provider\'s full availability calendar or contacting them directly through the in-app chat to discuss alternative times that work for both parties.',
    },
    // Cancellation FAQs
    {
      question: 'How do I cancel or reschedule my booking?',
      answer: 'Go to "My Bookings" in your account menu, select the booking you wish to modify, and choose either "Cancel" or "Reschedule". Follow the prompts to select a new date and time. Please note that changes made within 24 hours of the appointment may incur a fee.',
    },
    {
      question: 'What is your cancellation policy?',
      answer: 'You can cancel your booking free of charge up to 24 hours before the scheduled appointment. Cancellations made within 24 hours may be subject to a cancellation fee of up to 50% of the service cost. No-shows will be charged the full amount.',
    },
    {
      question: 'Can I get a refund if I cancel my booking?',
      answer: 'Yes, eligible cancellations made within the policy timeframe will receive a full refund within 5-7 business days. Refunds are processed to the original payment method used during booking. Contact support@nilin.com for any refund-related queries.',
    },
    {
      question: 'What if the provider cancels on me?',
      answer: 'If a provider cancels, you will be notified immediately and the full amount will be refunded automatically. You can then rebook with another provider or contact our support team for assistance in finding an alternative.',
    },
    // Payment FAQs
    {
      question: 'What payment methods are accepted?',
      answer: 'We accept all major credit cards (Visa, Mastercard, American Express), debit cards, Apple Pay, Google Pay, and cash payments. Payment is processed securely through our encrypted payment system.',
    },
    {
      question: 'Is my payment information secure?',
      answer: 'Absolutely. All payments are processed through PCI-compliant payment providers with bank-level encryption. We never store your full credit card details on our servers. Your financial information is completely secure.',
    },
    {
      question: 'When will I be charged for my booking?',
      answer: 'Payment is processed at the time of booking confirmation. For cash payments, you will pay the provider directly at the time of service. Some services may require a deposit, which will be clearly indicated during the booking process.',
    },
    {
      question: 'Do I need to tip my service provider?',
      answer: 'Tips are not required but are greatly appreciated by our service providers. You can add a tip during the booking process or give a cash tip directly to your provider after the service is completed.',
    },
    // Provider Communication FAQs
    {
      question: 'How can I contact my service provider?',
      answer: 'Once your booking is confirmed, you can message your provider directly through the in-app chat feature. You will find this in your booking details under the "Messages" section. You can discuss appointment details, special requests, or any questions before your service.',
    },
    {
      question: 'How quickly will my provider respond to messages?',
      answer: 'Response times vary by provider. Most providers respond within a few hours during business hours. You will receive a notification when you receive a new message. If you need an urgent response, consider calling the provider directly if their phone number is available.',
    },
    {
      question: 'Can I share images or files with my provider?',
      answer: 'Yes, you can share images through the in-app chat to show reference photos, describe specific concerns, or share any relevant information that will help your provider prepare for your service.',
    },
    {
      question: 'What if I cannot reach my provider before my appointment?',
      answer: 'If you are unable to reach your provider through the app, you can contact our support team. We will help facilitate communication or assist with any booking changes you may need.',
    },
    // Reviews FAQs
    {
      question: 'How do I leave a review for a service?',
      answer: 'After your service is completed, you will receive a prompt to rate and review your experience. You can also leave reviews from your "My Bookings" history by clicking on the completed booking and selecting "Leave Review". Your feedback helps other customers and providers improve.',
    },
    {
      question: 'Can I edit or delete my review?',
      answer: 'Yes, you can edit your review within 30 days of posting it. Go to your profile, select "My Reviews", and click on the review you wish to edit. To request deletion, contact our support team with your reason for the request.',
    },
    {
      question: 'How do ratings work on NILIN?',
      answer: 'After each service, customers can leave a 1-5 star rating. The overall rating displayed on a provider\'s profile is calculated as an average of all ratings received. Providers with higher ratings may appear higher in search results.',
    },
    {
      question: 'What should I include in my review?',
      answer: 'A helpful review includes your overall experience, the quality of service, the professionalism of the provider, the cleanliness of the location, and whether the service met your expectations. Specific details help other customers make informed decisions.',
    },
    // General FAQs
    {
      question: 'What if I am not satisfied with my service?',
      answer: 'Please contact our support team immediately through the app or email us at support@nilin.app. We take all feedback seriously and will work to resolve any issues promptly. This may include partial or full refunds, or helping you arrange a redo of the service.',
    },
    {
      question: 'Are there any membership or loyalty programs?',
      answer: 'Yes! NILIN offers a loyalty program where you earn points for every booking. Points can be redeemed for discounts on future services. Check the "Rewards" section in your account to see your points balance and available rewards.',
    },
    {
      question: 'How do I become a service provider on NILIN?',
      answer: 'Visit our "For Providers" section or contact our business development team at providers@nilin.app to learn more about joining our platform. We welcome beauty and wellness professionals to join our growing community.',
    },
    {
      question: 'What areas do you service?',
      answer: 'NILIN currently operates in select cities and regions. You can check service availability in your area by entering your location during the booking process. We are continuously expanding our coverage to serve more customers.',
    },
  ];

  const { isAuthenticated } = useAuthStore();
  const supportLink = isAuthenticated ? '/customer/support' : '/contact';

  const quickHelp = [
    { icon: MessageCircle, title: 'Live Chat', description: 'Chat with our support team', link: supportLink },
    { icon: Mail, title: 'Email Support', description: 'support@nilin.com', link: 'mailto:support@nilin.com' },
    { icon: Phone, title: 'Call Us', description: '+971 4 123 4567', link: 'tel:+97141234567' },
  ];

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-8 h-8 text-nilin-coral" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-4">
              Help Center
            </h1>
            <p className="text-lg text-nilin-warmGray max-w-xl mx-auto mb-8">
              Find answers, guides, and support for everything NILIN.
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
              <input
                type="text"
                placeholder="Search for help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-14 pr-4 py-4 glass-nilin rounded-nilin-lg text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-lg"
              />
            </div>
          </div>

          {/* Quick Help Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {quickHelp.map((item, index) => (
              <a
                key={index}
                href={item.link}
                className="glass-nilin rounded-nilin-lg p-5 flex items-center gap-4 hover:shadow-nilin-warm transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-full bg-nilin-blush flex items-center justify-center flex-shrink-0 group-hover:bg-nilin-coral transition-colors duration-200">
                  <item.icon className="w-5 h-5 text-nilin-rose group-hover:text-white transition-colors duration-200" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-nilin-charcoal">{item.title}</p>
                  <p className="text-sm text-nilin-warmGray">{item.description}</p>
                </div>
              </a>
            ))}
          </div>

          {/* Browse by Category */}
          <section className="mb-12">
            <h2 className="text-2xl font-serif text-nilin-charcoal mb-6">Browse by Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category, index) => (
                <div
                  key={index}
                  className="glass-nilin rounded-nilin-lg p-6 hover:shadow-nilin-warm-lg transition-all duration-200 group cursor-not-allowed opacity-75"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-nilin bg-nilin-blush flex items-center justify-center flex-shrink-0">
                      <category.icon className="w-6 h-6 text-nilin-rose" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-nilin-charcoal mb-1">
                        {category.title}
                      </h3>
                      <p className="text-sm text-nilin-warmGray mb-2">{category.description}</p>
                      <p className="text-xs text-nilin-lightGray">{category.articles} articles</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-nilin-warmGray mt-4">More help articles coming soon. In the meantime, browse our FAQ section below or <Link to={supportLink} className="text-nilin-coral hover:underline">contact our support team</Link>.</p>
          </section>

          {/* Popular Articles */}
          <section className="mb-12">
            <h2 className="text-2xl font-serif text-nilin-charcoal mb-6">Popular Articles</h2>
            <div className="space-y-4">
              {popularArticles.map((article, index) => (
                <div
                  key={index}
                  className="glass-nilin rounded-nilin-lg p-5 flex items-center justify-between opacity-75 cursor-not-allowed"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="w-5 h-5 text-nilin-coral flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-nilin-charcoal">
                        {article.title}
                      </h3>
                      <p className="text-sm text-nilin-warmGray">{article.excerpt}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-nilin-blush/50 rounded text-xs text-nilin-rose">
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-nilin-warmGray flex-shrink-0" />
                </div>
              ))}
            </div>
          </section>

          {/* Video Tutorials */}
          <section className="mb-12">
            <h2 className="text-2xl font-serif text-nilin-charcoal mb-6">Video Tutorials</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-nilin rounded-nilin-lg p-6 hover:shadow-nilin-warm transition-all duration-200">
                <div className="w-12 h-12 rounded-nilin bg-nilin-blush flex items-center justify-center mb-4">
                  <Video className="w-6 h-6 text-nilin-rose" />
                </div>
                <h3 className="font-medium text-nilin-charcoal mb-2">How to Book Your First Service</h3>
                <p className="text-sm text-nilin-warmGray mb-3">A step-by-step video guide walking you through the booking process.</p>
                <span className="text-xs text-nilin-coral">2:30 min</span>
              </div>
              <div className="glass-nilin rounded-nilin-lg p-6 hover:shadow-nilin-warm transition-all duration-200">
                <div className="w-12 h-12 rounded-nilin bg-nilin-blush flex items-center justify-center mb-4">
                  <Video className="w-6 h-6 text-nilin-rose" />
                </div>
                <h3 className="font-medium text-nilin-charcoal mb-2">Managing Your Bookings</h3>
                <p className="text-sm text-nilin-warmGray mb-3">Learn how to view, reschedule, and cancel your appointments.</p>
                <span className="text-xs text-nilin-coral">3:15 min</span>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="mb-12" id="faq">
            <h2 className="text-2xl font-serif text-nilin-charcoal mb-2">Frequently Asked Questions</h2>
            <p className="text-nilin-warmGray mb-6">Find answers to common questions about bookings, payments, and more.</p>
            <div className="space-y-3">
              {faqItems.map((faq, index) => (
                <div
                  key={index}
                  className="glass-nilin rounded-nilin-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-nilin-blush/20 transition-colors"
                    aria-expanded={expandedFaq === index}
                  >
                    <span className="font-medium text-nilin-charcoal pr-4">{faq.question}</span>
                    {expandedFaq === index ? (
                      <ChevronUp className="h-5 w-5 text-nilin-coral flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-nilin-warmGray flex-shrink-0" />
                    )}
                  </button>
                  {expandedFaq === index && (
                    <div className="px-5 pb-4">
                      <p className="text-sm text-nilin-warmGray leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Still Need Help */}
          <section className="glass-nilin rounded-nilin-lg p-8 text-center">
            <h2 className="text-2xl font-serif text-nilin-charcoal mb-4">Still need help?</h2>
            <p className="text-nilin-warmGray mb-6 max-w-md mx-auto">
              Our support team is available 24/7 to assist you with any questions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={supportLink}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-nilin-coral text-white rounded-nilin font-medium hover:bg-nilin-rose transition-all duration-200 shadow-lg shadow-nilin-coral/30"
              >
                <MessageCircle className="w-4 h-4" />
                {isAuthenticated ? 'Support Center' : 'Contact Support'}
              </Link>
              <a
                href="#faq"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-nilin-border text-nilin-charcoal rounded-nilin font-medium hover:bg-nilin-blush/30 transition-all duration-200"
              >
                <HelpCircle className="w-4 h-4" />
                Browse FAQs
              </a>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default HelpPage;
