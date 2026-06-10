import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Headphones, CheckCircle } from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import PageMeta from '../components/common/PageMeta';
import { fetchContactConfig, submitContactForm, type ContactConfig, type ContactSubject } from '../services/contactApi';
import { analyticsService } from '../lib/AnalyticsService';
import { EventCategory, ContactEvent } from '../lib/eventTaxonomy';
import { useTranslation } from '../hooks/useTranslation';
import type { ContactFormData } from '../components/contact/ContactForm';

const ContactForm = lazy(() => import('../components/contact/ContactForm'));
const ContactMethods = lazy(() => import('../components/contact/ContactMethods'));
const ContactInfoPanel = lazy(() => import('../components/contact/ContactInfoPanel'));

const SectionSkeleton = () => (
  <div className="glass-nilin rounded-nilin-lg p-8 animate-pulse h-64" aria-hidden="true" />
);

const DEFAULT_CONFIG: ContactConfig = {
  contact: {
    emails: { general: 'hello@nilin.com', clients: 'support@nilin.com', providers: 'providers@nilin.com' },
    phone: '+971 4 123 4567',
    timezone: 'Asia/Dubai',
    address: {
      name: 'NILIN Headquarters',
      lines: ['Dubai Design District', 'Building 7, Office 301', 'Dubai, UAE'],
      mapsUrl: 'https://maps.google.com/?q=Dubai+Design+District+Building+7+Office+301',
      coordinates: { lat: 25.1851, lng: 55.2796 },
    },
    businessHours: {
      weekdays: { days: 'Sunday - Thursday', hours: '9:00 AM - 6:00 PM' },
      weekend: { days: 'Friday - Saturday', hours: 'Closed' },
      timezone: 'GST (UTC+4)',
    },
    social: [
      { name: 'Instagram', url: 'https://instagram.com/nilin', handle: '@nilin' },
      { name: 'Twitter', url: 'https://twitter.com/nilin', handle: '@nilin' },
      { name: 'LinkedIn', url: 'https://linkedin.com/company/nilin', handle: 'NILIN' },
      { name: 'TikTok', url: 'https://tiktok.com/@nilin', handle: '@nilin' },
    ],
    sla: { firstResponseHours: 24, resolutionHours: 72, urgentFirstResponseHours: 4 },
  },
  isBusinessHoursOpen: true,
  subjectOptions: [],
  departments: [
    { title: 'For Clients', email: 'support@nilin.com', description: 'Booking inquiries, service issues, refunds' },
    { title: 'For Providers', email: 'providers@nilin.com', description: 'Partnership opportunities, technical support' },
    { title: 'General Inquiries', email: 'hello@nilin.com', description: 'Partnerships, press, media' },
  ],
};

const ContactPage: React.FC = () => {
  const { t, locale, isRTL } = useTranslation();
  const track = analyticsService.track.bind(analyticsService);
  const [config, setConfig] = useState<ContactConfig>(DEFAULT_CONFIG);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '', email: '', subject: '', message: '', website: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formStarted, setFormStarted] = useState(false);

  useEffect(() => {
    track(EventCategory.CONTACT, ContactEvent.PAGE_VIEWED, { page: '/contact' });
    const region = locale === 'ar' ? 'AE' : locale === 'hi' ? 'IN' : undefined;
    fetchContactConfig(region).then((data) => { if (data) setConfig(data); });
  }, [locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!formStarted) {
      setFormStarted(true);
      track(EventCategory.CONTACT, ContactEvent.FORM_STARTED, { page: '/contact' });
    }
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleEmailClick = useCallback((email: string, type: string) => {
    track(EventCategory.CONTACT, ContactEvent.EMAIL_CLICKED, { email, type });
  }, []);

  const handlePhoneClick = useCallback(() => {
    track(EventCategory.CONTACT, ContactEvent.PHONE_CLICKED, { phone: config.contact.phone });
  }, [config.contact.phone]);

  const handleChatClick = useCallback(() => {
    track(EventCategory.CONTACT, ContactEvent.CHAT_OPENED, { source: 'contact_page' });
    window.dispatchEvent(new CustomEvent('nilin:open-chat'));
  }, []);

  const handleSocialClick = useCallback((platform: string, url: string) => {
    track(EventCategory.CONTACT, ContactEvent.SOCIAL_CLICKED, { platform, url });
  }, []);

  const handleMapsClick = useCallback(() => {
    track(EventCategory.CONTACT, ContactEvent.MAPS_CLICKED, { source: 'visit_us' });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitContactForm({
        name: formData.name,
        email: formData.email,
        subject: formData.subject as ContactSubject,
        message: formData.message,
        website: formData.website,
      });
      setSubmissionId(result.submissionId);
      setSubmitted(true);
      track(EventCategory.CONTACT, ContactEvent.FORM_SUBMITTED, {
        submissionId: result.submissionId,
        department: result.department,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
      track(EventCategory.CONTACT, ContactEvent.FORM_ERROR, { error: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        <PageMeta title={t('contact.page_title')} description={t('contact.meta_description')} locale={locale} />
        <NavigationHeader showSearch={false} showCategoryTabs={false} />
        <div className="flex-1 py-12" role="main">
          <div className="max-w-lg mx-auto px-4 text-center" aria-live="polite" data-testid="contact-success">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-6" aria-hidden="true" />
            <h1 className="text-3xl font-serif text-nilin-charcoal mb-4">{t('contact.success_title')}</h1>
            <p className="text-nilin-warmGray mb-2">
              {t('contact.success_body', { hours: config.contact.sla.firstResponseHours })}
            </p>
            {submissionId && (
              <p className="text-sm text-nilin-coral font-medium mb-8">{t('contact.reference', { id: submissionId })}</p>
            )}
            <button onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', subject: '', message: '', website: '' }); setFormStarted(false); }} className="px-6 py-3 border border-nilin-border text-nilin-charcoal rounded-nilin hover:bg-nilin-blush/30">
              {t('contact.send_another')}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageMeta title={t('contact.page_title')} description={t('contact.meta_description')} locale={locale} />
      <a href="#contact-form-section" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-nilin">
        {t('contact.skip_to_form')}
      </a>
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-12" role="main">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
              <Headphones className="w-8 h-8 text-nilin-coral" aria-hidden="true" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-nilin-charcoal mb-4">{t('contact.hero_title')}</h1>
            <p className="text-lg text-nilin-warmGray max-w-xl mx-auto">{t('contact.hero_subtitle')}</p>
          </div>

          <Suspense fallback={<SectionSkeleton />}>
            <ContactMethods config={config} onEmailClick={handleEmailClick} onPhoneClick={handlePhoneClick} onChatClick={handleChatClick} t={t} />
          </Suspense>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Suspense fallback={<SectionSkeleton />}>
              <ContactForm formData={formData} isSubmitting={isSubmitting} error={error} onChange={handleChange} onSubmit={handleSubmit} t={t} />
            </Suspense>
            <Suspense fallback={<SectionSkeleton />}>
              <ContactInfoPanel config={config} onEmailClick={handleEmailClick} onMapsClick={handleMapsClick} onSocialClick={handleSocialClick} t={t} />
            </Suspense>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ContactPage;
