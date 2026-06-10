import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Book, Video, MessageCircle, ExternalLink, ChevronRight, Search, Phone, Mail, Clock, FileText, Users, Star } from 'lucide-react';
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

const HelpPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

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
            <p className="text-center text-sm text-nilin-warmGray mt-4">Help articles coming soon. Contact support for assistance.</p>
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
            <div className="glass-nilin rounded-nilin-lg p-8 text-center">
              <Video className="w-12 h-12 text-nilin-lightGray mx-auto mb-4" />
              <h3 className="font-medium text-nilin-charcoal mb-2">Video Tutorials Coming Soon</h3>
              <p className="text-sm text-nilin-warmGray">We are working on video guides to help you get started with NILIN.</p>
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
              <Link
                to="/faq"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-nilin-border text-nilin-charcoal rounded-nilin font-medium hover:bg-nilin-blush/30 transition-all duration-200"
              >
                <HelpCircle className="w-4 h-4" />
                Browse FAQs
              </Link>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default HelpPage;
