import React, { memo, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { ReadReceipts } from './ReadReceipts';

// =============================================================================
// Types
// =============================================================================

export interface MessageBubbleProps {
  /** Message data */
  message: {
    _id?: string;
    id?: string;
    senderId: string | { _id: string; firstName?: string; lastName?: string; avatar?: string };
    receiverId: string;
    content: string;
    type: 'text' | 'image' | 'file' | 'system' | 'booking_update';
    attachments?: Array<{
      url: string;
      filename: string;
      mimeType: string;
      size: number;
    }>;
    status: 'sent' | 'delivered' | 'read';
    createdAt: string;
    replyTo?: {
      _id: string;
      content: string;
      type: string;
      senderId?: { firstName?: string; lastName?: string };
    };
  };
  /** Current user ID */
  currentUserId: string;
  /** Whether the message is the first in a group */
  isFirst?: boolean;
  /** Whether the message is the last in a group */
  isLast?: boolean;
  /** Whether the sender is typing (for this user) */
  isTyping?: boolean;
  /** On message long press (for actions) */
  onLongPress?: (message: MessageBubbleProps['message']) => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export const MessageBubble = memo(function MessageBubble({
  message,
  currentUserId,
  isFirst = true,
  isLast = true,
  isTyping = false,
  onLongPress,
  className,
}: MessageBubbleProps) {
  // Normalize senderId to string for comparison
  const senderId = typeof message.senderId === 'string'
    ? message.senderId
    : (message.senderId as unknown as { _id: string })?._id || '';

  const isOwnMessage = senderId === currentUserId;
  const isSystemMessage = message.type === 'system';

  // Format time
  const formattedTime = useMemo(() => {
    const date = new Date(message.createdAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [message.createdAt]);

  // Format date
  const formattedDate = useMemo(() => {
    const date = new Date(message.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, [message.createdAt]);

  // System message
  if (isSystemMessage) {
    return (
      <div className={cn('flex justify-center my-2', className)}>
        <div className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-xs">
          {message.content}
        </div>
      </div>
    );
  }

  // Long press handler
  const handleLongPress = () => {
    onLongPress?.(message);
  };

  // File size formatter
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Image MIME type check
  const isImage = (mimeType: string): boolean => {
    return mimeType.startsWith('image/');
  };

  return (
    <div
      className={cn(
        'flex flex-col max-w-[80%] group',
        isOwnMessage ? 'items-end self-end' : 'items-start self-start',
        className
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
    >
      {/* Reply preview */}
      {message.replyTo && (
        <div className={cn(
          'mb-1 px-3 py-1.5 rounded-lg text-xs max-w-full',
          isOwnMessage
            ? 'bg-[#D4948A]/20 text-[#6B4F4F]'
            : 'bg-gray-100 text-gray-600'
        )}>
          <div className="font-medium mb-0.5">
            {message.replyTo.senderId
              ? `${message.replyTo.senderId.firstName || ''} ${message.replyTo.senderId.lastName || ''}`.trim()
              : 'Unknown'}
          </div>
          <div className="truncate opacity-80">
            {message.replyTo.type === 'image' ? '[Image]' :
             message.replyTo.type === 'file' ? '[File]' :
             message.replyTo.content}
          </div>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          'relative px-3 py-2 rounded-2xl transition-all duration-200',
          isOwnMessage
            ? 'bg-gradient-to-br from-[#E8B4A8] to-[#D4948A] text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm',
          isFirst && isOwnMessage && 'rounded-tr-lg',
          isFirst && !isOwnMessage && 'rounded-tl-lg',
          isLast && isOwnMessage && 'rounded-br-lg',
          isLast && !isOwnMessage && 'rounded-bl-lg',
          !isFirst && !isLast && 'rounded-lg'
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          handleLongPress();
        }}
      >
        {/* Image attachment */}
        {message.type === 'image' && message.attachments?.[0] && (
          <div className="mb-2">
            <img
              src={message.attachments[0].url}
              alt="Attachment"
              className="max-w-full rounded-lg object-cover max-h-60"
              loading="lazy"
            />
          </div>
        )}

        {/* File attachment */}
        {message.type === 'file' && message.attachments?.[0] && (
          <div className={cn(
            'mb-2 p-2 rounded-lg flex items-center gap-2',
            isOwnMessage ? 'bg-white/10' : 'bg-white/50'
          )}>
            <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {message.attachments[0].filename}
              </div>
              <div className={cn(
                'text-xs',
                isOwnMessage ? 'text-white/70' : 'text-gray-500'
              )}>
                {formatFileSize(message.attachments[0].size)}
              </div>
            </div>
          </div>
        )}

        {/* Text content */}
        {message.type === 'text' && message.content && (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>

      {/* Timestamp and read receipts */}
      <div className={cn(
        'flex items-center gap-1 mt-0.5 px-1',
        isOwnMessage ? 'justify-end' : 'justify-start'
      )}>
        <span className={cn(
          'text-[10px]',
          isOwnMessage ? 'text-gray-400' : 'text-gray-400'
        )}>
          {formattedTime}
        </span>

        {/* Read receipts for own messages */}
        {isOwnMessage && isLast && (
          <ReadReceipts status={message.status} />
        )}
      </div>
    </div>
  );
});

// =============================================================================
// Export
// =============================================================================

export default MessageBubble;
