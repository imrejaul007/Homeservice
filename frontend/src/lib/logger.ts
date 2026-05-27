/**
 * Simple logger utility for frontend
 * Logs to console in development, silent in production (except errors)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private context: LogContext;
  private isProduction: boolean;

  constructor(context: LogContext = {}) {
    this.context = context;
    this.isProduction = import.meta.env.PROD;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = this.context ? `[${Object.values(this.context).join(' ')}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${prefix} ${message}`;
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context), context || '');
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context), context || '');
  }

  info(message: string, context?: LogContext): void {
    if (!this.isProduction) {
      console.log(this.formatMessage('info', message, context), context || '');
    }
  }

  debug(message: string, context?: LogContext): void {
    if (!this.isProduction) {
      console.debug(this.formatMessage('debug', message, context), context || '');
    }
  }

  // Create a child logger with additional context
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }
}

// Create default logger instance
const logger = new Logger({ service: 'app' });

export default logger;
