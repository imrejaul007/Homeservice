// Share Modal Component - Social media sharing with fallback options
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  Facebook,
  Twitter,
  Linkedin,
  Mail,
  Link2,
  Smartphone,
} from 'lucide-react';
import {
  shareToPlatform,
  copyToClipboard,
  isNativeShareSupported,
  buildShareMessage,
  SharePlatform,
} from '../../services/social/ShareService';
import toast from 'react-hot-toast';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  url?: string;
  image?: string;
  itemType?: 'service' | 'package' | 'provider' | 'experience' | 'page';
  itemId?: string;
}

interface SocialButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  hoverColor: string;
  onClick: () => void;
  isLoading?: boolean;
}

const SocialButton: React.FC<SocialButtonProps> = ({
  icon,
  label,
  color,
  hoverColor,
  onClick,
  isLoading,
}) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    disabled={isLoading}
    className={`flex flex-col items-center gap-2 p-4 ${color} rounded-xl transition-colors hover:${hoverColor} disabled:opacity-50`}
  >
    <span className="w-10 h-10 flex items-center justify-center text-white">{icon}</span>
    <span className="text-xs font-medium text-white">{label}</span>
  </motion.button>
);

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  url,
  image,
  itemType,
  itemId,
}) => {
  const [copied, setCopied] = useState(false);
  const [isNativeSupported, setIsNativeSupported] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    setIsNativeSupported(isNativeShareSupported());
  }, []);

  const handleNativeShare = async () => {
    if (!url) return;
    setIsSharing(true);
    try {
      const result = await shareToPlatform('native', {
        title,
        text: description || title,
        url,
        image,
        itemType,
        itemId,
      });
      if (result.success) {
        toast.success('Shared successfully!');
        onClose();
      }
    } catch {
      toast.error('Failed to share');
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareToPlatform = async (platform: SharePlatform) => {
    if (!url) return;
    setIsSharing(true);
    try {
      const result = await shareToPlatform(platform, {
        title,
        text: description || title,
        url,
        image,
        itemType,
        itemId,
      });
      if (result.success && platform === 'copy') {
        toast.success('Link copied to clipboard!');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      toast.error('Failed to share');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!url) return;
    const success = await copyToClipboard(url);
    if (success) {
      toast.success('Link copied to clipboard!');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy link');
    }
  };

  // Build share message for preview
  const shareMessage = buildShareMessage(title, description);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-nilin-coral/10 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-nilin-coral" />
                </div>
                <div>
                  <h2 className="font-semibold text-nilin-charcoal">Share this {title ? 'service' : 'content'}</h2>
                  <p className="text-xs text-nilin-warmGray line-clamp-1">{title}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Native Share Button (Mobile) */}
              {isNativeSupported && (
                <motion.button
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNativeShare}
                  disabled={isSharing}
                  className="w-full flex items-center justify-center gap-3 p-4 mb-4 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50"
                >
                  <Smartphone className="w-5 h-5" />
                  <span>Share via...</span>
                </motion.button>
              )}

              {/* Social Buttons Grid */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {/* WhatsApp */}
                <SocialButton
                  icon={<MessageCircle className="w-6 h-6" />}
                  label="WhatsApp"
                  color="bg-green-500"
                  hoverColor="bg-green-600"
                  onClick={() => handleShareToPlatform('whatsapp')}
                />

                {/* Facebook */}
                <SocialButton
                  icon={<Facebook className="w-6 h-6" />}
                  label="Facebook"
                  color="bg-blue-600"
                  hoverColor="bg-blue-700"
                  onClick={() => handleShareToPlatform('facebook')}
                />

                {/* Twitter/X */}
                <SocialButton
                  icon={<Twitter className="w-6 h-6" />}
                  label="X"
                  color="bg-black"
                  hoverColor="bg-gray-800"
                  onClick={() => handleShareToPlatform('twitter')}
                />

                {/* LinkedIn */}
                <SocialButton
                  icon={<Linkedin className="w-6 h-6" />}
                  label="LinkedIn"
                  color="bg-blue-700"
                  hoverColor="bg-blue-800"
                  onClick={() => handleShareToPlatform('linkedin')}
                />
              </div>

              {/* Secondary Row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Email */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleShareToPlatform('email')}
                  className="flex items-center justify-center gap-2 p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <Mail className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Email</span>
                </motion.button>

                {/* SMS */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleShareToPlatform('sms')}
                  className="flex items-center justify-center gap-2 p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <MessageCircle className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">SMS</span>
                </motion.button>
              </div>

              {/* Copy Link Section */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                    <Link2 className="w-4 h-4 text-nilin-warmGray flex-shrink-0" />
                    <span className="text-sm text-nilin-charcoal truncate flex-1">
                      {url ? new URL(url).pathname : 'Link not available'}
                    </span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyLink}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      copied
                        ? 'bg-green-500 text-white'
                        : 'bg-nilin-coral text-white hover:bg-nilin-rose'
                    }`}
                  >
                    {copied ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Copied!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="w-4 h-4" />
                        Copy
                      </span>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Preview Message */}
              {description && (
                <div className="mt-4 p-3 bg-nilin-blush/30 rounded-xl">
                  <p className="text-xs text-nilin-warmGray mb-1">Preview:</p>
                  <p className="text-sm text-nilin-charcoal line-clamp-2">{shareMessage}</p>
                </div>
              )}
            </div>

            {/* Spacer for safe area on mobile */}
            <div className="h-6 sm:hidden" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShareModal;
