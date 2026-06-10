import React from 'react';
import { Send, AlertCircle } from 'lucide-react';
import type { ContactSubject } from '../../services/contactApi';

export interface ContactFormData {
  name: string;
  email: string;
  subject: ContactSubject | '';
  message: string;
  website: string;
}

interface ContactFormProps {
  formData: ContactFormData;
  isSubmitting: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  formData,
  isSubmitting,
  error,
  onChange,
  onSubmit,
  t,
}) => (
  <div className="glass-nilin rounded-nilin-lg p-8" id="contact-form-section">
    <h2 className="text-2xl font-serif text-nilin-charcoal mb-6">{t('contact.send_message')}</h2>

    {error && (
      <div role="alert" aria-live="assertive" className="mb-4 p-4 bg-red-50 border border-red-200 rounded-nilin flex items-start gap-3" data-testid="contact-form-error">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )}

    <form onSubmit={onSubmit} className="space-y-5" data-testid="contact-form" noValidate>
      <div className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="website">{t('contact.message')}</label>
        <input type="text" id="website" name="website" value={formData.website} onChange={onChange} tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-nilin-charcoal mb-2">
          {t('contact.your_name')} <span className="text-nilin-coral" aria-hidden="true">*</span>
        </label>
        <input type="text" id="name" name="name" value={formData.name} onChange={onChange} required minLength={2} maxLength={100} data-testid="contact-name" className="w-full px-4 py-3 bg-white border border-nilin-border rounded-nilin text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral" />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-nilin-charcoal mb-2">
          {t('contact.email_address')} <span className="text-nilin-coral" aria-hidden="true">*</span>
        </label>
        <input type="email" id="email" name="email" value={formData.email} onChange={onChange} required data-testid="contact-email" className="w-full px-4 py-3 bg-white border border-nilin-border rounded-nilin text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral" />
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-nilin-charcoal mb-2">
          {t('contact.subject')} <span className="text-nilin-coral" aria-hidden="true">*</span>
        </label>
        <select id="subject" name="subject" value={formData.subject} onChange={onChange} required data-testid="contact-subject" className="w-full px-4 py-3 bg-white border border-nilin-border rounded-nilin text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral">
          <option value="">{t('contact.select_topic')}</option>
          <option value="booking">{t('contact.subject_booking')}</option>
          <option value="payment">{t('contact.subject_payment')}</option>
          <option value="refund">{t('contact.subject_refund')}</option>
          <option value="provider">{t('contact.subject_provider')}</option>
          <option value="suggestion">{t('contact.subject_suggestion')}</option>
          <option value="other">{t('contact.subject_other')}</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-nilin-charcoal mb-2">
          {t('contact.message')} <span className="text-nilin-coral" aria-hidden="true">*</span>
        </label>
        <textarea id="message" name="message" value={formData.message} onChange={onChange} required minLength={20} maxLength={5000} rows={5} data-testid="contact-message" className="w-full px-4 py-3 bg-white border border-nilin-border rounded-nilin text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral resize-none" />
        <p className="text-xs text-nilin-warmGray mt-1">{t('contact.char_count', { count: formData.message.length })}</p>
      </div>

      <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} data-testid="contact-submit" className="w-full py-3 bg-nilin-coral text-white rounded-nilin font-medium hover:bg-nilin-rose transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2">
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label={t('contact.sending')} />
            <span>{t('contact.sending')}</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" aria-hidden="true" />
            {t('contact.send_button')}
          </>
        )}
      </button>
    </form>
  </div>
);

export default ContactForm;
