// Share Button Component - Reusable share trigger with modal
import React, { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { motion } from 'framer-motion';

interface ShareButtonProps {
  /** Title of the content to share */
  title: string;
  /** Optional description text */
  description?: string;
  /** URL to share (defaults to current page URL) */
  url?: string;
  /** Optional image for sharing */
  image?: string;
  /** Item type for tracking */
  itemType?: 'service' | 'package' | 'provider' | 'experience' | 'page';
  /** Item ID for tracking */
  itemId?: string;
  /** Button variant */
  variant?: 'icon' | 'button' | 'icon-text';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Icon to use instead of default */
  icon?: React.ReactNode;
  /** Custom label text */
  label?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  title,
  description,
  url,
  image,
  itemType,
  itemId,
  variant = 'icon',
  size = 'md',
  className = '',
  icon,
  label,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use current page URL if no URL provided
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const handleClick = () => {
    setIsModalOpen(true);
  };

  // Size classes
  const getSizeClasses = () => {
    if (variant === 'icon') {
      return { sm: 'p-1.5', md: 'p-2', lg: 'p-3' }[size] || 'p-2';
    }
    return {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base',
    }[size] || 'px-3 py-1.5 text-sm';
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  if (variant === 'icon') {
    return (
      <>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleClick}
          disabled={isLoading}
          className={`
            rounded-full bg-white/90 backdrop-blur-sm shadow-sm
            text-nilin-warmGray hover:text-nilin-coral hover:bg-white
            transition-all disabled:opacity-50
            ${getSizeClasses()}
            ${className}
          `}
          aria-label="Share"
          title="Share"
        >
          {isLoading ? (
            <Loader2 className={`${iconSizes[size]} animate-spin`} />
          ) : icon ? (
            <span className={iconSizes[size]}>{icon}</span>
          ) : (
            <Share2 className={iconSizes[size]} />
          )}
        </motion.button>

        <ShareModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={title}
          description={description}
          url={shareUrl}
          image={image}
          itemType={itemType}
          itemId={itemId}
        />
      </>
    );
  }

  if (variant === 'icon-text') {
    return (
      <>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleClick}
          disabled={isLoading}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-xl
            bg-nilin-coral/10 text-nilin-coral
            hover:bg-nilin-coral/20
            transition-colors disabled:opacity-50
            ${className}
          `}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : icon ? (
            <span className="w-5 h-5">{icon}</span>
          ) : (
            <Share2 className="w-5 h-5" />
          )}
          <span className="font-medium">{label || 'Share'}</span>
        </motion.button>

        <ShareModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={title}
          description={description}
          url={shareUrl}
          image={image}
          itemType={itemType}
          itemId={itemId}
        />
      </>
    );
  }

  // Full button variant
  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        disabled={isLoading}
        className={`
          flex items-center justify-center gap-2
          bg-nilin-coral text-white rounded-xl font-medium
          hover:bg-nilin-rose transition-colors
          disabled:opacity-50
          ${getSizeClasses()}
          ${className}
        `}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Share2 className="w-5 h-5" />
        )}
        <span>{label || 'Share'}</span>
      </motion.button>

      <ShareModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={title}
        description={description}
        url={shareUrl}
        image={image}
        itemType={itemType}
        itemId={itemId}
      />
    </>
  );
};

export default ShareButton;
