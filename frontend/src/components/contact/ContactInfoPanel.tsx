import React from 'react';
import { MapPin, Clock, Users, Headphones, Mail } from 'lucide-react';
import type { ContactConfig } from '../../services/contactApi';
import SocialIcon from './SocialIcon';

interface ContactInfoPanelProps {
  config: ContactConfig;
  onEmailClick: (email: string, type: string) => void;
  onMapsClick: () => void;
  onSocialClick: (platform: string, url: string) => void;
  t: (key: string) => string;
}

export const ContactInfoPanel: React.FC<ContactInfoPanelProps> = ({
  config,
  onEmailClick,
  onMapsClick,
  onSocialClick,
  t,
}) => (
  <div className="space-y-6">
    <div className="glass-nilin rounded-nilin-lg p-8">
      <h2 className="text-2xl font-serif text-nilin-charcoal mb-6">{t('contact.visit_us')}</h2>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-nilin-blush flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-nilin-rose" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-nilin-charcoal">{t('contact.office_address')}</p>
            <address className="text-nilin-warmGray not-italic">
              {config.contact.address.name}
              <br />
              {config.contact.address.lines.map((line) => (
                <React.Fragment key={line}>{line}<br /></React.Fragment>
              ))}
            </address>
            <a href={config.contact.address.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-nilin-coral hover:text-nilin-rose mt-2 inline-block" onClick={onMapsClick}>
              {t('contact.get_directions')}
            </a>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-nilin-blush flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-nilin-rose" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-nilin-charcoal">
              {t('contact.business_hours')}
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${config.isBusinessHoursOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {config.isBusinessHoursOpen ? t('contact.open') : t('contact.closed')}
              </span>
            </p>
            <p className="text-nilin-warmGray">
              {config.contact.businessHours.weekdays.days}: {config.contact.businessHours.weekdays.hours}
              <br />
              {config.contact.businessHours.weekend.days}: {config.contact.businessHours.weekend.hours}
            </p>
            {'businessHoursStatus' in config && config.businessHoursStatus && (
              <p className="text-xs text-nilin-warmGray mt-1">{config.businessHoursStatus as string}</p>
            )}
          </div>
        </div>
      </div>
    </div>

    <div className="glass-nilin rounded-nilin-lg p-8">
      <h2 className="text-2xl font-serif text-nilin-charcoal mb-6">{t('contact.department_contacts')}</h2>
      <div className="space-y-4">
        {config.departments.map((dept, index) => (
          <div key={index} className="p-4 bg-nilin-blush/30 rounded-nilin">
            <div className="flex items-center gap-3 mb-2">
              {index === 0 && <Users className="w-5 h-5 text-nilin-coral" aria-hidden="true" />}
              {index === 1 && <Headphones className="w-5 h-5 text-nilin-coral" aria-hidden="true" />}
              {index === 2 && <Mail className="w-5 h-5 text-nilin-coral" aria-hidden="true" />}
              <p className="font-medium text-nilin-charcoal">{dept.title}</p>
            </div>
            <p className="text-sm text-nilin-warmGray mb-2">{dept.description}</p>
            <a href={`mailto:${dept.email}`} className="text-sm text-nilin-coral hover:text-nilin-rose" onClick={() => onEmailClick(dept.email, dept.title)}>
              {dept.email}
            </a>
          </div>
        ))}
      </div>
    </div>

    <div className="glass-nilin rounded-nilin-lg p-8">
      <h2 className="text-xl font-serif text-nilin-charcoal mb-4">{t('contact.follow_us')}</h2>
      <p className="text-nilin-warmGray mb-4">{t('contact.follow_desc')}</p>
      <div className="flex gap-3">
        {config.contact.social.map((social) => (
          <a
            key={social.name}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-nilin-blush flex items-center justify-center text-nilin-rose hover:bg-nilin-coral hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-nilin-coral/40"
            aria-label={`Follow us on ${social.name}`}
            onClick={() => onSocialClick(social.name, social.url)}
          >
            <SocialIcon platform={social.name as 'Instagram' | 'Twitter' | 'LinkedIn' | 'TikTok'} />
          </a>
        ))}
      </div>
    </div>
  </div>
);

export default ContactInfoPanel;
