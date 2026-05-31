import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface TypingIndicatorProps {
  /** Users currently typing */
  users: Array<{ userId: string; userName: string }>;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  // Format typing text
  const typingText = useMemo(() => {
    if (users.length === 0) return '';

    if (users.length === 1) {
      return `${users[0].userName} is typing`;
    }

    if (users.length === 2) {
      return `${users[0].userName} and ${users[1].userName} are typing`;
    }

    if (users.length > 2) {
      return `${users[0].userName} and ${users.length - 1} others are typing`;
    }

    return 'Someone is typing';
  }, [users]);

  if (users.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Animated dots */}
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>

      {/* Typing text */}
      <span className="text-sm text-gray-500">
        {typingText}
      </span>
    </div>
  );
}

// =============================================================================
// Export
// =============================================================================

export default TypingIndicator;
