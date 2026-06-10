/**
 * NILIN AI Chat Widget Analytics Service
 * Production-ready analytics tracking with support for multiple analytics backends
 *
 * Features:
 * - Flexible adapter system (Amplitude, Mixpanel, GA4, Custom Backend)
 * - Event queuing and batching (5-second intervals)
 * - Page unload handling with keepalive
 * - Error boundary to prevent analytics failures from affecting UX
 * - Comprehensive event types for chat widget tracking
 */

import { Capacitor } from '@capacitor/core';

// ============================================================================
// Type Definitions
// ============================================================================

// Event Types
export type WidgetEvent =
  | 'widget_opened'
  | 'widget_closed'
  | 'widget_minimized'
  | 'widget_maximized';

export type ChatEvent =
  | 'message_sent'
  | 'message_received'
  | 'typing_started'
  | 'typing_ended';

export type QuickActionEvent =
  | 'quick_action_click'
  | 'suggestion_click'
  | 'action_performed';

export type EscalationEvent =
  | 'escalation_requested'
  | 'escalation_accepted'
  | 'escalation_completed';

export type ErrorEvent =
  | 'error_occurred'
  | 'network_error'
  | 'api_error'
  | 'ai_error';

export type SessionEvent =
  | 'chat_started'
  | 'chat_ended'
  | 'new_chat_started'
  | 'conversation_resumed';

export type ChatAnalyticsEvent =
  | WidgetEvent
  | ChatEvent
  | QuickActionEvent
  | EscalationEvent
  | ErrorEvent
  | SessionEvent;

// Event Properties
export interface BaseEventProperties {
  widget_id: string;
  conversation_id?: string;
  user_id?: string;
  session_id: string;
  timestamp: string;
  platform?: string;
  [key: string]: unknown;
}

export interface MessageEventProperties extends BaseEventProperties {
  message_id: string;
  message_length?: number;
  message_type?: 'user' | 'bot' | 'system';
  response_time_ms?: number;
  ai_latency_ms?: number;
}

export interface ActionEventProperties extends BaseEventProperties {
  action_id: string;
  action_label: string;
  action_type?: 'link' | 'action' | 'suggestion';
  action_value?: string;
}

export interface ResponseTimeProperties extends BaseEventProperties {
  response_time_ms: number;
  ai_latency_ms?: number;
}

export interface ConversationProperties extends BaseEventProperties {
  conversation_length: number;
  escalation_reason?: string;
}

export interface ErrorProperties extends BaseEventProperties {
  error_type: string;
  error_message?: string;
  error_code?: string;
  endpoint?: string;
  recoverable?: boolean;
  typing_duration_ms?: number;
}

export type EventProperties =
  | BaseEventProperties
  | MessageEventProperties
  | ActionEventProperties
  | ResponseTimeProperties
  | ConversationProperties
  | ErrorProperties;

// Analytics Event
export interface ChatAnalyticsEventData {
  event: ChatAnalyticsEvent;
  properties: EventProperties;
}

// Analytics Adapter Interface
export interface AnalyticsAdapter {
  name: string;
  initialize(config?: Record<string, unknown>): Promise<void>;
  track(event: ChatAnalyticsEventData): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  reset(): void;
}

// Analytics Configuration
export interface AnalyticsConfig {
  enableConsoleLogging?: boolean;
  enableBatching?: boolean;
  batchIntervalMs?: number;
  maxBatchSize?: number;
  adapters?: AnalyticsAdapter[];
  endpoint?: string;
  apiKey?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID
 */
function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 11);
  return prefix ? `${prefix}_${timestamp}_${randomPart}` : `${timestamp}_${randomPart}`;
}

/**
 * Get current timestamp in ISO format
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get or create session ID from sessionStorage
 */
function getSessionId(): string {
  const storageKey = 'nilin_chat_session_id';
  let sessionId = sessionStorage.getItem(storageKey);

  if (!sessionId) {
    sessionId = generateId('session');
    sessionStorage.setItem(storageKey, sessionId);
  }

  return sessionId;
}

/**
 * Get user ID from auth store (lazy import to avoid circular deps)
 */
