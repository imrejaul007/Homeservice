// Chat Widget - Main floating chat button
export { ChatWidget, default as ChatWidgetDefault } from './ChatWidget';
export type { ChatWidgetProps } from './ChatWidget';

// Chat Window - Main chat interface
export { ChatWindow } from './ChatWindow';
export type { ChatWindowProps } from './ChatWindow';

// Message Bubble - Individual message bubble
export { MessageBubble } from './MessageBubble';
export type { MessageBubbleProps } from './MessageBubble';

// Message Input - Text input with send button
export { MessageInput } from './MessageInput';
export type { MessageInputProps, MessageInputRef } from './MessageInput';

// Chat History - Message history list
export { ChatHistory } from './ChatHistory';
export type { ChatHistoryProps } from './ChatHistory';

// Typing Indicator - "User is typing..." indicator
export { TypingIndicator } from './TypingIndicator';
export type { TypingIndicatorProps } from './TypingIndicator';

// Read Receipts - Read/delivered indicators
export { ReadReceipts, ReadReceiptsWithAvatars } from './ReadReceipts';
export type { ReadReceiptsProps, ReadReceiptsWithAvatarsProps } from './ReadReceipts';

// Chat Integration - Provider/Booking chat tabs
export { ChatIntegration, ChatTab, BookingChat } from './ChatIntegration';
export type {
  ChatIntegrationProps,
  ChatTabProps,
  BookingChatProps
} from './ChatIntegration';
