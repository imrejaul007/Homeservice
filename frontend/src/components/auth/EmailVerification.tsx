import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { CheckCircle, AlertCircle, Mail, Loader } from 'lucide-react';

const EmailVerification: React.FC = () => {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { verifyEmail, isLoading, user } = useAuthStore();

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setVerificationStatus('error');
        setErrorMessage('Invalid verification token');
        return;
      }

      try {
        await verifyEmail(token);
        setVerificationStatus('success');
        
        // Redirect to appropriate dashboard after a delay
        setTimeout(() => {
          if (user) {
            const dashboardPath = user.role === 'admin' 
              ? '/admin/dashboard' 
              : user.role === 'provider' 
                ? '/provider/dashboard' 
                : '/customer/dashboard';
            navigate(dashboardPath);
          } else {
            navigate('/login', {
              state: {
                message: 'Email verified successfully! Please sign in to continue.'
              }
            });
          }
        }, 3000);
      } catch (error) {
        setVerificationStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Email verification failed');
      }
    };

    performVerification();
  }, [token, verifyEmail, navigate, user]);

  const renderContent = () => {
    switch (verificationStatus) {
      case 'loading':
        return (
          <>
            <div className="flex justify-center">
              <div className="rounded-full bg-blue-100 p-3">
                <Loader className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Verifying your email...
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Please wait while we verify your email address
            </p>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
              <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                </div>
              </div>
            </div>
          </>
        );

      case 'success':
        return (
          <>
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Email Verified Successfully!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your email has been verified. Welcome to our platform!
            </p>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
              <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <div className="text-center space-y-4">
                  <div className="rounded-md bg-green-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-green-800">
                          Your email address has been successfully verified. You now have full access to all platform features.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 space-y-2">
                    <p><strong>What's next?</strong></p>
                    {user ? (
                      <ul className="list-disc list-inside space-y-1 text-left">
                        <li>Explore your personalized dashboard</li>
                        <li>Complete your profile setup</li>
                        {user.role === 'customer' && (
                          <>
                            <li>Browse available services</li>
                            <li>Book your first appointment</li>
                          </>
                        )}
                        {user.role === 'provider' && (
                          <>
                            <li>Set up your business profile</li>
                            <li>Add your services and portfolio</li>
                            <li>Start receiving bookings</li>
                          </>
                        )}
                      </ul>
                    ) : (
                      <p>Please sign in to access your account.</p>
                    )}
                  </div>

                  <div className="text-sm text-gray-500">
                    <p>Redirecting you to your dashboard in a few seconds...</p>
                  </div>

                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>

                  <div className="pt-4">
                    {user ? (
                      <Link
                        to={user.role === 'admin' ? '/admin/dashboard' : user.role === 'provider' ? '/provider/dashboard' : '/customer/dashboard'}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Go to Dashboard
                      </Link>
                    ) : (
                      <Link
                        to="/login"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Sign In
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      case 'error':
        return (
          <>
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 p-3">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Email Verification Failed
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We couldn't verify your email address
            </p>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
              <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <div className="text-center space-y-4">
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-800">
                          {errorMessage || 'The verification link is invalid or has expired.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 space-y-2">
                    <p><strong>Common reasons for verification failure:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-left">
                      <li>The verification link has expired</li>
                      <li>The link has already been used</li>
                      <li>The link is malformed or incomplete</li>
                      <li>Your email has already been verified</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <Link
                      to="/login"
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Try Signing In
                    </Link>

                    <p className="text-sm text-gray-500">
                      If you're still having trouble, you can request a new verification email from the sign-in page.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {renderContent()}
      </div>
    </div>
  );
};

export default EmailVerification;