import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, ArrowRight, Heart, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { subscribeToNewsletter, isValidEmail } from '../../services/newsletterApi';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const services = [
    { name: 'Hair Styling', path: '/category/hair' },
    { name: 'Makeup', path: '/category/makeup' },
    { name: 'Nails', path: '/category/nails' },
    { name: 'Skin & Aesthetics', path: '/category/skin-aesthetics' },
    { name: 'Massage & Body', path: '/category/massage-body' },
    { name: 'Personal Care', path: '/category/personal-care' },
  ];

  const company = [
    { name: 'About Us', path: '/about' },
    { name: 'Home', path: '/' },
    { name: 'Search', path: '/search' },
    { name: 'For Providers', path: '/register/provider' },
  ];

  const support = [
    { name: 'Help Center', path: '/help' },
    { name: 'Contact Us', path: '/contact' },
    { name: 'FAQs', path: '/faq' },
    { name: 'Safety', path: '/safety' },
  ];

  const handleSubscribe = useCallback(async () => {
    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await subscribeToNewsletter(email, 'footer');

      if (result.success) {
        setIsSubscribed(true);
        setEmail('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to subscribe. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubscribe();
    }
  };

  return (
    <footer className="relative bg-[#2D2D2D] mt-auto overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#E8B4A8]/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#D4A89A]/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 relative z-10">
        {/* Top Section with Newsletter */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 pb-12 border-b border-white/10">
          {/* Brand & Description */}
          <div>
            <h2 className="text-4xl md:text-5xl font-serif font-light tracking-tight text-white mb-6">
              NILIN
            </h2>
            <p className="text-white/60 text-base leading-relaxed mb-8 max-w-md">
              Flow of Opportunity. Connecting professionals and clients in a trusted, intelligent ecosystem where skills meet opportunity.
            </p>

            {/* Newsletter Subscription - Improved UI */}
            <div className="max-w-md">
              <p className="text-white/80 text-sm mb-3">Subscribe for updates & exclusive offers</p>

              {isSubscribed ? (
                <div className="flex items-center gap-3 p-4 bg-[#E8B4A8]/20 rounded-xl border border-[#E8B4A8]/30">
                  <div className="w-10 h-10 rounded-full bg-[#E8B4A8] flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">You're subscribed!</p>
                    <p className="text-white/60 text-sm">Check your inbox for a welcome email.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={handleEmailChange}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        className={`w-full px-4 py-3 bg-white/10 backdrop-blur-sm border rounded-xl text-white placeholder-white/40 focus:outline-none focus:bg-white/15 transition-all ${
                          error ? 'border-red-500/60 focus:border-red-500' : 'border-white/20 focus:border-[#E8B4A8]/60'
                        }`}
                        aria-label="Email address"
                        aria-invalid={!!error}
                        aria-describedby={error ? 'newsletter-error' : undefined}
                      />
                    </div>
                    <button
                      onClick={handleSubscribe}
                      disabled={isLoading}
                      className="px-5 py-3 bg-[#E8B4A8] text-white font-medium rounded-xl hover:bg-[#D4A89A] hover:shadow-lg hover:shadow-[#E8B4A8]/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Subscribe</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-sm" id="newsletter-error" role="alert">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <p className="text-white/40 text-xs">
                    By subscribing, you agree to our{' '}
                    <Link to="/privacy" className="text-[#E8B4A8] hover:underline">Privacy Policy</Link>
                    {' '}and{' '}
                    <Link to="/cookies" className="text-[#E8B4A8] hover:underline">Cookie Policy</Link>.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Social Links */}
          <div className="flex flex-wrap items-start gap-4 lg:justify-end">
            {[
              { name: 'Instagram', icon: 'instagram', href: 'https://instagram.com/nilin' },
              { name: 'Twitter', icon: 'twitter', href: 'https://twitter.com/nilin' },
              { name: 'LinkedIn', icon: 'linkedin', href: 'https://linkedin.com/company/nilin' },
              { name: 'TikTok', icon: 'tiktok', href: 'https://tiktok.com/@nilin' },
            ].map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#E8B4A8]/20 hover:border-[#E8B4A8]/30 hover:-translate-y-1 transition-all"
                aria-label={`Follow us on ${social.name}`}
              >
                <SocialIcon name={social.icon} className="w-5 h-5 text-white/60 group-hover:text-[#E8B4A8] transition-colors" />
              </a>
            ))}
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {/* Services */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-[#E8B4A8] rounded-full" />
              Services
            </h3>
            <ul className="space-y-3">
              {services.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className="text-white/50 text-sm hover:text-[#E8B4A8] transition-colors inline-flex items-center gap-2 group"
                  >
                    <span className="w-0 h-0.5 bg-[#E8B4A8] rounded-full group-hover:w-3 transition-all" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-[#E8B4A8] rounded-full" />
              Company
            </h3>
            <ul className="space-y-3">
              {company.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className="text-white/50 text-sm hover:text-[#E8B4A8] transition-colors inline-flex items-center gap-2 group"
                  >
                    <span className="w-0 h-0.5 bg-[#E8B4A8] rounded-full group-hover:w-3 transition-all" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-[#E8B4A8] rounded-full" />
              Support
            </h3>
            <ul className="space-y-3">
              {support.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className="text-white/50 text-sm hover:text-[#E8B4A8] transition-colors inline-flex items-center gap-2 group"
                  >
                    <span className="w-0 h-0.5 bg-[#E8B4A8] rounded-full group-hover:w-3 transition-all" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-[#E8B4A8] rounded-full" />
              Contact
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8B4A8]/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-[#E8B4A8]" />
                </div>
                <div>
                  <p className="text-white/40 text-xs mb-0.5">Phone</p>
                  <p className="text-white text-sm">+971 4 123 4567</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8B4A8]/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-[#E8B4A8]" />
                </div>
                <div>
                  <p className="text-white/40 text-xs mb-0.5">Email</p>
                  <p className="text-white text-sm">hello@nilin.com</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8B4A8]/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-[#E8B4A8]" />
                </div>
                <div>
                  <p className="text-white/40 text-xs mb-0.5">Location</p>
                  <p className="text-white text-sm">Dubai, UAE</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-white/10">
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <span>© {currentYear} NILIN. All rights reserved.</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-[#E8B4A8] fill-[#E8B4A8]" /> in Dubai
            </span>
          </div>
          <div className="flex gap-6">
            <Link
              to="/privacy"
              className="text-white/40 text-sm hover:text-white/80 transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-white/40 text-sm hover:text-white/80 transition-colors"
            >
              Terms
            </Link>
            <Link
              to="/cookies"
              className="text-white/40 text-sm hover:text-white/80 transition-colors"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Social Icon Component
const SocialIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  const icons: Record<string, React.ReactNode> = {
    instagram: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    twitter: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    linkedin: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
      </svg>
    ),
    tiktok: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
  };

  return icons[name] || null;
};

export default Footer;
