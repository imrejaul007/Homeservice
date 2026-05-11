import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Mail, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

const EmailVerificationRequired: React.FC = () => {
  const [isResendSuccess, setIsResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const { user, resendVerification, logout, isLoading, errors, clearErrors } = useAuthStore();

  const handleResendVerification = async () => {
    if (!user?.email || resendCooldown > 0) return;

    try {
      clearErrors();
      await resendVerification(user.email);
      setIsResendSuccess(true);
      
      // Start cooldown timer (60 seconds)
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Hide success message after 5 seconds
      setTimeout(() => {
        setIsResendSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Failed to resend verification:', error);
    }
  };

  const handleSignOut = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-yellow-100 p-3">
            <Mail className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Email Verification Required
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please verify your email address to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            {/* User Info */}
            <div className="text-center">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Mail className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      We've sent a verification email to:
                    </p>
                    <p className="text-sm font-medium text-blue-900 mt-1">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="text-sm text-gray-600 space-y-3">
              <p><strong>To verify your email:</strong></p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Check your email inbox (and spam/junk folder)</li>
                <li>Open the email from us</li>
                <li>Click the verification link in the email</li>
                <li>Return here or sign in again</li>
              </ol>
            </div>

            {/* Success Message */}
            {isResendSuccess && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      Verification email sent successfully! Please check your inbox.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errors && errors.length > 0 && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Failed to send verification email
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <ul className="list-disc list-inside space-y-1">
                        {errors.map((error, index) => (
                          <li key={index}>{error.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Resend Button */}
              <button
                onClick={handleResendVerification}
                disabled={isLoading || resendCooldown > 0}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resend in {resendCooldown}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resend Verification Email
                  </>
                )}
              </button>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign out and try with different email
              </button>
            </div>

            {/* Help Text */}
            <div className="text-center">
              <div className="text-sm text-gray-500 space-y-2">
                <p><strong>Still not receiving emails?</strong></p>
                <ul className="text-xs space-y-1">
                  <li>• Check your spam/junk folder</li>
                  <li>• Make sure {user?.email} is correct</li>
                  <li>• Add our email to your contacts</li>
                  <li>• Try signing up with a different email</li>
                </ul>
              </div>
            </div>

            {/* Contact Support */}
            <div className="text-center border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500">
                Having trouble?{' '}
                <Link 
                  to="/support" 
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Contact Support
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationRequired;