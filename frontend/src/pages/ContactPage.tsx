import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, MessageCircle, Users, Headphones, CheckCircle } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));

    setSubmitted(true);
    setIsSubmitting(false);
  };

  const contactMethods = [
    {
      icon: Mail,
      title: 'Email Us',
      value: 'hello@nilin.com',
      description: 'We respond within 24 hours',
      color: 'bg-nilin-blush',
    },
    {
      icon: Phone,
      title: 'Call Us',
      value: '+971 4 123 4567',
      description: 'Sun-Thu, 9am-6pm GST',
      color: 'bg-nilin-peach',
    },
    {
      icon: MessageCircle,
      title: 'Live Chat',
      value: 'Available 24/7',
      description: 'Instant support on the app',
      color: 'bg-nilin-blush',
    },
  ];

  const departments = [
    {
      icon: Users,
      title: 'For Clients',
      email: 'support@nilin.com',
      description: 'Booking inquiries, service issues, refunds',
    },
    {
      icon: Headphones,
      title: 'For Providers',
      email: 'providers@nilin.com',
      description: 'Partnership opportunities, technical support',
    },
    {
      icon: Mail,
      title: 'General Inquiries',
      email: 'hello@nilin.com',
      description: 'Partnerships, press, media',
    },
  ];

  if (submitted) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader showSearch={false} showCategoryTabs={false} />
        <div className="flex-1 py-12">
          <div className="max-w-lg mx-auto px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-nilin-scale">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-serif text-nilin-charcoal mb-4">Message Sent!</h1>
            <p className="text-nilin-warmGray mb-8">
              Thank you for reaching out. We have received your message and will get back to you within 24 hours.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setFormData({ name: '', email: '', subject: '', message: '' });
              }}
              className="px-6 py-3 border border-nilin-border text-nilin-charcoal rounded-nilin hover:bg-nilin-blush/30 transition-all duration-200"
            >
              Send Another Message
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
              <Headphones className="w-8 h-8 text-nilin-coral" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-4">
              Contact Us
            </h1>
            <p className="text-lg text-nilin-warmGray max-w-xl mx-auto">
              Have a question or feedback? We would love to hear from you.
            </p>
          </div>

          {/* Quick Contact Methods */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {contactMethods.map((method, index) => (
              <div
                key={index}
                className="glass-nilin rounded-nilin-lg p-6 text-center hover:shadow-nilin-warm transition-all duration-200"
              >
                <div className={`w-12 h-12 rounded-full ${method.color} flex items-center justify-center mx-auto mb-4`}>
                  <method.icon className="w-6 h-6 text-nilin-rose" />
                </div>
                <h3 className="font-medium text-nilin-charcoal mb-1">{method.title}</h3>
                <p className="text-nilin-coral font-medium">{method.value}</p>
                <p className="text-sm text-nilin-warmGray mt-1">{method.description}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact Form */}
            <div className="glass-nilin rounded-nilin-lg p-8">
              <h2 className="text-2xl font-serif text-nilin-charcoal mb-6">Send us a message</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Sarah Al Maktoum"
                    className="w-full px-4 py-3 bg-white border border-nilin-border rounded-nilin text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral transition-all duration-200"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="sarah@example.com"
                    className="w-full px-4 py-3 bg-white border border-nilin-border rounded-nilin text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral transition-all duration-200"
                  />
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-white border border-nilin-border rounded-nilin text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral transition-all duration-200"
                  >
                    <option value="">Select a topic</option>
                    <option value="booking">Booking Issue</option>
                    <option value="payment">Payment Inquiry</option>
                    <option value="refund">Refund Request</option>
                    <option value="provider">Provider Feedback</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder="Tell us how we can help..."
                    className="w-full px-4 py-3 bg-white border border-nilin-border rounded-nilin text-nilin-charcoal placeholder:text-nilin-lightGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral transition-all duration-200 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-nilin-coral text-white rounded-nilin font-medium hover:bg-nilin-rose transition-all duration-200 shadow-lg shadow-nilin-coral/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Contact Information */}
            <div className="space-y-6">
              {/* Office Location */}
              <div className="glass-nilin rounded-nilin-lg p-8">
                <h2 className="text-2xl font-serif text-nilin-charcoal mb-6">Visit Us</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-nilin-blush flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-nilin-rose" />
                    </div>
                    <div>
                      <p className="font-medium text-nilin-charcoal">Office Address</p>
                      <p className="text-nilin-warmGray">
                        NILIN Headquarters<br />
                        Dubai Design District<br />
                        Building 7, Office 301<br />
                        Dubai, UAE
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-nilin-blush flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-nilin-rose" />
                    </div>
                    <div>
                      <p className="font-medium text-nilin-charcoal">Business Hours</p>
                      <p className="text-nilin-warmGray">
                        Sunday - Thursday: 9:00 AM - 6:00 PM<br />
                        Friday - Saturday: Closed
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Contacts */}
              <div className="glass-nilin rounded-nilin-lg p-8">
                <h2 className="text-2xl font-serif text-nilin-charcoal mb-6">Department Contacts</h2>
                <div className="space-y-4">
                  {departments.map((dept, index) => (
                    <div key={index} className="p-4 bg-nilin-blush/30 rounded-nilin">
                      <div className="flex items-center gap-3 mb-2">
                        <dept.icon className="w-5 h-5 text-nilin-coral" />
                        <p className="font-medium text-nilin-charcoal">{dept.title}</p>
                      </div>
                      <p className="text-sm text-nilin-warmGray mb-2">{dept.description}</p>
                      <a href={`mailto:${dept.email}`} className="text-sm text-nilin-coral hover:text-nilin-rose transition-colors">
                        {dept.email}
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div className="glass-nilin rounded-nilin-lg p-8">
                <h2 className="text-xl font-serif text-nilin-charcoal mb-4">Follow Us</h2>
                <p className="text-nilin-warmGray mb-4">Stay connected for updates and beauty tips.</p>
                <div className="flex gap-3">
                  {[
                    { name: 'Instagram', url: 'https://instagram.com/nilin' },
                    { name: 'Twitter', url: 'https://twitter.com/nilin' },
                    { name: 'LinkedIn', url: 'https://linkedin.com/company/nilin' },
                    { name: 'TikTok', url: 'https://tiktok.com/@nilin' }
                  ].map((social) => (
                    <a
                      key={social.name}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-nilin-blush flex items-center justify-center text-nilin-rose hover:bg-nilin-coral hover:text-white transition-all duration-200"
                      aria-label={`Follow us on ${social.name}`}
                    >
                      <span className="text-xs font-medium">{social.name[0]}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ContactPage;
