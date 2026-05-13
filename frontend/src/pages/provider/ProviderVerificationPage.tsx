import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  CheckCircle,
  Clock,
  AlertCircle,
  Upload,
  FileText,
  Camera,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  XCircle,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

interface VerificationDocument {
  id: string;
  type: 'id' | 'license' | 'certificate' | 'address';
  name: string;
  status: 'pending' | 'approved' | 'rejected' | 'missing';
  uploadedAt?: Date;
  verifiedAt?: Date;
  rejectionReason?: string;
  fileUrl?: string;
}

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  documents?: VerificationDocument[];
}

const ProviderVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, providerProfile } = useAuthStore();

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([
    {
      id: 'identity',
      title: 'Identity Verification',
      description: 'Verify your personal identity with a valid government-issued ID',
      status: providerProfile?.isVerified ? 'completed' : 'pending',
      documents: [
        {
          id: 'emirates_id',
          type: 'id',
          name: 'Emirates ID / Passport',
          status: providerProfile?.isVerified ? 'approved' : 'missing',
          verifiedAt: providerProfile?.isVerified ? new Date() : undefined,
        },
      ],
    },
    {
      id: 'professional',
      title: 'Professional Credentials',
      description: 'Upload your professional licenses and certifications',
      status: 'pending',
      documents: [
        {
          id: 'trade_license',
          type: 'license',
          name: 'Trade License (Dubai Economy)',
          status: 'missing',
        },
        {
          id: 'dha_license',
          type: 'license',
          name: 'DHA/DHA Certificate (if applicable)',
          status: 'missing',
        },
      ],
    },
    {
      id: 'background',
      title: 'Background Check',
      description: 'Consent to a background check for customer safety',
      status: 'pending',
    },
    {
      id: 'address',
      title: 'Address Verification',
      description: 'Verify your current residential or business address',
      status: 'pending',
      documents: [
        {
          id: 'utility_bill',
          type: 'address',
          name: 'Utility Bill ( Ejari / DEWA)',
          status: 'missing',
        },
      ],
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Calculate overall progress
  const completedSteps = verificationSteps.filter((s) => s.status === 'completed').length;
  const overallProgress = (completedSteps / verificationSteps.length) * 100;

  const handleFileUpload = async (stepId: string, documentId: string, file: File) => {
    setUploadProgress({ ...uploadProgress, [documentId]: 0 });

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        const current = prev[documentId] || 0;
        if (current >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return { ...prev, [documentId]: current + 10 };
      });
    }, 200);

    // Simulate API call
    setTimeout(() => {
      clearInterval(progressInterval);
      setUploadProgress({ ...uploadProgress, [documentId]: 100 });

      // Update document status
      setVerificationSteps((steps) =>
        steps.map((step) => {
          if (step.id !== stepId) return step;
          return {
            ...step,
            status: 'in_progress',
            documents: step.documents?.map((doc) => {
              if (doc.id !== documentId) return doc;
              return {
                ...doc,
                status: 'pending',
                uploadedAt: new Date(),
                fileUrl: URL.createObjectURL(file),
              };
            }),
          };
        })
      );

      setTimeout(() => {
        setUploadProgress({});
      }, 500);
    }, 2000);
  };

  const handleSubmitForReview = async () => {
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      alert('Your verification documents have been submitted for review. You will be notified once the review is complete.');
    }, 1500);
  };

  const getStepStatus = (status: VerificationStep['status']) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Verified</span>
          </div>
        );
      case 'in_progress':
        return (
          <div className="flex items-center gap-2 text-yellow-600">
            <Clock className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-medium">In Review</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Failed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-nilin-warmGray">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Pending</span>
          </div>
        );
    }
  };

  const getDocumentStatus = (status: VerificationDocument['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
            <Clock className="h-3 w-3 animate-pulse" />
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full flex items-center gap-1">
            <Upload className="h-3 w-3" />
            Required
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <div className="flex items-center gap-4">
              <div className="p-3 bg-nilin-coral/10 rounded-full">
                <Shield className="h-8 w-8 text-nilin-coral" />
              </div>
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Provider Verification</h1>
                <p className="text-nilin-warmGray">
                  Complete your verification to build trust with customers
                </p>
              </div>
            </div>
          </div>

          {/* Verification Status Banner */}
          {providerProfile?.isVerified ? (
            <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-nilin-lg flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <BadgeCheck className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-green-900">Verification Complete</h2>
                <p className="text-sm text-green-700">
                  Your provider account has been verified. You now have access to all platform features and a verified badge will be displayed on your profile.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-nilin-lg flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-yellow-900">Verification In Progress</h2>
                <p className="text-sm text-yellow-700">
                  Complete all verification steps to get your verified badge and start receiving bookings.
                </p>
              </div>
            </div>
          )}

          {/* Progress Overview */}
          <div className="mb-8 glass-nilin rounded-nilin-lg p-6 hover-lift">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif text-nilin-charcoal">Verification Progress</h2>
              <span className="text-sm font-medium text-nilin-coral">
                {completedSteps} of {verificationSteps.length} steps completed
              </span>
            </div>
            <div className="h-3 bg-nilin-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Verification Steps */}
          <div className="space-y-6">
            {verificationSteps.map((step, index) => (
              <div
                key={step.id}
                className={`glass-nilin rounded-nilin-lg p-6 hover-lift transition-all ${
                  step.status === 'completed' ? 'border-l-4 border-l-green-500' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        step.status === 'completed'
                          ? 'bg-green-100 text-green-600'
                          : step.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-nilin-muted text-nilin-warmGray'
                      }`}
                    >
                      {step.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-nilin-charcoal">{step.title}</h3>
                      <p className="text-sm text-nilin-warmGray mt-1">{step.description}</p>
                    </div>
                  </div>
                  {getStepStatus(step.status)}
                </div>

                {/* Documents List */}
                {step.documents && step.documents.length > 0 && (
                  <div className="ml-14 space-y-3">
                    {step.documents.map((document) => (
                      <div
                        key={document.id}
                        className="flex items-center justify-between p-4 bg-nilin-muted/30 rounded-nilin"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-nilin ${
                            document.status === 'approved'
                              ? 'bg-green-100'
                              : document.status === 'pending'
                              ? 'bg-yellow-100'
                              : 'bg-white'
                          }`}>
                            <FileText className={`h-4 w-4 ${
                              document.status === 'approved'
                                ? 'text-green-600'
                                : document.status === 'pending'
                                ? 'text-yellow-600'
                                : 'text-nilin-warmGray'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium text-nilin-charcoal">{document.name}</p>
                            {document.uploadedAt && (
                              <p className="text-xs text-nilin-warmGray">
                                Uploaded: {document.uploadedAt.toLocaleDateString()}
                              </p>
                            )}
                            {document.rejectionReason && (
                              <p className="text-xs text-red-600 mt-1">
                                Reason: {document.rejectionReason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {getDocumentStatus(document.status)}

                          {document.status === 'missing' && (
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileUpload(step.id, document.id, file);
                                  }
                                }}
                              />
                              <span className="px-4 py-2 bg-nilin-coral text-white text-sm font-medium rounded-nilin hover:bg-nilin-rose transition-colors flex items-center gap-2">
                                <Upload className="h-4 w-4" />
                                Upload
                              </span>
                            </label>
                          )}

                          {uploadProgress[document.id] !== undefined && (
                            <div className="w-24">
                              <div className="h-2 bg-nilin-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-nilin-coral rounded-full transition-all"
                                  style={{ width: `${uploadProgress[document.id]}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Background Check Consent */}
                {step.id === 'background' && (
                  <div className="ml-14">
                    <button className="px-6 py-3 bg-nilin-coral text-white font-medium rounded-nilin hover:bg-nilin-rose transition-colors flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Consent to Background Check
                    </button>
                    <p className="text-xs text-nilin-warmGray mt-2">
                      By consenting, you authorize NILIN to perform a background check for the safety of our customers.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submit Button */}
          {!providerProfile?.isVerified && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleSubmitForReview}
                disabled={isSubmitting || completedSteps < verificationSteps.length}
                className="btn-nilin px-8 py-4 text-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <BadgeCheck className="h-5 w-5" />
                    Submit for Verification Review
                  </>
                )}
              </button>
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 glass-nilin rounded-nilin-lg p-6 hover-lift">
            <h3 className="text-sm font-medium text-nilin-charcoal mb-4">Why Verification Matters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-nilin-coral/10 rounded-nilin">
                  <Shield className="h-5 w-5 text-nilin-coral" />
                </div>
                <div>
                  <p className="font-medium text-nilin-charcoal">Build Trust</p>
                  <p className="text-sm text-nilin-warmGray">
                    Verified providers earn customer trust and receive more booking requests.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-nilin-coral/10 rounded-nilin">
                  <BadgeCheck className="h-5 w-5 text-nilin-coral" />
                </div>
                <div>
                  <p className="font-medium text-nilin-charcoal">Verified Badge</p>
                  <p className="text-sm text-nilin-warmGray">
                    Stand out with a verified badge on your profile and in search results.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-nilin-coral/10 rounded-nilin">
                  <Clock className="h-5 w-5 text-nilin-coral" />
                </div>
                <div>
                  <p className="font-medium text-nilin-charcoal">Priority Support</p>
                  <p className="text-sm text-nilin-warmGray">
                    Verified providers get access to priority customer support.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProviderVerificationPage;
