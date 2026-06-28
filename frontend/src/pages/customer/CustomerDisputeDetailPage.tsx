import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import { DisputeDetail } from '../../components/support/DisputeDetail';

const CustomerDisputeDetailPage: React.FC = () => {
  const { disputeId } = useParams<{ disputeId: string }>();
  const navigate = useNavigate();

  if (!disputeId) {
    navigate('/customer/my-claims');
    return null;
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader showSearch={false} showCategoryTabs={false} />
      <div className="flex-1 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <button
            onClick={() => navigate('/customer/my-claims')}
            className="flex items-center gap-2 text-nilin-warmGray hover:text-nilin-charcoal mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Claims
          </button>
          <DisputeDetail
            disputeId={disputeId}
            onBack={() => navigate('/customer/my-claims')}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CustomerDisputeDetailPage;
