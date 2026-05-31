import React, { useState } from 'react';
import {
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Clock,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type ContactReason = 'general' | 'booking' | 'payment' | 'technical' | 'feedback' | 'partnership';

export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  reason: ContactReason;
  subject: string;
  message: string;
}

export interface ContactUsProps {
  className?: string;
  onSubmitSuccess?: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const CONTACT_REASONS: Array<{ value: ContactReason; label: string; icon: string; description: string }> = [
  { value: 'general', label: 'General Inquiry', icon: '💬', description: 'Questions about our services' },
  { value: 'booking', label: 'Booking Issue', icon: '📅', description: 'Problems with a booking' },
  { value: 'payment', label: 'Payment & Billing', icon: '💳', description: 'Payment or invoice questions' },
  { value: 'technical', label: 'Technical Support', icon: '⚙️', description: 'App or website issues' },
  { value: 'feedback', label: 'Feedback', icon: '💡', description: 'Share your thoughts' },
  { value: 'partnership', label: 'Partnership', icon: '🤝', description: 'Business inquiries' },
];

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'What are your support hours?',
    a: 'Our support team is available Saturday through Thursday, 9:00 AM to 9:00 PM (GST). We aim to respond to all inquiries within 2 hours during business hours.',
  },
  {
    q: 'How can I track my support ticket?',
    a: 'Once you submit a ticket, you will receive a ticket number via email. You can track your ticket status by logging into your account and visiting the Support section.',
  },
  {
    q: 'Can I request a callback?',
    a: 'Yes! You can request a callback at a time that is convenient for you. Simply use the Callback Request form and select your preferred time slot.',
  },
  {
    q: 'How do I escalate a support ticket?',
    a: 'If you feel your issue has not been resolved satisfactorily, you can request an escalation through the chat or by replying to your ticket notification email.',
  },
];

// ============================================
// FAQ ITEM COMPONENT
// ============================================

const FAQItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-nilin-charcoal pr-4">{q}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && <p className="pb-4 text-gray-600">{a}</p>}
    </div>
  );
};

// ============================================
// MAIN CONTACT US COMPONENT
// ============================================

export const ContactUs: React.FC<ContactUsProps> = ({ className, onSubmitSuccess }) => {
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState<ContactReason>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPhoneValid = phone === '' || /^[+]?[\d\s\-()]{8,20}$/.test(phone);
  const isValid = name.trim() && isEmailValid && isPhoneValid && subject.trim() && message.trim().length >= 20;

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // In production, this would call the actual API
      // await authService.post('/support/contact', { name, email, phone, reason, subject, message });

      setSubmitted(true);
      onSubmitSuccess?.();
    } catch (err) {
      console.error('Failed to submit contact form:', err);
      setError('Failed to submit your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className={cn('bg-gray-50 min-h-screen p-6', className)}>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-nilin-charcoal mb-2">
              Message Sent!
            </h2>
            <p className="text-gray-500 mb-6">
              Thank you for contacting us. Our support team will get back to you within 2 hours during business hours.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-500">Reference Number</p>
              <p className="text-xl font-mono font-semibold text-nilin-coral">
                MSG-{Date.now().toString(36).toUpperCase()}
              </p>
            </div>
            <button
              onClick={() => {
                setSubmitted(false);
                setName('');
                setEmail('');
                setPhone('');
                setReason('general');
                setSubject('');
                setMessage('');
              }}
              className="px-6 py-3 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors"
            >
              Send Another Message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-50 min-h-screen', className)}>
      {/* Hero */}
      <div className="bg-gradient-to-r from-nilin-rose to-nilin-coral text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Contact Us</h1>
          <p className="text-white/80">
            We are here to help. Reach out to us through any of the channels below.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Methods */}
          <div className="space-y-6">
            {/* Quick Contact Cards */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-nilin-charcoal mb-4">Quick Contact</h3>
              <div className="space-y-3">
                <a
                  href="tel:+9718001234567"
                  className="flex items-center gap-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Phone className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Call Us</p>
                    <p className="text-sm text-gray-500">+971 800 123 4567</p>
                  </div>
                </a>

                <a
                  href="mailto:support@homeservice.com"
                  className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Email Us</p>
                    <p className="text-sm text-gray-500">support@homeservice.com</p>
                  </div>
                </a>

                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Live Chat</p>
                    <p className="text-sm text-gray-500">Available 9 AM - 9 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Business Hours */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-nilin-charcoal mb-4">Business Hours</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Saturday - Thursday</p>
                    <p className="font-medium text-gray-900">9:00 AM - 9:00 PM (GST)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Friday</p>
                    <p className="font-medium text-gray-900">2:00 PM - 9:00 PM (GST)</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Response time: Usually within 2 hours during business hours
                </p>
              </div>
            </div>

            {/* Office Location */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-nilin-charcoal mb-4">Office Location</h3>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-700">
                    Homeservice Headquarters
                  </p>
                  <p className="text-sm text-gray-500">
                    Business Bay, Dubai, UAE
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-nilin-charcoal mb-6">Send Us a Message</h2>

              {/* Error Alert */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name & Email Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+971 50 123 4567"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Reason for Contact <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {CONTACT_REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setReason(r.value)}
                        className={cn(
                          'p-3 rounded-xl border text-center transition-all',
                          reason === r.value
                            ? 'border-nilin-coral bg-nilin-coral/10'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <span className="text-xl mb-1 block">{r.icon}</span>
                        <span className={cn(
                          'text-xs font-medium',
                          reason === r.value ? 'text-nilin-coral' : 'text-gray-600'
                        )}>
                          {r.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief summary of your inquiry"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please describe your inquiry in detail..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {message.length}/20 minimum characters
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!isValid || submitting}
                  className={cn(
                    'w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                    isValid && !submitting
                      ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white hover:shadow-lg'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* FAQ Section */}
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-nilin-charcoal mb-4">Frequently Asked Questions</h3>
              <div>
                {FAQ_ITEMS.map((item, index) => (
                  <FAQItem key={index} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
