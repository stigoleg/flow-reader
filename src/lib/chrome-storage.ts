/**
 * Chrome Storage Wrapper
 * 
 * Promise-based wrapper around chrome.storage.local with consistent error handling.
 * All storage operations should use this module instead of direct chrome.storage calls.
 */

import { StorageError } from './errors';

/**
 * Check for chrome.runtime.lastError and throw StorageError if present.
 */
function checkLastError(operation: string): void {
  if (chrome.runtime.lastError) {
    throw new StorageError(
      chrome.runtime.lastError.message || 'Unknown storage error',
      operation
    );
  }
}

/**
 * Get values from chrome.storage.local.
 * 
 * @param keys - Keys to retrieve, or null to get all values
 * @returns Promise resolving to the stored values
 */
export async function get<T extends Record<string, unknown>>(
  keys: string | string[] | null
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      try {
        checkLastError('get');
        resolve(result as T);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Set values in chrome.storage.local.
 * 
 * @param values - Object containing key-value pairs to store
 */
export async function set(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      try {
        checkLastError('set');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Remove keys from chrome.storage.local.
 * 
 * @param keys - Keys to remove
 */
export async function remove(keys: string | string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      try {
        checkLastError('remove');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Clear all values from chrome.storage.local.
 */
export async function clear(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      try {
        checkLastError('clear');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Get a single value from chrome.storage.local.
 * 
 * @param key - Key to retrieve
 * @returns Promise resolving to the stored value, or undefined if not found
 */
export async function getOne<T>(key: string): Promise<T | undefined> {
  const result = await get<Record<string, T>>([key]);
  return result[key];
}

/**
 * Set a single value in chrome.storage.local.
 * 
 * @param key - Key to set
 * @param value - Value to store
 */
export async function setOne<T>(key: string, value: T): Promise<void> {
  return set({ [key]: value });
}
