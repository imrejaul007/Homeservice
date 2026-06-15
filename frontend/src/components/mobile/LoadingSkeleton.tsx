import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = '8px', className = '' }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#F5E6E0',
      }}
    >
      {/* Shimmer gradient overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"
        style={{
          backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(253, 251, 249, 0.8) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-nilin border border-nilin-border p-4">
      {/* Image skeleton */}
      <Skeleton height="120px" className="mb-3 rounded-nilin" />
      {/* Title skeleton */}
      <Skeleton width="60%" height="20px" className="mb-2" />
      {/* Subtitle skeleton */}
      <Skeleton width="80%" height="16px" />
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-nilin border border-nilin-border p-4 flex items-center gap-3">
          <Skeleton width="48px" height="48px" borderRadius="12px" />
          <div className="flex-1">
            <Skeleton width="70%" height="16px" className="mb-2" />
            <Skeleton width="50%" height="14px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton height="200px" className="mb-4 rounded-nilin" />
      <Skeleton width="60%" height="24px" className="mb-4" />
      <ListSkeleton count={5} />
    </div>
  );
}
