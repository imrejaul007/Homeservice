import React from 'react';
import { Mail, Phone, MessageCircle } from 'lucide-react';
import type { ContactConfig } from '../../services/contactApi';

interface ContactMethodsProps {
  config: ContactConfig;
  onEmailClick: (email: string, type: string) => void;
  onPhoneClick: () => void;
  onChatClick: () => void;
  t: (key: string) => string;
}

export const ContactMethods: React.FC<ContactMethodsProps> = ({
  config,
  onEmailClick,
  onPhoneClick,
  onChatClick,
  t,
}) => {
  const methods = [
    {
      icon: Mail,
      title: t('contact.email_us'),
      value: config.contact.emails.general,
      description: t('contact.email_response'),
      href: `mailto:${config.contact.emails.general}`,
      onClick: () => onEmailClick(config.contact.emails.general, 'general'),
      testId: 'contact-email-method',
    },
    {
      icon: Phone,
      title: t('contact.call_us'),
      value: config.contact.phone,
      description: config.isBusinessHoursOpen ? t('contact.call_hours_open') : t('contact.call_hours_closed'),
      href: `tel:${config.contact.phone.replace(/\s/g, '')}`,
      onClick: onPhoneClick,
      testId: 'contact-phone-method',
    },
    {
      icon: MessageCircle,
      title: t('contact.live_chat'),
      value: t('contact.chat_available'),
      description: t('contact.chat_description'),
      onClick: onChatClick,
      testId: 'contact-chat-method',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
      {methods.map((method, index) => {
        const Wrapper = method.href ? 'a' : 'button';
        const wrapperProps = method.href
          ? { href: method.href, onClick: method.onClick }
          : { type: 'button' as const, onClick: method.onClick };

        return (
          <Wrapper
            key={index}
            {...wrapperProps}
            data-testid={method.testId}
            className="glass-nilin rounded-nilin-lg p-6 text-center hover:shadow-nilin-warm transition-all duration-200 block w-full focus:outline-none focus:ring-2 focus:ring-nilin-coral/40"
          >
            <div className="w-12 h-12 rounded-full bg-nilin-blush flex items-center justify-center mx-auto mb-4">
              <method.icon className="w-6 h-6 text-nilin-rose" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-nilin-charcoal mb-1">{method.title}</h3>
            <p className="text-nilin-coral font-medium">{method.value}</p>
            <p className="text-sm text-nilin-warmGray mt-1">{method.description}</p>
          </Wrapper>
        );
      })}
    </div>
  );
};

export default ContactMethods;
