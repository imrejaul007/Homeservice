import React, { useState, useEffect, useCallback } from 'react';
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
  Loader2,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import ProviderHubNav from '../../components/provider/ProviderHubNav';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { useToast } from '../../components/common/Toast/ToastContext';
import { socketService } from '../../services/socket';

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
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'submitted';
  documents?: VerificationDocument[];
}

// FIX #1: Default verification steps when no backend data available
const getDefaultVerificationSteps = (): VerificationStep[] => [
  {
    id: 'identity',
    title: 'Identity Verification',
    description: 'Verify your personal identity with a valid government-issued ID',
    status: 'pending',
    documents: [
      {
        id: 'emirates_id',
        type: 'id',
        name: 'Emirates ID / Passport',
        status: 'missing',
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
];

// Map backend document types to frontend document IDs
const mapBackendDocTypeToFrontendId = (docType: string): string => {
  const typeLower = docType.toLowerCase();
  if (typeLower.includes('emirates_id') || typeLower.includes('id_card') || typeLower.includes('passport')) {
    return 'emirates_id';
  }
  if (typeLower.includes('trade_license') || typeLower.includes('business_license') || typeLower.includes('license')) {
    return 'trade_license';
  }
  if (typeLower.includes('dha') || typeLower.includes('certificate')) {
    return 'dha_license';
  }
  if (typeLower.includes('utility') || typeLower.includes('address') || typeLower.includes('ejari') || typeLower.includes('dewa')) {
    return 'utility_bill';
  }
  return docType;
};

// Map backend document verification status to frontend status
const mapBackendStatusToFrontend = (verified: boolean, rejectionReason?: string): VerificationDocument['status'] => {
  if (verified) return 'approved';
  if (rejectionReason) return 'rejected';
  return 'pending';
};

// FIX #1: Fetch verification status from backend API and sync with frontend state
const fetchVerificationStatus = async (): Promise<VerificationStep[]> => {
  try {
    const response = await api.get('/provider/verification');
    if (response.data?.success && response.data?.data) {
      const backendData = response.data.data;

      // Get default steps as base
      const steps = getDefaultVerificationSteps();

      // Update steps based on backend data
      if (backendData.documents && Array.isArray(backendData.documents)) {
        for (const doc of backendData.documents) {
          const frontendDocId = mapBackendDocTypeToFrontendId(doc.type);

          for (const step of steps) {
            if (step.documents) {
              const docIndex = step.documents.findIndex(d => d.id === frontendDocId);
              if (docIndex >= 0) {
                step.documents[docIndex] = {
                  ...step.documents[docIndex],
                  status: mapBackendStatusToFrontend(doc.verified, doc.rejectionReason),
                  uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : undefined,
                  verifiedAt: doc.verifiedAt ? new Date(doc.verifiedAt) : undefined,
                  rejectionReason: doc.rejectionReason,
                  fileUrl: doc.url,
                };
                step.status = step.documents[docIndex].status === 'approved' ? 'completed' : 'in_progress';
              }
            }
          }
        }
      }

      // Update overall status based on backend
      if (backendData.overallStatus) {
        if (backendData.overallStatus === 'verified' || backendData.overallStatus === 'approved') {
          // Mark all pending steps as completed
          for (const step of steps) {
            if (step.status !== 'completed') {
              step.status = 'completed';
              if (step.documents) {
                for (const doc of step.documents) {
                  if (doc.status !== 'approved') {
                    doc.status = 'approved';
                  }
                }
              }
            }
          }
        }
      }

      return steps;
    }
  } catch (error) {
    console.error('Failed to fetch verification status:', error);
  }

  return getDefaultVerificationSteps();
};

// FIX #3: Handle background check consent
const handleBackgroundCheckConsent = async () => {
  try {
    const response = await api.post('/provider/verification/consent');
    if (response.data?.success) {
      return true;
    }
  } catch (error) {
    console.error('Failed to submit background check consent:', error);
  }
  return false;
};

const ProviderVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, providerProfile, setProviderProfile } = useAuthStore();
  const toast = useToast();

  // FIX #1: State initialized with function to avoid dependency on providerProfile
  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>(getDefaultVerificationSteps);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [backgroundCheckConsent, setBackgroundCheckConsent] = useState(false);

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/provider/dashboard'); // FIX: Was '/dashboard'
    }
  }, [user, navigate]);

  // FIX #1: Fetch verification status from backend on mount
  useEffect(() => {
    const loadVerificationStatus = async () => {
      setIsLoading(true);
      try {
        const steps = await fetchVerificationStatus();
        setVerificationSteps(steps);

        // Update provider profile verification status based on backend
        const backendVerified = steps.every(step => step.status === 'completed');
        if (backendVerified && providerProfile && !providerProfile.isVerified) {
          // Update the auth store with new verification status
          setProviderProfile?.({ ...providerProfile, isVerified: true });
        }
      } catch (error) {
        console.error('Failed to load verification status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVerificationStatus();
  }, [providerProfile, setProviderProfile]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Calculate overall progress
  const completedSteps = verificationSteps.filter((s) => s.status === 'completed').length;
  const overallProgress = (completedSteps / verificationSteps.length) * 100;

  // FIX #1 & #4: Socket listeners for verification updates - sync with backend
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Listen for provider approved
    unsubscribers.push(
      socketService.onProviderApproved(() => {
        toast.addToast({
          title: 'Verification Approved',
          description: 'Your provider account has been verified!',
          variant: 'success',
        });
        // Refresh verification status from backend
        fetchVerificationStatus().then(setVerificationSteps);
        // Update provider profile in auth store
        if (providerProfile && !providerProfile.isVerified) {
          setProviderProfile?.({ ...providerProfile, isVerified: true });
        }
      })
    );

    // Listen for provider rejected
    unsubscribers.push(
      socketService.onProviderRejected((data) => {
        toast.addToast({
          title: 'Verification Rejected',
          description: data.reason || 'Your verification was rejected.',
          variant: 'error',
        });
      })
    );

    // Listen for provider suspended
    unsubscribers.push(
      socketService.onProviderSuspended(() => {
        toast.addToast({
          title: 'Account Suspended',
          description: 'Your account has been suspended.',
          variant: 'error',
        });
      })
    );

    // Listen for document verified - FIX: Use correct socket event name
    unsubscribers.push(
      socketService.onDocumentVerified((data) => {
        // Update the specific document in the state
        setVerificationSteps((steps) =>
          steps.map((step) => {
            if (!step.documents) return step;
            return {
              ...step,
              documents: step.documents.map((doc) => {
                // Match by document ID or mapped type
                const docId = mapBackendDocTypeToFrontendId(data.documentId);
                if (doc.id === docId || doc.id === data.documentId) {
                  return {
                    ...doc,
                    status: data.status,
                    verifiedAt: new Date(),
                    rejectionReason: data.notes,
                  };
                }
                return doc;
              }),
            };
          })
        );
        toast.addToast({
          title: data.status === 'approved' ? 'Document Approved' : 'Document Rejected',
          description: data.notes || (data.status === 'approved' ? 'Your document has been verified.' : 'Your document requires resubmission.'),
          variant: data.status === 'approved' ? 'success' : 'error',
        });
        // Refresh full verification status from backend
        fetchVerificationStatus().then(setVerificationSteps);
      })
    );

    // Listen for verification complete
    unsubscribers.push(
      socketService.onVerificationComplete(() => {
        toast.addToast({
          title: 'Verification Complete',
          description: 'You are now a verified provider!',
          variant: 'success',
        });
        // Refresh verification status from backend
        fetchVerificationStatus().then(setVerificationSteps);
        if (providerProfile && !providerProfile.isVerified) {
          setProviderProfile?.({ ...providerProfile, isVerified: true });
        }
      })
    );

    // Cleanup: call all unsubscribers
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [toast, providerProfile, setProviderProfile]);

  // Upload via Cloudinary endpoints, then register document URL with verification API
  const uploadVerificationFile = async (file: File): Promise<string> => {
    if (file.type === 'application/pdf') {
      const formData = new FormData();
      formData.append('files', file);
      const uploadResponse = await api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileUrl = uploadResponse.data?.data?.attachments?.[0]?.url;
      if (!fileUrl) {
        throw new Error('Upload failed: no URL returned');
      }
      return fileUrl;
    }

    const formData = new FormData();
    formData.append('images', file);
    const uploadResponse = await api.post('/provider/services/upload-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const imageUrls = uploadResponse.data?.data;
    const fileUrl = Array.isArray(imageUrls) ? imageUrls[0] : undefined;
    if (!fileUrl) {
      throw new Error('Upload failed: no URL returned');
    }
    return fileUrl;
  };

  const handleFileUpload = async (stepId: string, documentId: string, file: File) => {
    // File validation constants
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    // Validate file exists and has size
    if (!file || file.size === 0) {
      toast.addToast({ title: 'Please select a valid file', variant: 'error' });
      return;
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.addToast({ title: 'Invalid file type. Please upload PDF, PNG or JPG.', variant: 'error' });
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      toast.addToast({ title: 'File too large. Maximum size is 10MB.', variant: 'error' });
      return;
    }

    setUploadProgress({ ...uploadProgress, [documentId]: 0 });
    setIsUploading(true);

    try {
      const fileUrl = await uploadVerificationFile(file);

      setUploadProgress((prev) => ({ ...prev, [documentId]: 50 }));

      // Map frontend document ID to backend document type
      const backendDocType = mapFrontendDocIdToBackendType(documentId);

      const response = await api.post('/provider/verification/documents', {
        documentType: backendDocType,
        documentUrl: fileUrl,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
      });

      setUploadProgress((prev) => ({ ...prev, [documentId]: 100 }));

      if (response.data?.success) {
        // Update document status optimistically
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
                  fileUrl: fileUrl,
                };
              }),
            };
          })
        );

        toast.addToast({ title: 'Document uploaded successfully', variant: 'success' });
      } else {
        throw new Error(response.data?.message || 'Failed to save document');
      }

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress({});
      toast.addToast({ title: error.response?.data?.message || error.message || 'Failed to upload document', variant: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  // FIX #2: Map frontend document IDs to backend document types
  const mapFrontendDocIdToBackendType = (docId: string): string => {
    switch (docId) {
      case 'emirates_id':
        return 'id_card';
      case 'trade_license':
        return 'business_license';
      case 'dha_license':
        return 'certificate';
      case 'utility_bill':
        return 'address_proof';
      default:
        return docId;
    }
  };

  const handleSubmitForReview = async () => {
    setIsSubmitting(true);

    try {
      const response = await api.post('/provider/verification/submit');
      if (response.data.success) {
        // Update step statuses to submitted
        setVerificationSteps((steps) =>
          steps.map((step) => ({
            ...step,
            status: 'submitted' as const,
          }))
        );
        toast.addToast({ title: 'Your verification documents have been submitted for review. You will be notified once the review is complete.', variant: 'success' });
      }
    } catch (error) {
      console.error('Submit failed:', error);
      toast.addToast({ title: error.response?.data?.message || 'Failed to submit verification. Please try again.', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
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
      <ProviderHubNav />

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Screen reader status announcer */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isSubmitting ? 'Submitting verification...' : ''}
        {isUploading ? 'Uploading document...' : ''}
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <main id="main-content" className="flex-1">
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
                    <button
                      onClick={async () => {
                        if (backgroundCheckConsent) {
                          // Already consented - show info
                          toast.addToast({
                            title: 'Consent Already Given',
                            description: 'You have already consented to the background check.',
                            variant: 'info',
                          });
                          return;
                        }
                        const success = await handleBackgroundCheckConsent();
                        if (success) {
                          setBackgroundCheckConsent(true);
                          setVerificationSteps((steps) =>
                            steps.map((s) =>
                              s.id === 'background'
                                ? { ...s, status: 'completed' as const }
                                : s
                            )
                          );
                          toast.addToast({
                            title: 'Consent Recorded',
                            description: 'Thank you for consenting to the background check.',
                            variant: 'success',
                          });
                        }
                      }}
                      className={`px-6 py-3 font-medium rounded-nilin transition-colors flex items-center gap-2 ${
                        backgroundCheckConsent
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-nilin-coral text-white hover:bg-nilin-rose'
                      }`}
                    >
                      <Shield className="h-4 w-4" />
                      {backgroundCheckConsent ? 'Consent Given' : 'Consent to Background Check'}
                      {backgroundCheckConsent && <CheckCircle className="h-4 w-4" />}
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
      </main>

      <Footer />
    </div>
  );
};

export default ProviderVerificationPage;
