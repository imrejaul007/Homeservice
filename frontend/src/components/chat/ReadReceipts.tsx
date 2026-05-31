import React, { memo } from 'react';
import { cn } from '../../lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface ReadReceiptsProps {
  /** Message status */
  status: 'sent' | 'delivered' | 'read';
  /** Custom className */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export const ReadReceipts = memo(function ReadReceipts({ status, className }: ReadReceiptsProps) {
  return (
    <div className={cn('flex items-center', className)}>
      {/* Sent - Single checkmark */}
      {status === 'sent' && (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}

      {/* Delivered - Double checkmark */}
      {status === 'delivered' && (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}

      {/* Read - Blue double checkmark */}
      {status === 'read' && (
        <div className="relative flex items-center">
          {/* First check */}
          <svg
            className="w-4 h-4 text-[#E8B4A8]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {/* Second check (offset) */}
          <svg
            className="w-4 h-4 text-[#E8B4A8] -translate-x-1.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}
    </div>
  );
});

// =============================================================================
// Alternative: Read Receipt with Avatars
// =============================================================================

export interface ReadReceiptsWithAvatarsProps {
  /** Message status */
  status: 'sent' | 'delivered' | 'read';
  /** List of users who have read */
  readBy?: Array<{
    userId: string;
    userName: string;
    avatar?: string;
    readAt: string;
  }>;
  /** On click to show read details */
  onShowDetails?: () => void;
  /** Custom className */
  className?: string;
}

export const ReadReceiptsWithAvatars = memo(function ReadReceiptsWithAvatars({
  status,
  readBy = [],
  onShowDetails,
  className,
}: ReadReceiptsWithAvatarsProps) {
  const hasReadUsers = readBy.length > 0;

  return (
    <div
      className={cn(
        'flex items-center gap-1 cursor-pointer',
        onShowDetails && 'hover:opacity-80 transition-opacity',
        className
      )}
      onClick={onShowDetails}
      role={onShowDetails ? 'button' : undefined}
      tabIndex={onShowDetails ? 0 : undefined}
      onKeyDown={onShowDetails ? (e) => e.key === 'Enter' && onShowDetails() : undefined}
    >
      {/* Status icon */}
      <ReadReceipts status={status} />

      {/* Read by avatars (when there are multiple readers) */}
      {hasReadUsers && (
        <div className="flex -space-x-1.5">
          {readBy.slice(0, 3).map((user) => (
            <div
              key={user.userId}
              className="w-4 h-4 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center overflow-hidden"
              title={user.userName}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[8px] font-medium text-gray-500">
                  {user.userName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          ))}
          {readBy.length > 3 && (
            <div className="w-4 h-4 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center">
              <span className="text-[8px] font-medium text-gray-600">
                +{readBy.length - 3}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// =============================================================================
// Export
// =============================================================================

export default ReadReceipts;
