/**
 * Lightweight Logger Utility
 * Story 11.5: CI/CD & Test Coverage Hardening
 *
 * Provides structured logging with environment-aware log levels.
 * In production, debug and info logs are suppressed to reduce noise.
 * Warn and error logs are always emitted.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): number {
  if (process.env.NODE_ENV === 'production') return LOG_LEVELS.warn;
  if (process.env.NODE_ENV === 'test') return LOG_LEVELS.error;
  return LOG_LEVELS.debug;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= getMinLevel();
}

function formatMessage(level: LogLevel, tag: string, message: string): string {
  return `[${level.toUpperCase()}] [${tag}] ${message}`;
}

export const logger = {
  debug(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', tag, message), ...args);
    }
  },

  info(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', tag, message), ...args);
    }
  },

  warn(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', tag, message), ...args);
    }
  },

  error(tag: string, message: string, ...args: unknown[]) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', tag, message), ...args);
    }
  },
};