function getUserId(): string | undefined {
  try {
    // Dynamic import to avoid circular dependency
    const { useAuthStore } = require('../stores/authStore');
    return useAuthStore.getState()?.user?.id;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Built-in Adapters
// ============================================================================

/**
 * Console Logger Adapter - Logs events to console in development
 */
class ConsoleLoggerAdapter implements AnalyticsAdapter {
  name = 'console';
  private enabled = true;

  async initialize(): Promise<void> {
    console.log('[ChatAnalytics] Console logger adapter initialized');
  }

  track(event: ChatAnalyticsEventData): void {
    if (!this.enabled) return;

    const { event: eventName, properties } = event;
    const logStyles = [
      'background: #E8B4A8',
      'color: #fff',
      'padding: 4px 8px',
      'border-radius: 4px',
      'font-weight: bold',
    ].join(';');

    console.log(
      `%c[ChatAnalytics] ${eventName}`,
      logStyles,
      properties
    );
  }

  identify(): void {
    // No-op for console logger
  }

  reset(): void {
    // No-op for console logger
  }
}

/**
 * Custom Backend Adapter - Sends events to a custom backend endpoint
 */
class CustomBackendAdapter implements AnalyticsAdapter {
  name = 'custom_backend';
  private endpoint: string;
  private apiKey?: string;
  private queue: ChatAnalyticsEventData[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private batchIntervalMs = 5000;
  private maxBatchSize = 50;
  private isFlushing = false;

  constructor(endpoint: string, apiKey?: string, batchIntervalMs = 5000, maxBatchSize = 50) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.batchIntervalMs = batchIntervalMs;
    this.maxBatchSize = maxBatchSize;
  }

  async initialize(): Promise<void> {
    console.log('[ChatAnalytics] Custom backend adapter initialized');
    this.startBatchTimer();
  }

  private startBatchTimer(): void {
    this.flushTimeout = setTimeout(() => {
      this.flush().catch(console.error);
      this.startBatchTimer();
    }, this.batchIntervalMs);
  }

  async track(event: ChatAnalyticsEventData): Promise<void> {
    this.queue.push(event);

    if (this.queue.length >= this.maxBatchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;

    this.isFlushing = true;
    const events = [...this.queue];
    this.queue = [];

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      await fetch(`${this.endpoint}/analytics/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ events }),
        keepalive: true, // Ensure request completes on page unload
      });
    } catch (error) {
      console.error('[ChatAnalytics] Failed to send events to backend:', error);
      // Re-queue failed events
      this.queue.unshift(...events);
    } finally {
      this.isFlushing = false;
    }
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    // Optionally send user identification to backend
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      fetch(`${this.endpoint}/analytics/identify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, traits, timestamp: getTimestamp() }),
        keepalive: true,
      });
    } catch (error) {
      console.error('[ChatAnalytics] Failed to identify user:', error);
    }
  }

  reset(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.queue = [];
  }
}

/**
 * Amplitude Adapter - Sends events to Amplitude
 */
class AmplitudeAdapter implements AnalyticsAdapter {
  name = 'amplitude';
  private apiKey?: string;
  private userId?: string;
  private deviceId?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
    this.deviceId = this.generateDeviceId();
  }

  private generateDeviceId(): string {
    let deviceId = localStorage.getItem('nilin_amplitude_device_id');
    if (!deviceId) {
      deviceId = generateId('device');
      localStorage.setItem('nilin_amplitude_device_id', deviceId);
    }
    return deviceId;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      console.warn('[ChatAnalytics] Amplitude API key not provided');
      return;
    }

    // Load Amplitude script dynamically if needed
    if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>)['amplitude']) {
      await this.loadAmplitudeScript();
    }

    console.log('[ChatAnalytics] Amplitude adapter initialized');
  }

  private async loadAmplitudeScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.amplitude.com/libs/amplitude-8.21.4-min.gz.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Amplitude script'));
      document.head.appendChild(script);
    });
  }

  track(event: ChatAnalyticsEventData): void {
    if (!this.apiKey) return;

    const amplitude = (window as unknown as Record<string, unknown>)['amplitude'] as {
      init: (key: string, deviceId: string, options: Record<string, unknown>) => void;
      setUserId: (userId: string) => void;
      logEvent: (name: string, properties?: Record<string, unknown>) => void;
    } | undefined;

    if (amplitude) {
      amplitude.init(this.apiKey, this.deviceId!, {
        defaultEvents: [],
      });

      if (this.userId) {
        amplitude.setUserId(this.userId);
      }

      amplitude.logEvent(event.event, event.properties);
    }
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.userId = userId;

    const amplitude = (window as unknown as Record<string, unknown>)['amplitude'] as {
      setUserId: (userId: string) => void;
      setUserProperties: (properties: Record<string, unknown>) => void;
    } | undefined;

    if (amplitude) {
      amplitude.setUserId(userId);
      if (traits) {
        amplitude.setUserProperties(traits);
      }
    }
  }

  reset(): void {
    this.userId = undefined;
  }
}

