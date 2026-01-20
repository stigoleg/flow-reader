/**
 * Standardized Logger Utility
 * 
 * Provides consistent logging across FlowReader with:
 * - Module-scoped loggers with consistent prefixes
 * - Dev-only logging by default (stripped in production)
 * - Type-safe log levels
 * - Optional forced logging for critical errors
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  /** Force logging even in production (use sparingly) */
  forceInProduction?: boolean;
}

interface Logger {
  /** Debug level - verbose information, dev only */
  debug: (...args: unknown[]) => void;
  /** Info level - general information, dev only */
  info: (...args: unknown[]) => void;
  /** Warn level - warnings, dev only by default */
  warn: (...args: unknown[]) => void;
  /** Error level - errors, dev only by default */
  error: (...args: unknown[]) => void;
  /** Force log regardless of environment (use for critical production errors) */
  forceError: (...args: unknown[]) => void;
  /** Create a sub-logger with additional context */
  child: (subModule: string) => Logger;
}

const isDev = import.meta.env.DEV;

/**
 * Create a logger for a specific module
 * 
 * @example
 * const log = createLogger('Sync');
 * log.info('Starting sync...'); // [FlowReader:Sync] Starting sync...
 * log.warn('Connection slow', { latency: 500 }); // [FlowReader:Sync] Connection slow { latency: 500 }
 */
export function createLogger(module: string, options: LoggerOptions = {}): Logger {
  const prefix = `[FlowReader:${module}]`;
  const { forceInProduction = false } = options;
  
  const shouldLog = (_level: LogLevel): boolean => {
    // Always log in dev mode
    if (isDev) return true;
    
    // In production, only log if forced
    if (forceInProduction) return true;
    
    // By default, suppress all logging in production
    return false;
  };

  const log = (level: LogLevel, ...args: unknown[]) => {
    if (!shouldLog(level)) return;
    
    switch (level) {
      case 'debug':
        console.debug(prefix, ...args);
        break;
      case 'info':
        console.log(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'error':
        console.error(prefix, ...args);
        break;
    }
  };

  const logger: Logger = {
    debug: (...args: unknown[]) => log('debug', ...args),
    info: (...args: unknown[]) => log('info', ...args),
    warn: (...args: unknown[]) => log('warn', ...args),
    error: (...args: unknown[]) => log('error', ...args),
    forceError: (...args: unknown[]) => {
      // Always log, even in production
      console.error(prefix, ...args);
    },
    child: (subModule: string) => createLogger(`${module}:${subModule}`, options),
  };

  return logger;
}

/**
 * Pre-configured loggers for common modules
 */
export const loggers = {
  sync: createLogger('Sync'),
  dropbox: createLogger('Dropbox'),
  folderSync: createLogger('FolderSync'),
  epub: createLogger('EPUB'),
  mobi: createLogger('MOBI'),
  storage: createLogger('Storage'),
  archive: createLogger('Archive'),
  reader: createLogger('Reader'),
  stats: createLogger('Stats'),
  migrations: createLogger('Migrations'),
} as const;

/**
 * Assertion helper that logs in dev mode
 * Useful for catching impossible states during development
 */
export function devAssert(condition: unknown, message: string, ...args: unknown[]): asserts condition {
  if (!condition) {
    const error = new Error(`Assertion failed: ${message}`);
    if (isDev) {
      console.error('[FlowReader:Assert]', message, ...args);
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Log a deprecation warning (dev only)
 */
export function logDeprecation(message: string, replacement?: string): void {
  if (isDev) {
    const replacementMsg = replacement ? ` Use ${replacement} instead.` : '';
    console.warn(`[FlowReader:Deprecated] ${message}${replacementMsg}`);
  }
}

/**
 * Performance timing helper (dev only)
 * Returns a function to call when the operation is complete
 * 
 * @example
 * const done = timeOperation('Sync', 'full sync');
 * await performSync();
 * done(); // Logs: [FlowReader:Sync] full sync took 1234ms
 */
export function timeOperation(module: string, operationName: string): () => void {
  if (!isDev) {
    return () => {}; // No-op in production
  }
  
  const start = performance.now();
  const prefix = `[FlowReader:${module}]`;
  
  return () => {
    const duration = Math.round(performance.now() - start);
    console.log(`${prefix} ${operationName} took ${duration}ms`);
  };
}
