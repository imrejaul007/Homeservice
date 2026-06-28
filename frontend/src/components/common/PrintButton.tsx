// PrintButton Component - Download/Print package details as PDF
import React, { useState } from 'react';
import { Printer, Loader2, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getApiUrl } from '../../lib/getApiUrl';

interface PrintButtonProps {
  /** Package ID to print */
  packageId: string;
  /** Package name for the filename */
  packageName?: string;
  /** Button variant style */
  variant?: 'icon' | 'button' | 'icon-text';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Custom label text */
  label?: string;
  /** Whether to show download icon instead of print */
  useDownloadIcon?: boolean;
}

export const PrintButton: React.FC<PrintButtonProps> = ({
  packageId,
  packageName,
  variant = 'icon',
  size = 'md',
  className = '',
  label = 'Print',
  useDownloadIcon = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePrint = async () => {
    if (!packageId) {
      toast.error('Package ID is required');
      return;
    }

    setIsLoading(true);

    try {
      const API_URL = getApiUrl();

      // Make the API request to generate PDF with blob response type
      const response = await axios.get(`${API_URL}/packages/${packageId}/print`, {
        responseType: 'blob',
        withCredentials: true,
      });

      // Create a blob URL from the response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = url;

      // Generate filename from package name
      const sanitizedName = packageName
        ? packageName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
        : 'Package';
      const filename = `${sanitizedName}_details.pdf`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      window.URL.revokeObjectURL(url);

      toast.success('Package details downloaded!');
    } catch (error) {
      console.error('Failed to download package PDF:', error);

      // Try to extract error message from blob response
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          toast.error(json.message || 'Failed to generate PDF');
        } catch {
          toast.error('Failed to generate PDF. Please try again.');
        }
      } else {
        // Provide user-friendly error message
        const errorMessage = error?.response?.data?.message ||
          error?.message ||
          'Failed to generate PDF. Please try again.';
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Size classes for different variants
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

  // Icon component
  const Icon = useDownloadIcon ? Download : Printer;

  if (variant === 'icon') {
    return (
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handlePrint}
        disabled={isLoading}
        className={`
          rounded-full bg-white/90 backdrop-blur-sm shadow-sm
          text-nilin-warmGray hover:text-nilin-coral hover:bg-white
          transition-all disabled:opacity-50
          ${getSizeClasses()}
          ${className}
        `}
        aria-label={label}
        title={label}
      >
        {isLoading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : (
          <Icon className={iconSizes[size]} />
        )}
      </motion.button>
    );
  }

  if (variant === 'icon-text') {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handlePrint}
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
        ) : (
          <Icon className="w-5 h-5" />
        )}
        <span className="font-medium">{label}</span>
      </motion.button>
    );
  }

  // Full button variant
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handlePrint}
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
        <Icon className="w-5 h-5" />
      )}
      <span>{label}</span>
    </motion.button>
  );
};

export default PrintButton;
