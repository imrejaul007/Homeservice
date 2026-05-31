import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { cn } from '../../lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface MessageInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** On send callback */
  onSend: (content: string, attachments?: File[]) => void;
  /** On typing callback */
  onTyping?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Max message length */
  maxLength?: number;
  /** Custom className */
  className?: string;
}

export interface MessageInputRef {
  /** Focus the input */
  focus: () => void;
  /** Clear the input */
  clear: () => void;
  /** Get current value */
  getValue: () => string;
}

// =============================================================================
// Component
// =============================================================================

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(
  function MessageInput(
    {
      placeholder = 'Type a message...',
      onSend,
      onTyping,
      disabled = false,
      autoFocus = false,
      maxLength = 5000,
      className,
    },
    ref
  ) {
    // State
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Refs
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => {
        setMessage('');
        setAttachments([]);
      },
      getValue: () => message,
    }), [message]);

    // Auto-resize textarea
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
      }
    }, [message]);

    // Auto-focus
    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus]);

    // Handle typing with debounce
    const handleTyping = useCallback(() => {
      onTyping?.();
    }, [onTyping]);

    // Handle input change
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= maxLength) {
        setMessage(value);
        handleTyping();
      }
    }, [handleTyping, maxLength]);

    // Handle send
    const handleSend = useCallback(async () => {
      const trimmedMessage = message.trim();
      const hasAttachments = attachments.length > 0;

      if (!trimmedMessage && !hasAttachments) {
        return;
      }

      setIsSending(true);

      try {
        await onSend(trimmedMessage, attachments.length > 0 ? attachments : undefined);
        setMessage('');
        setAttachments([]);
        inputRef.current?.focus();
      } finally {
        setIsSending(false);
      }
    }, [message, attachments, onSend]);

    // Handle key press
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Send on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }, [handleSend]);

    // Handle file selection
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const newFiles = Array.from(files);
        setAttachments(prev => [...prev, ...newFiles]);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, []);

    // Remove attachment
    const removeAttachment = useCallback((index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Trigger file input click
    const handleAttachClick = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    return (
      <div className={cn('flex flex-col', className)}>
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="px-3 pt-2 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="relative flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg"
              >
                {/* File icon */}
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>

                {/* File name */}
                <span className="text-sm text-gray-700 max-w-[100px] truncate">
                  {file.name}
                </span>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-2 px-3 py-2 border-t border-gray-100">
          {/* Attach button */}
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={disabled || isSending}
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors',
              'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isFocused && 'bg-gray-100'
            )}
            aria-label="Attach file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled || isSending}
              rows={1}
              className={cn(
                'w-full px-4 py-2.5 pr-12 rounded-full resize-none',
                'bg-gray-100 text-gray-800 placeholder-gray-500',
                'border-none outline-none',
                'transition-all duration-200',
                'focus:bg-gray-50 focus:ring-2 focus:ring-[#E8B4A8]/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'max-h-[150px] overflow-y-auto'
              )}
            />

            {/* Character count (when near limit) */}
            {message.length > maxLength * 0.8 && (
              <span className={cn(
                'absolute right-12 bottom-2 text-xs',
                message.length > maxLength ? 'text-red-500' : 'text-gray-400'
              )}>
                {message.length}/{maxLength}
              </span>
            )}
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || isSending || (!message.trim() && attachments.length === 0)}
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
              (message.trim() || attachments.length > 0)
                ? 'bg-gradient-to-br from-[#E8B4A8] to-[#D4948A] text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
            aria-label="Send message"
          >
            {isSending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  }
);

// =============================================================================
// Export
// =============================================================================

export default MessageInput;
