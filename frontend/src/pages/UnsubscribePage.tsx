import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';

const UnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. No token provided.');
      return;
    }

    api.get('/auth/unsubscribe', { params: { token } })
      .then((response) => {
        setStatus('success');
        setMessage(response.data.message || 'You have been unsubscribed successfully.');
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Failed to process unsubscribe request.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full glass-nilin rounded-nilin-lg p-8 text-center" aria-live="polite" aria-atomic="true">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-nilin-coral animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-serif text-nilin-charcoal mb-2">Processing...</h1>
              <p className="text-nilin-warmGray">Updating your email preferences</p>
            </>
          )}
          {status === 'success' && (
            <>
              <Check className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h1 className="text-xl font-serif text-nilin-charcoal mb-2">Unsubscribed</h1>
              <p className="text-nilin-warmGray mb-6">{message}</p>
              <Link to="/customer/profile?tab=settings" className="btn-nilin inline-block px-6 py-2">
                Manage Preferences
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h1 className="text-xl font-serif text-nilin-charcoal mb-2">Unable to Unsubscribe</h1>
              <p className="text-nilin-warmGray mb-6">{message}</p>
              <Link to="/customer/profile?tab=settings" className="btn-nilin inline-block px-6 py-2">
                Manage Preferences
              </Link>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default UnsubscribePage;
