import React from 'react';
import { FileText, Scale, User, CreditCard, Calendar, AlertTriangle, Mail } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
              <Scale className="w-8 h-8 text-nilin-coral" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-nilin-warmGray">
              Last updated: January 2024
            </p>
          </div>

          <div className="glass-nilin rounded-nilin-lg p-8 md:p-10">
            {/* Introduction */}
            <section className="mb-10">
              <p className="text-nilin-warmGray leading-relaxed mb-4">
                Welcome to NILIN. These Terms of Service ("Terms") govern your use of the NILIN platform, including our website, mobile application, and related services (collectively, the "Platform"). By accessing or using NILIN, you agree to be bound by these Terms.
              </p>
              <div className="p-4 bg-nilin-blush/30 rounded-nilin border-l-4 border-nilin-coral">
                <p className="text-sm text-nilin-charcoal">
                  <strong>Important:</strong> Please read these Terms carefully before using the Platform. If you do not agree to these Terms, please do not use our services.
                </p>
              </div>
            </section>

            {/* Table of Contents */}
            <nav className="mb-10 pb-8 border-b border-nilin-border">
              <h2 className="text-lg font-serif text-nilin-charcoal mb-4">Contents</h2>
              <ul className="space-y-2 text-sm">
                <li><a href="#account" className="text-nilin-coral hover:text-nilin-rose">1. Your Account</a></li>
                <li><a href="#services" className="text-nilin-coral hover:text-nilin-rose">2. Services & Bookings</a></li>
                <li><a href="#payments" className="text-nilin-coral hover:text-nilin-rose">3. Payments</a></li>
                <li><a href="#cancellations" className="text-nilin-coral hover:text-nilin-rose">4. Cancellations & Refunds</a></li>
                <li><a href="#conduct" className="text-nilin-coral hover:text-nilin-rose">5. User Conduct</a></li>
                <li><a href="#intellectual" className="text-nilin-coral hover:text-nilin-rose">6. Intellectual Property</a></li>
                <li><a href="#limitation" className="text-nilin-coral hover:text-nilin-rose">7. Limitation of Liability</a></li>
                <li><a href="#changes" className="text-nilin-coral hover:text-nilin-rose">8. Changes to Terms</a></li>
                <li><a href="#contact" className="text-nilin-coral hover:text-nilin-rose">9. Contact</a></li>
              </ul>
            </nav>

            {/* Section 1: Your Account */}
            <section id="account" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-nilin-coral" />
                1. Your Account
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>By creating an account, you agree to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate and complete information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Notify us immediately of any unauthorized access</li>
                  <li>Be responsible for all activities under your account</li>
                  <li>Be at least 18 years old to use the Platform</li>
                </ul>
                <p className="mt-4">
                  We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.
                </p>
              </div>
            </section>

            {/* Section 2: Services & Bookings */}
            <section id="services" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-nilin-coral" />
                2. Services & Bookings
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>NILIN provides a marketplace connecting clients with beauty and wellness professionals. When you book a service:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>You enter into a direct contract with the service provider</li>
                  <li>NILIN is not a party to the service contract</li>
                  <li>Service providers are independent professionals, not NILIN employees</li>
                  <li>Service descriptions and pricing are set by providers</li>
                  <li>Availability is subject to provider confirmation</li>
                </ul>
                <p className="mt-4">
                  While we verify service providers, we do not guarantee the quality of services rendered. Any disputes should be resolved directly with the provider.
                </p>
              </div>
            </section>

            {/* Section 3: Payments */}
            <section id="payments" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-nilin-coral" />
                3. Payments
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Payments are processed securely through our payment partners</li>
                  <li>All prices are in AED unless otherwise specified</li>
                  <li>Tips may be added at your discretion</li>
                  <li>Failed payments may result in booking cancellation</li>
                  <li>You authorize NILIN to charge your payment method for completed services</li>
                </ul>
              </div>
            </section>

            {/* Section 4: Cancellations & Refunds */}
            <section id="cancellations" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-nilin-coral" />
                4. Cancellations & Refunds
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>Our cancellation policy:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-nilin-charcoal">Free cancellation:</strong> Up to 24 hours before appointment</li>
                  <li><strong className="text-nilin-charcoal">Late cancellation:</strong> Within 24 hours - 50% charge may apply</li>
                  <li><strong className="text-nilin-charcoal">No-show:</strong> Full service charge may apply</li>
                </ul>
                <p className="mt-4">
                  Refund requests must be submitted within 48 hours of the service. Reviews and feedback help maintain service quality.
                </p>
              </div>
            </section>

            {/* Section 5: User Conduct */}
            <section id="conduct" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-nilin-coral" />
                5. User Conduct
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>You agree NOT to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Use the Platform for any illegal purpose</li>
                  <li>Harass, abuse, or harm service providers</li>
                  <li>Make false bookings or fraudulent claims</li>
                  <li>Attempt to circumvent our booking system</li>
                  <li>Share your account or impersonate others</li>
                  <li>Interfere with the Platform's operation</li>
                </ul>
                <p className="mt-4">
                  Violations may result in account suspension, service termination, and potential legal action.
                </p>
              </div>
            </section>

            {/* Section 6: Intellectual Property */}
            <section id="intellectual" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-nilin-coral" />
                6. Intellectual Property
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>
                  All content on the Platform, including logos, designs, text, graphics, and software, is the property of NILIN or its licensors and is protected by intellectual property laws.
                </p>
                <p>
                  You may not copy, modify, or distribute our content without prior written consent.
                </p>
              </div>
            </section>

            {/* Section 7: Limitation of Liability */}
            <section id="limitation" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4">
                7. Limitation of Liability
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>
                  To the maximum extent permitted by law, NILIN shall not be liable for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Any indirect, incidental, or consequential damages</li>
                  <li>Loss of profits, data, or business opportunities</li>
                  <li>Actions or negligence of service providers</li>
                  <li>Technical issues beyond our reasonable control</li>
                </ul>
                <p className="mt-4">
                  Our total liability shall not exceed the amount you paid for the specific service in question.
                </p>
              </div>
            </section>

            {/* Section 8: Changes to Terms */}
            <section id="changes" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4">
                8. Changes to These Terms
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>
                  We may update these Terms from time to time. We will notify you of material changes via email or Platform notifications. Continued use of NILIN after changes constitutes acceptance of the new Terms.
                </p>
              </div>
            </section>

            {/* Section 9: Contact */}
            <section id="contact">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-nilin-coral" />
                9. Contact Us
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>For questions about these Terms, please contact us:</p>
                <div className="p-4 bg-nilin-blush/30 rounded-nilin">
                  <p className="text-nilin-charcoal font-medium">NILIN Legal Team</p>
                  <p>Email: <a href="mailto:legal@nilin.com" className="text-nilin-coral hover:text-nilin-rose">legal@nilin.com</a></p>
                  <p>Address: Dubai, UAE</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TermsPage;