/**
 * Mixpanel Adapter - Sends events to Mixpanel
 */
class MixpanelAdapter implements AnalyticsAdapter {
  name = 'mixpanel';
  private token?: string;
  private userId?: string;

  constructor(token?: string) {
    this.token = token;
  }

  async initialize(): Promise<void> {
    if (!this.token) {
      console.warn('[ChatAnalytics] Mixpanel token not provided');
      return;
    }

    if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>)['mixpanel']) {
      await this.loadMixpanelScript();
    }

    console.log('[ChatAnalytics] Mixpanel adapter initialized');
  }

  private async loadMixpanelScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Mixpanel script'));
      document.head.appendChild(script);
    });
  }

  track(event: ChatAnalyticsEventData): void {
    if (!this.token) return;

    const mixpanel = (window as unknown as Record<string, unknown>)['mixpanel'] as {
      init: (token: string) => void;
      identify: (id: string) => void;
      people: { set: (properties: Record<string, unknown>) => void };
      track: (name: string, properties?: Record<string, unknown>) => void;
    } | undefined;

    if (mixpanel) {
      mixpanel.init(this.token);

      if (this.userId) {
        mixpanel.identify(this.userId);
      }

      mixpanel.track(event.event, event.properties);
    }
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.userId = userId;

    const mixpanel = (window as unknown as Record<string, unknown>)['mixpanel'] as {
      identify: (id: string) => void;
      people: { set: (properties: Record<string, unknown>) => void };
    } | undefined;

    if (mixpanel) {
      mixpanel.identify(userId);
      if (traits) {
        mixpanel.people.set(traits);
      }
    }
  }

  reset(): void {
    this.userId = undefined;
  }
}

/**
 * GA4 Adapter - Sends events to Google Analytics 4
 */
class GA4Adapter implements AnalyticsAdapter {
  name = 'ga4';
  private measurementId?: string;

  constructor(measurementId?: string) {
    this.measurementId = measurementId;
  }

  async initialize(): Promise<void> {
    if (!this.measurementId) {
      console.warn('[ChatAnalytics] GA4 measurement ID not provided');
      return;
    }

    if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>)['gtag']) {
      await this.loadGA4Script();
    }

    console.log('[ChatAnalytics] GA4 adapter initialized');
  }

  private async loadGA4Script(): Promise<void> {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
      script.async = true;
      script.onload = () => resolve();
      document.head.appendChild(script);

      // Initialize gtag
      const win = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
      if (!win.dataLayer) {
        win.dataLayer = [];
      }
      const gtagFn = function gtag(...args: unknown[]) {
        if (win.dataLayer) {
          win.dataLayer.push(args);
        }
      };
      win.gtag = gtagFn;
      gtagFn('js', new Date());
      gtagFn('config', this.measurementId);
    });
  }

  track(event: ChatAnalyticsEventData): void {
    if (!this.measurementId) return;

    const gtag = (window as unknown as Record<string, (...args: unknown[]) => void>)['gtag'];

    if (gtag) {
      gtag('event', event.event, event.properties);
    }
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    const gtag = (window as unknown as Record<string, (...args: unknown[]) => void>)['gtag'];

    if (gtag) {
      gtag('set', { user_id: userId, ...traits });
    }
  }

  reset(): void {
    // No-op for GA4
  }
}

// ============================================================================
// Chat Analytics Service
// ============================================================================

class ChatAnalyticsService {
  private initialized = false;
  private adapters: AnalyticsAdapter[] = [];
  private config: AnalyticsConfig = {
    enableConsoleLogging: true,
    enableBatching: true,
    batchIntervalMs: 5000,
    maxBatchSize: 50,
  };

  // Session tracking
  private widgetId: string;
  private sessionId: string;
  private conversationId?: string;
  private messageCount = 0;
  private startTime?: number;
  private typingStartTime?: number;

