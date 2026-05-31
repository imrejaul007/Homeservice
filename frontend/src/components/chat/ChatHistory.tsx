import React, { useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { MessageBubble, MessageBubbleProps } from './MessageBubble';
import type { ChatMessage } from '../../services/chatApi';

// =============================================================================
// Types
// =============================================================================

export interface ChatHistoryProps {
  /** Messages to display */
  messages: ChatMessage[];
  /** Current user ID */
  currentUserId: string;
  /** Users currently typing */
  typingUsers?: Array<{ userId: string; userName: string }>;
  /** On message long press */
  onMessageLongPress?: (message: ChatMessage) => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ChatHistory({
  messages,
  currentUserId,
  typingUsers = [],
  onMessageLongPress,
  className,
}: ChatHistoryProps) {
  // Group messages by date and sender
  const groupedMessages = useMemo(() => {
    const groups: Array<{
      date: string;
      messages: Array<{
        message: ChatMessage;
        isFirst: boolean;
        isLast: boolean;
      }>;
    }> = [];

    let currentDate = '';
    let currentGroup: typeof groups[0] | null = null;

    messages.forEach((message, index) => {
      const messageDate = new Date(message.createdAt).toDateString();

      // New date group
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        currentGroup = {
          date: messageDate,
          messages: [], // Messages will be added below
        };
        groups.push(currentGroup);
      }

      // Normalize senderId to string
      const senderId = typeof message.senderId === 'string'
        ? message.senderId
        : (message.senderId as unknown as { _id: string })?._id || '';

      // Determine if first/last in sender group
      const prevMessage = messages[index - 1];
      const nextMessage = messages[index + 1];

      const prevSenderId = prevMessage
        ? (typeof prevMessage.senderId === 'string' ? prevMessage.senderId : (prevMessage.senderId as unknown as { _id: string })?._id || '')
        : '';
      const nextSenderId = nextMessage
        ? (typeof nextMessage.senderId === 'string' ? nextMessage.senderId : (nextMessage.senderId as unknown as { _id: string })?._id || '')
        : '';

      const isFirst = !prevMessage || prevSenderId !== senderId ||
        new Date(prevMessage.createdAt).toDateString() !== messageDate;
      const isLast = !nextMessage || nextSenderId !== senderId ||
        new Date(nextMessage.createdAt).toDateString() !== new Date(message.createdAt).toDateString();

      currentGroup?.messages.push({
        message,
        isFirst,
        isLast,
      });
    });

    return groups;
  }, [messages]);

  // Handle message long press
  const handleLongPress = useCallback((message: ChatMessage) => {
    onMessageLongPress?.(message);
  }, [onMessageLongPress]);

  // Format date header
  const formatDateHeader = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {groupedMessages.map((group) => (
        <div key={group.date} className="flex flex-col gap-1">
          {/* Date separator */}
          <div className="flex items-center justify-center my-2">
            <span className="px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
              {formatDateHeader(group.date)}
            </span>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-1">
            {group.messages.map(({ message, isFirst, isLast }) => (
              <MessageBubble
                key={message._id}
                message={message}
                currentUserId={currentUserId}
                isFirst={isFirst}
                isLast={isLast}
                onLongPress={handleLongPress}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Export
// =============================================================================

export default ChatHistory;
