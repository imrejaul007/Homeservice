import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Ticket,
  MessageCircle,
  Phone,
  HelpCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import PageMeta from '../../components/common/PageMeta';
import { useTranslation } from '../../hooks/useTranslation';
import { TicketList } from '../../components/support/TicketList';
import { TicketForm } from '../../components/support/TicketForm';
import { LiveChat } from '../../components/support/LiveChat';
import { CallbackRequest } from '../../components/support/CallbackRequest';
import { fetchSupportFaqs, type SupportFaq } from '../../services/supportApi';
import { analyticsService } from '../../lib/AnalyticsService';
import { EventCategory, ContactEvent } from '../../lib/eventTaxonomy';

type SupportTab = 'faq' | 'tickets' | 'new-ticket' | 'chat' | 'callback';

interface SupportLocationState {
  tab?: SupportTab;
  bookingId?: string;
  bookingNumber?: string;
  serviceName?: string;
}

const VALID_TABS: SupportTab[] = ['faq', 'tickets', 'new-ticket', 'chat', 'callback'];

const SupportHubPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale, isRTL } = useTranslation();

  const TABS: Array<{ id: SupportTab; label: string; icon: React.ElementType }> = [
    { id: 'faq', label: t('support.tab_faq'), icon: HelpCircle },
    { id: 'tickets', label: t('support.tab_tickets'), icon: Ticket },
    { id: 'new-ticket', label: t('support.tab_new_ticket'), icon: Plus },
    { id: 'chat', label: t('support.tab_chat'), icon: MessageCircle },
    { id: 'callback', label: t('support.tab_callback'), icon: Phone },
  ];
  const tabFromUrl = searchParams.get('tab') as SupportTab | null;
  const [activeTab, setActiveTab] = useState<SupportTab>(
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'faq'
  );
  const [faqs, setFaqs] = useState<SupportFaq[]>([]);
  const [faqLoading, setFaqLoading] = useState(true);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [ticketRefresh, setTicketRefresh] = useState(0);
  const [ticketPrefill, setTicketPrefill] = useState<{
    category?: 'service';
    subject?: string;
    description?: string;
    bookingId?: string;
    bookingNumber?: string;
    serviceName?: string;
  }>({});

  const loadFaqs = () => {
    setFaqLoading(true);
    setFaqError(null);
    fetchSupportFaqs()
      .then(setFaqs)
      .catch(() => setFaqError('Unable to load FAQs. Please try again.'))
      .finally(() => setFaqLoading(false));
  };

  useEffect(() => {
    const state = location.state as SupportLocationState | null;
    if (!state) return;

    if (state.tab) setActiveTab(state.tab);

    if (state.bookingId || state.bookingNumber) {
      const ref = state.bookingNumber
        ? `#${state.bookingNumber.slice(-8).toUpperCase()}`
        : `#${state.bookingId?.slice(-8).toUpperCase()}`;
      setTicketPrefill({
        category: 'service',
        subject: state.serviceName ? `Help with ${state.serviceName}` : `Help with booking ${ref}`,
        description: '',
        bookingId: state.bookingId,
        bookingNumber: state.bookingNumber,
        serviceName: state.serviceName,
      });
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    const urlTab = searchParams.get('tab') as SupportTab | null;
    if (urlTab && VALID_TABS.includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  useEffect(() => {
    analyticsService.track(EventCategory.CONTACT, ContactEvent.PAGE_VIEWED, {
      page: '/customer/support',
    });
    loadFaqs();
  }, []);

  const handleTabChange = (tab: SupportTab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
    analyticsService.track(EventCategory.CONTACT, ContactEvent.SUPPORT_TAB_CHANGED, { tab });
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageMeta title={t('support.page_title')} description={t('support.meta_description')} locale={locale} />
      <NavigationHeader showSearch={false} showCategoryTabs={false} />

      <div className="flex-1 py-8" role="main">
        <div className="max-w-5xl mx-auto px-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-nilin-warmGray hover:text-nilin-charcoal mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>

          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-serif text-nilin-charcoal mb-2">
              {t('support.hub_title')}
            </h1>
            <p className="text-nilin-warmGray">{t('support.hub_subtitle')}</p>
          </div>

          <div
            className="flex flex-wrap gap-2 mb-8 justify-center"
            role="tablist"
            aria-label="Support sections"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => handleTabChange(id)}
                data-testid={`support-tab-${id}`}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-nilin text-sm font-medium transition-all duration-200 ${
                  activeTab === id
                    ? 'bg-nilin-coral text-white shadow-lg shadow-nilin-coral/30'
                    : 'bg-white text-nilin-charcoal border border-nilin-border hover:bg-nilin-blush/30'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="glass-nilin rounded-nilin-lg p-6 md:p-8">
            {activeTab === 'faq' && (
              <div data-testid="support-faq-panel">
                <h2 className="text-xl font-serif text-nilin-charcoal mb-6">{t('support.faq_title')}</h2>
                {faqError ? (
                  <div className="text-center py-6">
                    <p className="text-red-600 mb-3">{faqError}</p>
                    <button
                      onClick={loadFaqs}
                      className="px-4 py-2 bg-nilin-coral text-white rounded-nilin text-sm font-medium"
                    >
                      Retry
                    </button>
                  </div>
                ) : faqLoading ? (
                  <p className="text-nilin-warmGray">{t('support.faq_loading')}</p>
                ) : faqs.length === 0 ? (
                  <p className="text-nilin-warmGray">No FAQs available right now.</p>
                ) : (
                  <div className="space-y-2">
                    {faqs.map((faq) => (
                      <div key={faq.id} className="border border-nilin-border rounded-nilin overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-nilin-blush/20 transition-colors"
                          onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                          aria-expanded={openFaq === faq.id}
                        >
                          <span className="font-medium text-nilin-charcoal pr-4">{faq.question}</span>
                          {openFaq === faq.id ? (
                            <ChevronUp className="w-5 h-5 text-nilin-warmGray flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-nilin-warmGray flex-shrink-0" />
                          )}
                        </button>
                        {openFaq === faq.id && (
                          <p className="px-4 pb-4 text-nilin-warmGray text-sm leading-relaxed">{faq.answer}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-6 text-sm text-nilin-warmGray text-center">
                  {t('support.faq_footer')}{' '}
                  <button onClick={() => handleTabChange('new-ticket')} className="text-nilin-coral hover:text-nilin-rose font-medium">
                    {t('support.create_ticket')}
                  </button>{' '}
                  {t('support.or_contact')}{' '}
                  <a href="/contact" className="text-nilin-coral hover:text-nilin-rose font-medium">/contact</a>
                </p>
              </div>
            )}

            {activeTab === 'tickets' && (
              <div data-testid="support-tickets-panel">
                <TicketList
                  key={ticketRefresh}
                  showCreateButton
                  onCreateTicket={() => handleTabChange('new-ticket')}
                  onSelectTicket={(ticket) =>
                    navigate(`/customer/support/tickets/${ticket._id}`)
                  }
                />
              </div>
            )}

            {activeTab === 'new-ticket' && (
              <div data-testid="support-new-ticket-panel">
                <TicketForm
                  preselectedCategory={ticketPrefill.category}
                  prefilledSubject={ticketPrefill.subject}
                  prefilledDescription={ticketPrefill.description}
                  bookingContext={
                    ticketPrefill.bookingId || ticketPrefill.bookingNumber
                      ? {
                          bookingId: ticketPrefill.bookingId,
                          bookingNumber: ticketPrefill.bookingNumber,
                          serviceName: ticketPrefill.serviceName,
                          displayRef: ticketPrefill.bookingNumber
                            ? `#${ticketPrefill.bookingNumber.slice(-8).toUpperCase()}`
                            : ticketPrefill.bookingId
                              ? `#${ticketPrefill.bookingId.slice(-8).toUpperCase()}`
                              : undefined,
                        }
                      : undefined
                  }
                  onSuccess={() => {
                    setTicketRefresh((n) => n + 1);
                    handleTabChange('tickets');
                  }}
                  onCancel={() => handleTabChange('tickets')}
                />
              </div>
            )}

            {activeTab === 'chat' && (
              <div data-testid="support-chat-panel">
                <LiveChat
                  embedded
                  initialOpen
                  onRequestCallback={() => handleTabChange('callback')}
                />
              </div>
            )}

            {activeTab === 'callback' && (
              <div data-testid="support-callback-panel">
                <CallbackRequest onCancel={() => handleTabChange('faq')} />
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SupportHubPage;
