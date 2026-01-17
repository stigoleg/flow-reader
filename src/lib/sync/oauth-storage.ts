/**
 * OAuth Storage Helper
 * 
 * Shared utilities for storing and retrieving OAuth tokens and PKCE verifiers
 * in Chrome storage. Used by Dropbox and OneDrive adapters.
 */

import type { OAuthTokens } from './types';

/**
 * Helper class for managing OAuth token storage in Chrome extension storage.
 * Each adapter instance should create its own OAuthStorageHelper with unique keys.
 */
export class OAuthStorageHelper {
  constructor(
    private tokensKey: string,
    private pkceKey: string
  ) {}

  async storeTokens(tokens: OAuthTokens): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [this.tokensKey]: tokens }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async getStoredTokens(): Promise<OAuthTokens | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([this.tokensKey], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[this.tokensKey] as OAuthTokens || null);
      });
    });
  }

  async clearTokens(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([this.tokensKey], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async storePkceVerifier(verifier: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [this.pkceKey]: verifier }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async getPkceVerifier(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([this.pkceKey], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[this.pkceKey] as string || null);
      });
    });
  }

  async clearPkceVerifier(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([this.pkceKey], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
}
