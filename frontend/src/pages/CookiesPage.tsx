import React from 'react';
import { Cookie, Shield, Settings, AlertCircle } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';

const CookiesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
              <Cookie className="w-8 h-8 text-nilin-coral" aria-hidden="true" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-4">
              Cookie Policy
            </h1>
            <p className="text-lg text-nilin-warmGray">
              Last updated: January 2024
            </p>
          </div>

          <div className="glass-nilin rounded-nilin-lg p-8 md:p-10">
            {/* Table of Contents */}
            <nav className="mb-10 pb-8 border-b border-nilin-border">
              <h2 className="text-lg font-serif text-nilin-charcoal mb-4">Contents</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <li><a href="#what-are-cookies" className="text-nilin-coral hover:text-nilin-rose">1. What Are Cookies</a></li>
                <li><a href="#how-we-use" className="text-nilin-coral hover:text-nilin-rose">2. How We Use Cookies</a></li>
                <li><a href="#types" className="text-nilin-coral hover:text-nilin-rose">3. Types of Cookies</a></li>
                <li><a href="#third-party" className="text-nilin-coral hover:text-nilin-rose">4. Third-Party Cookies</a></li>
                <li><a href="#manage" className="text-nilin-coral hover:text-nilin-rose">5. Managing Cookies</a></li>
                <li><a href="#updates" className="text-nilin-coral hover:text-nilin-rose">6. Policy Updates</a></li>
              </ul>
            </nav>

            {/* Section 1: What Are Cookies */}
            <section id="what-are-cookies" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Cookie className="w-5 h-5 text-nilin-coral" />
                1. What Are Cookies?
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>
                  Cookies are small text files that are stored on your device (computer, tablet, or mobile phone) when you visit a website. They help websites remember your preferences, login information, and browsing behavior.
                </p>
                <p>
                  At NILIN, we use cookies to enhance your experience on our platform, understand how you use our services, and improve our offerings.
                </p>
              </div>
            </section>

            {/* Section 2: How We Use Cookies */}
            <section id="how-we-use" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-nilin-coral" />
                2. How We Use Cookies
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>We use cookies for the following purposes:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-nilin-charcoal">Authentication:</strong> To keep you logged in and secure your account</li>
                  <li><strong className="text-nilin-charcoal">Preferences:</strong> To remember your settings and preferences</li>
                  <li><strong className="text-nilin-charcoal">Analytics:</strong> To understand how visitors use our website</li>
                  <li><strong className="text-nilin-charcoal">Marketing:</strong> To deliver relevant advertisements</li>
                  <li><strong className="text-nilin-charcoal">Performance:</strong> To monitor and improve website speed and functionality</li>
                </ul>
              </div>
            </section>

            {/* Section 3: Types of Cookies */}
            <section id="types" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-nilin-coral" />
                3. Types of Cookies We Use
              </h2>
              <div className="space-y-6">
                {/* Essential Cookies */}
                <div className="p-5 bg-nilin-blush/20 rounded-nilin border border-nilin-blush/40">
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">Essential Cookies</h3>
                  <p className="text-nilin-warmGray text-sm mb-3">
                    These cookies are necessary for the website to function properly. They enable core functionality such as security, account access, and session management.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-nilin-coral/10 text-nilin-coral text-xs rounded-full">Always Active</span>
                    <span className="px-2 py-1 bg-nilin-coral/10 text-nilin-coral text-xs rounded-full">Cannot Be Disabled</span>
                  </div>
                </div>

                {/* Functional Cookies */}
                <div className="p-5 bg-gray-50 rounded-nilin border border-gray-200">
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">Functional Cookies</h3>
                  <p className="text-nilin-warmGray text-sm mb-3">
                    These cookies enable enhanced functionality and personalization, such as remembering your language preferences and recent searches.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Can Be Disabled</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Session-Based</span>
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="p-5 bg-gray-50 rounded-nilin border border-gray-200">
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">Analytics Cookies</h3>
                  <p className="text-nilin-warmGray text-sm mb-3">
                    These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Can Be Disabled</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Aggregated Data</span>
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="p-5 bg-gray-50 rounded-nilin border border-gray-200">
                  <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">Marketing Cookies</h3>
                  <p className="text-nilin-warmGray text-sm mb-3">
                    These cookies are used to track visitors across websites for advertising purposes. They help us deliver relevant ads and measure campaign effectiveness.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Can Be Disabled</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Cross-Site Tracking</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: Third-Party Cookies */}
            <section id="third-party" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-nilin-coral" />
                4. Third-Party Cookies
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>Some cookies on our website are set by third-party services we use:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-nilin-charcoal">Payment Providers:</strong> For secure payment processing (Stripe, PayTabs)</li>
                  <li><strong className="text-nilin-charcoal">Analytics Services:</strong> To understand website usage (Google Analytics)</li>
                  <li><strong className="text-nilin-charcoal">Marketing Platforms:</strong> For advertising and retargeting</li>
                  <li><strong className="text-nilin-charcoal">Social Media:</strong> For social sharing features</li>
                </ul>
                <p className="mt-4">
                  We do not have control over these third-party cookies. Please refer to the respective third-party privacy policies for more information.
                </p>
              </div>
            </section>

            {/* Section 5: Managing Cookies */}
            <section id="manage" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4">5. Managing Your Cookie Preferences</h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>You have several options for managing cookies:</p>
                <div className="space-y-3">
                  <div className="p-4 bg-nilin-blush/20 rounded-nilin">
                    <h4 className="font-medium text-nilin-charcoal mb-1">Browser Settings</h4>
                    <p className="text-sm">Most web browsers allow you to control cookies through their settings. You can block or delete cookies through your browser preferences.</p>
                  </div>
                  <div className="p-4 bg-nilin-blush/20 rounded-nilin">
                    <h4 className="font-medium text-nilin-charcoal mb-1">Privacy Settings</h4>
                    <p className="text-sm">You can adjust your privacy settings in our platform through the "Notification Settings" page in your account.</p>
                  </div>
                  <div className="p-4 bg-nilin-blush/20 rounded-nilin">
                    <h4 className="font-medium text-nilin-charcoal mb-1">Opt-Out Tools</h4>
                    <p className="text-sm">You can opt out of targeted advertising through industry opt-out tools like the Digital Advertising Alliance (DAA) or Network Advertising Initiative (NAI).</p>
                  </div>
                </div>
                <div className="p-4 bg-amber-50 rounded-nilin border border-amber-200 mt-4">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> Disabling certain cookies may affect the functionality of our website and your user experience.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 6: Policy Updates */}
            <section id="updates">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4">6. Policy Updates</h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>
                  We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons.
                </p>
                <p>
                  When we make updates, we will revise the "Last updated" date at the top of this policy and, in some cases, we may provide additional notice (such as adding a statement to our homepage or sending you a notification).
                </p>
                <p>
                  We encourage you to review this Cookie Policy periodically to stay informed about our use of cookies.
                </p>
              </div>
            </section>

            {/* Contact Section */}
            <div className="mt-12 pt-8 border-t border-nilin-border">
              <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Questions About Our Cookie Policy?</h3>
              <p className="text-nilin-warmGray mb-4">
                If you have any questions about our use of cookies, please contact us:
              </p>
              <div className="p-4 bg-nilin-blush/30 rounded-nilin">
                <p className="text-nilin-charcoal font-medium">NILIN Privacy Team</p>
                <p>Email: <a href="mailto:privacy@nilin.com" className="text-nilin-coral hover:text-nilin-rose">privacy@nilin.com</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CookiesPage;