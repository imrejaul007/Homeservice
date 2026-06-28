import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import CaptchaWidget from './CaptchaWidget';

// Validation schema
const forgotPasswordSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .toLowerCase(),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword: React.FC = () => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  
  const { forgotPassword, isLoading, errors, clearErrors } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting },
    setError,
    watch,
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const watchedEmail = watch('email');

  // Clear errors when email changes
  React.useEffect(() => {
    if (watchedEmail) {
      clearErrors();
    }
  }, [watchedEmail, clearErrors]);

  const onSubmit = async (data: ForgotPasswordForm) => {
    try {
      clearErrors();
      
      await forgotPassword(data.email, captchaToken ?? undefined);
      
      setSubmittedEmail(data.email);
      setIsSuccess(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Request failed');
      if (error.message.toLowerCase().includes('captcha')) {
        setCaptchaRequired(true);
      }
      setError('root', { type: 'server', message: error.message });
    }
  };

  const handleResend = async () => {
    if (submittedEmail) {
      try {
        await forgotPassword(submittedEmail, captchaToken ?? undefined);
      } catch (error) {
        console.error('Resend failed:', error);
      }
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-serif font-light text-nilin-charcoal">
            Check your email
          </h2>
          <p className="mt-2 text-center text-sm text-nilin-warmGray">
            We've sent password reset instructions to
          </p>
          <p className="text-center text-sm font-medium text-nilin-charcoal">
            {submittedEmail}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white/90 backdrop-blur-sm shadow-nilin rounded-xl py-8 px-4 sm:px-10">
            <div className="text-center space-y-4">
              <div className="rounded-xl bg-green-50/80 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">
                      If an account with that email exists, we've sent you a password reset link.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-nilin-warmGray space-y-2">
                <p>
                  <strong className="text-nilin-charcoal">Next steps:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-left">
                  <li>Check your email inbox</li>
                  <li>Click the password reset link</li>
                  <li>Create a new password</li>
                  <li>Sign in with your new password</li>
                </ol>
              </div>

              <div className="text-sm text-nilin-warmGray">
                <p>Didn't receive the email? Check your spam folder.</p>
                <p className="mt-2">
                  Still having trouble?{' '}
                  <button
                    onClick={handleResend}
                    disabled={isLoading}
                    className="font-medium text-nilin-rose hover:text-nilin-coral disabled:opacity-50"
                  >
                    Resend email
                  </button>
                </p>
              </div>

              <div className="pt-4">
                <Link
                  to="/login"
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-nilin-rose to-nilin-coral hover:shadow-lg hover:shadow-nilin-warm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nilin-coral"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-nilin-rose/20 p-3">
            <Mail className="h-8 w-8 text-nilin-rose" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-serif font-light text-nilin-charcoal">
          Forgot your password?
        </h2>
        <p className="mt-2 text-center text-sm text-nilin-warmGray">
          No worries! Enter your email and we'll send you reset instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/90 backdrop-blur-sm shadow-nilin rounded-xl py-8 px-4 sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-nilin-charcoal">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-nilin-warmGray" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-nilin-border rounded-xl placeholder-nilin-warmGray focus:outline-none focus:ring-nilin-coral/30 focus:border-nilin-coral sm:text-sm"
                  placeholder="Enter your email address"
                />
                {formErrors.email && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                )}
              </div>
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-500">{formErrors.email.message}</p>
              )}
            </div>

            <CaptchaWidget onToken={setCaptchaToken} className="mt-4" />

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-nilin-rose to-nilin-coral hover:shadow-lg hover:shadow-nilin-warm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nilin-coral disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting || isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                    Sending instructions...
                  </div>
                ) : (
                  'Send reset instructions'
                )}
              </button>
            </div>

            {/* Error Display */}
            {errors && errors.length > 0 && !formErrors.email && (
              <div className="rounded-xl bg-red-50/80 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-700">
                      Request failed
                    </h3>
                    <div className="mt-2 text-sm text-red-600">
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
          </form>

          {/* Back to Sign In */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-nilin-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-transparent text-nilin-warmGray">Remember your password?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/login"
                className="group w-full flex justify-center items-center py-2.5 px-4 border border-nilin-border rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-cream/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-nilin-coral/30"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to sign in
              </Link>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-xs text-nilin-warmGray">
              Still having trouble? Contact our support team for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;