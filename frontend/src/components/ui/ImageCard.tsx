import React from 'react';
import OptimizedImage from './OptimizedImage';

interface ImageCardProps {
  src: string;
  alt: string;
  badge?: string;
  badgeClassName?: string;
  aspectRatio?: string;
  children?: React.ReactNode;
  className?: string;
  /** Priority loading for above-fold images */
  priority?: boolean;
  /** Custom sizes for srcset */
  sizes?: string;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  src,
  alt,
  badge,
  badgeClassName = 'bg-nilin-coral text-white',
  aspectRatio = 'aspect-[4/3]',
  children,
  className = '',
  priority = false,
  sizes,
}) => (
  <div className={`relative ${aspectRatio} overflow-hidden rounded-2xl ${className}`}>
    <OptimizedImage
      src={src}
      alt={alt}
      aspectRatio="w-full h-full"
      priority={priority}
      sizes={sizes}
    />
    {badge && (
      <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm ${badgeClassName}`}>
        {badge}
      </span>
    )}
    {children}
  </div>
);
