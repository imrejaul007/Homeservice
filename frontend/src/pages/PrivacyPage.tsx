import React from 'react';
import { Shield, Eye, Lock, FileText, Mail, User, Calendar } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';

const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-nilin-coral" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-nilin-warmGray">
              Last updated: January 2024
            </p>
          </div>

          <div className="glass-nilin rounded-nilin-lg p-8 md:p-10">
            {/* Table of Contents */}
            <nav className="mb-10 pb-8 border-b border-nilin-border">
              <h2 className="text-lg font-serif text-nilin-charcoal mb-4">Contents</h2>
              <ul className="space-y-2 text-sm">
                <li><a href="#information" className="text-nilin-coral hover:text-nilin-rose">1. Information We Collect</a></li>
                <li><a href="#usage" className="text-nilin-coral hover:text-nilin-rose">2. How We Use Your Information</a></li>
                <li><a href="#sharing" className="text-nilin-coral hover:text-nilin-rose">3. Information Sharing</a></li>
                <li><a href="#security" className="text-nilin-coral hover:text-nilin-rose">4. Data Security</a></li>
                <li><a href="#rights" className="text-nilin-coral hover:text-nilin-rose">5. Your Rights</a></li>
                <li><a href="#contact" className="text-nilin-coral hover:text-nilin-rose">6. Contact Us</a></li>
              </ul>
            </nav>

            {/* Section 1: Information We Collect */}
            <section id="information" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-nilin-coral" />
                1. Information We Collect
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>
                  We collect information you provide directly to us, including when you create an account, book a service, or communicate with us. This includes:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-nilin-charcoal">Account Information:</strong> Name, email address, phone number, profile photo, and password.</li>
                  <li><strong className="text-nilin-charcoal">Booking Information:</strong> Services booked, appointment times, addresses, and payment details.</li>
                  <li><strong className="text-nilin-charcoal">Communication Data:</strong> Messages you send us and feedback you provide.</li>
                  <li><strong className="text-nilin-charcoal">Location Data:</strong> Your location to connect you with nearby service providers.</li>
                </ul>
              </div>
            </section>

            {/* Section 2: How We Use Your Information */}
            <section id="usage" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-nilin-coral" />
                2. How We Use Your Information
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>We use the information we collect to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Process and manage your bookings</li>
                  <li>Connect you with appropriate service professionals</li>
                  <li>Send you booking confirmations and reminders</li>
                  <li>Process payments securely</li>
                  <li>Improve our services and user experience</li>
                  <li>Communicate with you about promotions and updates</li>
                  <li>Ensure platform safety and prevent fraud</li>
                </ul>
              </div>
            </section>

            {/* Section 3: Information Sharing */}
            <section id="sharing" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-nilin-coral" />
                3. Information Sharing
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>We may share your information with:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong className="text-nilin-charcoal">Service Providers:</strong> Only the information necessary to complete your booking.</li>
                  <li><strong className="text-nilin-charcoal">Payment Processors:</strong> To process transactions securely.</li>
                  <li><strong className="text-nilin-charcoal">Legal Requirements:</strong> When required by law or to protect our rights.</li>
                </ul>
                <p className="mt-4">
                  We never sell your personal information to third parties for marketing purposes.
                </p>
              </div>
            </section>

            {/* Section 4: Data Security */}
            <section id="security" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-nilin-coral" />
                4. Data Security
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>
                  We implement appropriate technical and organizational measures to protect your personal information, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security assessments and audits</li>
                  <li>Access controls and employee training</li>
                  <li>Secure payment processing through certified providers</li>
                </ul>
              </div>
            </section>

            {/* Section 5: Your Rights */}
            <section id="rights" className="mb-10">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-nilin-coral" />
                5. Your Rights
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>You have the right to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Access your personal information</li>
                  <li>Correct inaccurate information</li>
                  <li>Delete your account and associated data</li>
                  <li>Opt out of marketing communications</li>
                  <li>Data portability</li>
                </ul>
                <p>
                  To exercise any of these rights, please contact us at <a href="mailto:privacy@nilin.com" className="text-nilin-coral hover:text-nilin-rose">privacy@nilin.com</a>.
                </p>
              </div>
            </section>

            {/* Section 6: Contact Us */}
            <section id="contact">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-nilin-coral" />
                6. Contact Us
              </h2>
              <div className="space-y-4 text-nilin-warmGray">
                <p>
                  If you have any questions about this Privacy Policy, please contact us:
                </p>
                <div className="p-4 bg-nilin-blush/30 rounded-nilin">
                  <p className="text-nilin-charcoal font-medium">NILIN Privacy Team</p>
                  <p>Email: <a href="mailto:privacy@nilin.com" className="text-nilin-coral hover:text-nilin-rose">privacy@nilin.com</a></p>
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

export default PrivacyPage;