  // Error boundary
  private errorHandler?: (error: Error, context: string) => void;

  constructor() {
    this.widgetId = generateId('widget');
    this.sessionId = getSessionId();

    // Set up page unload handler
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
      window.addEventListener('pagehide', () => this.flush());
    }
  }

  /**
   * Initialize the analytics service with configuration
   */
  async initialize(config: AnalyticsConfig = {}): Promise<void> {
    if (this.initialized) {
      console.warn('[ChatAnalytics] Already initialized');
      return;
    }

    this.config = { ...this.config, ...config };

    // Set up default console logger if enabled
    if (this.config.enableConsoleLogging) {
      this.adapters.push(new ConsoleLoggerAdapter());
    }

    // Set up custom backend adapter if endpoint provided
    if (this.config.endpoint) {
      const backendAdapter = new CustomBackendAdapter(
        this.config.endpoint,
        this.config.apiKey,
        this.config.batchIntervalMs,
        this.config.maxBatchSize
      );
      this.adapters.push(backendAdapter);
    }

    // Initialize configured adapters
    for (const adapter of this.adapters) {
      try {
        await adapter.initialize();
      } catch (error) {
        console.error(`[ChatAnalytics] Failed to initialize adapter ${adapter.name}:`, error);
      }
    }

    // Identify user if logged in
    const userId = getUserId();
    if (userId) {
      this.identify(userId);
    }

    this.initialized = true;
    console.log('[ChatAnalytics] Service initialized', {
      adapters: this.adapters.map(a => a.name),
      config: this.config,
    });
  }

  /**
   * Set error handler for analytics errors
   */
  setErrorHandler(handler: (error: Error, context: string) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Create base properties for all events
   */
  private createBaseProperties(overrides?: Partial<BaseEventProperties>): BaseEventProperties {
    return {
      widget_id: this.widgetId,
      conversation_id: this.conversationId,
      user_id: getUserId(),
      session_id: this.sessionId,
      timestamp: getTimestamp(),
      platform: Capacitor.getPlatform(),
      ...overrides,
    };
  }

  /**
   * Track an event with error boundary
   */
  track(event: ChatAnalyticsEvent, properties: Partial<EventProperties> = {}): void {
    // Error boundary - prevent analytics failures from affecting UX
    try {
      const eventData: ChatAnalyticsEventData = {
        event,
        properties: this.createBaseProperties(properties as BaseEventProperties),
      };

      for (const adapter of this.adapters) {
        try {
          adapter.track(eventData);
        } catch (error) {
          console.error(`[ChatAnalytics] Adapter ${adapter.name} failed:`, error);
        }
      }
    } catch (error) {
      console.error('[ChatAnalytics] Track failed:', error);
      this.errorHandler?.(error as Error, `track:${event}`);
    }
  }

  /**
   * Identify user across all adapters
   */
  identify(userId: string, traits?: Record<string, unknown>): void {
    for (const adapter of this.adapters) {
      try {
        adapter.identify(userId, traits);
      } catch (error) {
        console.error(`[ChatAnalytics] Identify failed for adapter ${adapter.name}:`, error);
      }
    }
  }

  /**
   * Reset analytics state
   */
  reset(): void {
    for (const adapter of this.adapters) {
      try {
        adapter.reset();
      } catch (error) {
        console.error(`[ChatAnalytics] Reset failed for adapter ${adapter.name}:`, error);
      }
    }

    this.conversationId = undefined;
    this.messageCount = 0;
    this.startTime = undefined;
  }

  /**
   * Flush all pending events
   */
  flush(): void {
    const backendAdapter = this.adapters.find(a => a.name === 'custom_backend') as CustomBackendAdapter | undefined;
    if (backendAdapter?.flush) {
      backendAdapter.flush().catch(console.error);
    }
  }

  // ============================================================================
  // Widget Events
  // ============================================================================

  trackWidgetOpened(): void {
    this.track('widget_opened');
  }

  trackWidgetClosed(): void {
    this.track('widget_closed');
  }

  trackWidgetMinimized(): void {
    this.track('widget_minimized');
  }

  trackWidgetMaximized(): void {
    this.track('widget_maximized');
  }

  // ============================================================================
  // Chat Events
  // ============================================================================

  trackMessageSent(messageId: string, messageLength: number): void {
    this.track('message_sent', {
      message_id: messageId,
      message_length: messageLength,
      message_type: 'user',
    } as MessageEventProperties);

    this.messageCount++;
  }

  trackMessageReceived(messageId: string, messageLength: number, aiLatencyMs?: number): void {
    const responseTime = this.startTime ? Date.now() - this.startTime : 0;

    this.track('message_received', {
      message_id: messageId,
      message_length: messageLength,
      message_type: 'bot',
      response_time_ms: responseTime,
      ai_latency_ms: aiLatencyMs,
    } as MessageEventProperties);

    this.startTime = undefined;
  }

  trackTypingStarted(): void {
    this.typingStartTime = Date.now();
    this.track('typing_started');
  }

  trackTypingEnded(): void {
    if (this.typingStartTime) {
      const typingDuration = Date.now() - this.typingStartTime;
      this.track('typing_ended', {
        typing_duration_ms: typingDuration,
      } as unknown as ErrorProperties);
      this.typingStartTime = undefined;
    } else {
      this.track('typing_ended');
    }
  }

  // ============================================================================
  // Quick Action Events
  // ============================================================================

  trackQuickActionClick(
    actionId: string,
    actionLabel: string,
    actionType: 'link' | 'action' | 'suggestion',
    actionValue?: string
  ): void {
    this.track('quick_action_click', {
      action_id: actionId,
      action_label: actionLabel,
      action_type: actionType,
      action_value: actionValue,
    } as ActionEventProperties);
  }

  trackSuggestionClick(suggestion: string, messageId: string): void {
    this.track('suggestion_click', {
      action_id: messageId,
      action_label: suggestion,
      action_type: 'suggestion',
    } as ActionEventProperties);
  }

  trackActionPerformed(actionId: string, actionLabel: string, actionValue: string): void {
    this.track('action_performed', {
      action_id: actionId,
      action_label: actionLabel,
      action_value: actionValue,
    } as ActionEventProperties);
  }

  // ============================================================================
  // Escalation Events
  // ============================================================================

  trackEscalationRequested(reason: string): void {
    this.track('escalation_requested', {
      escalation_reason: reason,
    } as ConversationProperties);
  }

  trackEscalationAccepted(): void {
    this.track('escalation_accepted');
  }

  trackEscalationCompleted(): void {
    this.track('escalation_completed', {
      conversation_length: this.messageCount,
    } as ConversationProperties);
  }

  // ============================================================================
  // Error Events
  // ============================================================================

  trackError(type: ErrorEvent, message: string, code?: string, endpoint?: string, recoverable = true): void {
    this.track(type, {
      error_type: type,
      error_message: message,
      error_code: code,
      endpoint,
      recoverable,
    } as ErrorProperties);
  }

  trackNetworkError(endpoint?: string): void {
    this.trackError('network_error', 'Network request failed', undefined, endpoint);
  }

  trackApiError(endpoint: string, statusCode?: number): void {
    this.trackError('api_error', `API error: ${statusCode || 'unknown'}`, String(statusCode), endpoint);
  }

  trackAiError(message: string, recoverable = true): void {
    this.trackError('ai_error', message, undefined, '/api/ai/chat', recoverable);
  }

  // ============================================================================
  // Session Events
  // ============================================================================

  trackChatStarted(conversationId?: string): void {
    this.conversationId = conversationId || generateId('conv');
    this.messageCount = 0;
    this.startTime = Date.now();

    this.track('chat_started', {
      conversation_id: this.conversationId,
    });
  }

  trackChatEnded(): void {
    this.track('chat_ended', {
      conversation_length: this.messageCount,
    } as ConversationProperties);

    this.conversationId = undefined;
    this.messageCount = 0;
  }

  trackNewChatStarted(): void {
    this.conversationId = generateId('conv');
    this.messageCount = 0;
    this.startTime = Date.now();

    this.track('new_chat_started');
  }

  trackConversationResumed(conversationId: string): void {
    this.conversationId = conversationId;
    this.startTime = Date.now();

    this.track('conversation_resumed', {
      conversation_id: conversationId,
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Set current conversation ID
   */
  setConversationId(id: string): void {
    this.conversationId = id;
  }

  /**
   * Get current session info
   */
  getSessionInfo(): { widgetId: string; sessionId: string; conversationId?: string; messageCount: number } {
    return {
      widgetId: this.widgetId,
      sessionId: this.sessionId,
      conversationId: this.conversationId,
      messageCount: this.messageCount,
    };
  }

  /**
   * Start timing for response metrics
   */
  startResponseTimer(): void {
    this.startTime = Date.now();
  }

  /**
   * Get time since last message in ms
   */
  getResponseTimeMs(): number {
    return this.startTime ? Date.now() - this.startTime : 0;
  }
}

// Export singleton instance
export const chatAnalytics = new ChatAnalyticsService();

// ============================================================================
// React Hook for Chat Analytics
// ============================================================================

/**
 * Hook to use chat analytics in components
 * Provides typed methods for tracking all chat events
 */
export function useChatAnalytics() {
  return {
    // Widget events
    trackWidgetOpened: () => chatAnalytics.trackWidgetOpened(),
    trackWidgetClosed: () => chatAnalytics.trackWidgetClosed(),
    trackWidgetMinimized: () => chatAnalytics.trackWidgetMinimized(),
    trackWidgetMaximized: () => chatAnalytics.trackWidgetMaximized(),

    // Chat events
    trackMessageSent: (messageId: string, messageLength: number) =>
      chatAnalytics.trackMessageSent(messageId, messageLength),
    trackMessageReceived: (messageId: string, messageLength: number, aiLatencyMs?: number) =>
      chatAnalytics.trackMessageReceived(messageId, messageLength, aiLatencyMs),
    trackTypingStarted: () => chatAnalytics.trackTypingStarted(),
    trackTypingEnded: () => chatAnalytics.trackTypingEnded(),

    // Quick action events
    trackQuickActionClick: (
      actionId: string,
      actionLabel: string,
      actionType: 'link' | 'action' | 'suggestion',
      actionValue?: string
    ) => chatAnalytics.trackQuickActionClick(actionId, actionLabel, actionType, actionValue),
    trackSuggestionClick: (suggestion: string, messageId: string) =>
      chatAnalytics.trackSuggestionClick(suggestion, messageId),
    trackActionPerformed: (actionId: string, actionLabel: string, actionValue: string) =>
      chatAnalytics.trackActionPerformed(actionId, actionLabel, actionValue),

    // Escalation events
    trackEscalationRequested: (reason: string) => chatAnalytics.trackEscalationRequested(reason),
    trackEscalationAccepted: () => chatAnalytics.trackEscalationAccepted(),
    trackEscalationCompleted: () => chatAnalytics.trackEscalationCompleted(),

    // Error events
    trackError: (type: ErrorEvent, message: string, code?: string, endpoint?: string, recoverable?: boolean) =>
      chatAnalytics.trackError(type, message, code, endpoint, recoverable),
    trackNetworkError: (endpoint?: string) => chatAnalytics.trackNetworkError(endpoint),
    trackApiError: (endpoint: string, statusCode?: number) => chatAnalytics.trackApiError(endpoint, statusCode),
    trackAiError: (message: string, recoverable?: boolean) => chatAnalytics.trackAiError(message, recoverable),

    // Session events
    trackChatStarted: (conversationId?: string) => chatAnalytics.trackChatStarted(conversationId),
    trackChatEnded: () => chatAnalytics.trackChatEnded(),
    trackNewChatStarted: () => chatAnalytics.trackNewChatStarted(),
    trackConversationResumed: (conversationId: string) => chatAnalytics.trackConversationResumed(conversationId),

    // Utility
    setConversationId: (id: string) => chatAnalytics.setConversationId(id),
    getSessionInfo: () => chatAnalytics.getSessionInfo(),
    startResponseTimer: () => chatAnalytics.startResponseTimer(),
    getResponseTimeMs: () => chatAnalytics.getResponseTimeMs(),
  };
}

// ============================================================================
// React Error Boundary Component
// ============================================================================

import * as React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for Chat Analytics
 * Prevents analytics failures from affecting the UI
 */
export class ChatAnalyticsErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ChatAnalytics] Error boundary caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }

    return this.props.children;
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultAnalyticsConfig: AnalyticsConfig = {
  enableConsoleLogging: process.env.NODE_ENV === 'development',
  enableBatching: true,
  batchIntervalMs: 5000,
  maxBatchSize: 50,
};

export default chatAnalytics;