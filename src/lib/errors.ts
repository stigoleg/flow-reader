/**
 * Shared Error Classes
 * 
 * Standardized error types for consistent error handling across the codebase.
 */

/**
 * Base class for FlowReader errors.
 * Provides consistent error structure with operation context.
 */
export abstract class FlowReaderError extends Error {
  abstract readonly code: string;
  
  constructor(
    message: string,
    public readonly operation: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error thrown when a Chrome storage operation fails.
 */
export class StorageError extends FlowReaderError {
  readonly code = 'STORAGE_ERROR';
  
  constructor(message: string, operation: string) {
    super(message, operation);
  }
}

/**
 * Error thrown when a sync operation fails.
 */
export class SyncError extends FlowReaderError {
  readonly code = 'SYNC_ERROR';
  
  constructor(
    message: string,
    operation: 'configuration' | 'sync' | 'upload' | 'download' | 'decrypt',
  ) {
    super(message, operation);
  }
}

/**
 * Error thrown when content extraction fails.
 */
export class ExtractionError extends FlowReaderError {
  readonly code = 'EXTRACTION_ERROR';
  
  constructor(
    message: string,
    operation: 'parse' | 'readability' | 'normalize' | 'cleanup',
  ) {
    super(message, operation);
  }
}
