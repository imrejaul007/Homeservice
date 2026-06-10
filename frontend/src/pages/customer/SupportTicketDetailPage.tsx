import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import { TicketDetail } from '../../components/support/TicketDetail';

const SupportTicketDetailPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  if (!ticketId) {
    navigate('/customer/support');
    return null;
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <button
            onClick={() => navigate('/customer/support')}
            className="flex items-center gap-2 text-nilin-warmGray hover:text-nilin-charcoal mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Support
          </button>
          <TicketDetail
            ticketId={ticketId}
            onBack={() => navigate('/customer/support')}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SupportTicketDetailPage;
