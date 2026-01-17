/**
 * Dropbox Sync Adapter
 * 
 * Uses Dropbox HTTP API with OAuth2 PKCE for authentication.
 * Stores sync file in app-scoped folder: /Apps/FlowReader/flowreader_state.enc
 */

import type { 
  SyncProvider, 
  EncryptedBlob, 
  UploadResult, 
  RemoteMetadata,
  OAuthTokens,
} from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_URL = 'https://content.dropboxapi.com/2';

const SYNC_FILE_PATH = '/flowreader_state.enc';
const CONTENT_FOLDER_PATH = '/content';
const TOKENS_STORAGE_KEY = 'dropboxTokens';
const PKCE_VERIFIER_KEY = 'dropboxPkceVerifier';
const APP_KEY_STORAGE_KEY = 'dropboxAppKey';

// =============================================================================
// DROPBOX ADAPTER CLASS
// =============================================================================

export class DropboxAdapter implements SyncProvider {
  readonly name = 'Dropbox';
  readonly providerType = 'dropbox' as const;
  readonly needsAuth = true;

  private tokens: OAuthTokens | null = null;
  private appKey: string | null = null;

  /**
   * Set the Dropbox App Key (provided by user)
   */
  setAppKey(key: string): void {
    this.appKey = key;
    // Also store it for persistence
    chrome.storage.local.set({ [APP_KEY_STORAGE_KEY]: key });
  }

  /**
   * Get the app key, loading from storage if needed
   */
  private async getAppKey(): Promise<string> {
    if (this.appKey) return this.appKey;
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([APP_KEY_STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const key = result[APP_KEY_STORAGE_KEY] as string;
        if (!key) {
          reject(new DropboxError('Dropbox App Key not configured', 'auth'));
          return;
        }
        this.appKey = key;
        resolve(key);
      });
    });
  }

  /**
   * Start OAuth2 PKCE flow - returns the auth URL to open
   */
  async startAuth(): Promise<string> {
    const appKey = await this.getAppKey();
    
    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store verifier for later
    await this.storePkceVerifier(codeVerifier);

    // Get redirect URL (extension page)
    const redirectUri = chrome.identity.getRedirectURL();

    // Build auth URL
    const params = new URLSearchParams({
      client_id: appKey,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri,
      token_access_type: 'offline', // Get refresh token
    });

    return `${DROPBOX_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Complete OAuth2 flow with authorization code
   */
  async completeAuth(code: string): Promise<OAuthTokens> {
    const appKey = await this.getAppKey();
    const codeVerifier = await this.getPkceVerifier();
    if (!codeVerifier) {
      throw new DropboxError('PKCE verifier not found', 'auth');
    }

    const redirectUri = chrome.identity.getRedirectURL();

    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
        client_id: appKey,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DropboxError(`Token exchange failed: ${error}`, 'auth');
    }

    const data = await response.json();
    
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type,
      scope: data.scope,
    };

    await this.storeTokens(this.tokens);
    await this.clearPkceVerifier();

    return this.tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<OAuthTokens> {
    const appKey = await this.getAppKey();
    
    if (!this.tokens?.refreshToken) {
      throw new DropboxError('No refresh token available', 'auth');
    }

    const response = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refreshToken,
        client_id: appKey,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DropboxError(`Token refresh failed: ${error}`, 'auth');
    }

    const data = await response.json();
    
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: this.tokens.refreshToken, // Keep existing refresh token
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type,
      scope: data.scope,
    };

    await this.storeTokens(this.tokens);
    return this.tokens;
  }

  /**
   * Upload encrypted state to Dropbox
   */
  async upload(blob: EncryptedBlob): Promise<UploadResult> {
    try {
      await this.ensureValidToken();

      if (!this.tokens) {
        return { success: false, updatedAt: Date.now(), error: 'Not authenticated' };
      }

      const content = JSON.stringify(blob, null, 2);

      const response = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: SYNC_FILE_PATH,
            mode: 'overwrite',
            autorename: false,
            mute: true,
          }),
        },
        body: content,
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, updatedAt: Date.now(), error: `Upload failed: ${error}` };
      }

      const data = await response.json();

      return {
        success: true,
        updatedAt: Date.now(),
        etag: data.rev,
      };
    } catch (error) {
      return {
        success: false,
        updatedAt: Date.now(),
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Download encrypted state from Dropbox
   */
  async download(): Promise<EncryptedBlob | null> {
    await this.ensureValidToken();

    if (!this.tokens) {
      return null;
    }

    try {
      const response = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: SYNC_FILE_PATH }),
        },
      });

      if (response.status === 409) {
        // File not found - check for path/not_found error
        const errorData = await response.json();
        if (errorData?.error?.['.tag'] === 'path' && 
            errorData?.error?.path?.['.tag'] === 'not_found') {
          return null;
        }
        throw new DropboxError(`Download failed: ${JSON.stringify(errorData)}`, 'download');
      }

      if (!response.ok) {
        const error = await response.text();
        throw new DropboxError(`Download failed: ${error}`, 'download');
      }

      const content = await response.text();
      return JSON.parse(content) as EncryptedBlob;
    } catch (error) {
      if (error instanceof DropboxError) {
        throw error;
      }
      // Check for not_found in error message
      if (error instanceof Error && error.message.includes('not_found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get metadata about remote sync file
   */
  async getRemoteMetadata(): Promise<RemoteMetadata> {
    await this.ensureValidToken();

    if (!this.tokens) {
      return { exists: false, updatedAt: 0, size: 0 };
    }

    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/get_metadata`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: SYNC_FILE_PATH }),
      });

      if (response.status === 409) {
        // File not found
        return { exists: false, updatedAt: 0, size: 0 };
      }

      if (!response.ok) {
        return { exists: false, updatedAt: 0, size: 0 };
      }

      const data = await response.json();
      
      return {
        exists: true,
        updatedAt: new Date(data.server_modified).getTime(),
        size: data.size,
        etag: data.rev,
      };
    } catch {
      return { exists: false, updatedAt: 0, size: 0 };
    }
  }

  /**
   * Check if connected to Dropbox
   */
  async isConnected(): Promise<boolean> {
    if (!this.tokens) {
      // Try to load tokens from storage
      this.tokens = await this.getStoredTokens();
    }
    return this.tokens !== null;
  }

  /**
   * Disconnect from Dropbox
   */
  async disconnect(): Promise<void> {
    if (this.tokens) {
      // Revoke token
      try {
        await fetch(`${DROPBOX_API_URL}/auth/token/revoke`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.tokens.accessToken}`,
          },
        });
      } catch {
        // Ignore errors during revocation
      }
    }

    this.tokens = null;
    await this.clearTokens();
  }

  // ===========================================================================
  // CONTENT FILE OPERATIONS
  // ===========================================================================

  /**
   * Ensure the content folder exists in Dropbox
   */
  async ensureContentFolder(): Promise<void> {
    await this.ensureValidToken();
    if (!this.tokens) return;

    try {
      // Try to get folder metadata first
      const response = await fetch(`${DROPBOX_API_URL}/files/get_metadata`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: CONTENT_FOLDER_PATH }),
      });

      if (response.status === 409) {
        // Folder doesn't exist - create it
        await fetch(`${DROPBOX_API_URL}/files/create_folder_v2`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path: CONTENT_FOLDER_PATH, autorename: false }),
        });
      }
    } catch {
      // Ignore errors - folder might already exist
    }
  }

  /**
   * List all content files in the content folder
   */
  async listContentFiles(): Promise<string[]> {
    await this.ensureValidToken();
    if (!this.tokens) return [];

    try {
      const response = await fetch(`${DROPBOX_API_URL}/files/list_folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: CONTENT_FOLDER_PATH }),
      });

      if (response.status === 409) {
        // Folder doesn't exist
        return [];
      }

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const files: string[] = [];
      
      for (const entry of data.entries) {
        if (entry['.tag'] === 'file') {
          files.push(entry.name);
        }
      }

      return files;
    } catch {
      return [];
    }
  }

  /**
   * Upload a content file to the content folder
   */
  async uploadContentFile(filename: string, data: Blob): Promise<UploadResult> {
    try {
      await this.ensureValidToken();
      if (!this.tokens) {
        return { success: false, updatedAt: Date.now(), error: 'Not authenticated' };
      }

      const filePath = `${CONTENT_FOLDER_PATH}/${filename}`;
      const content = await data.arrayBuffer();

      const response = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: filePath,
            mode: 'overwrite',
            autorename: false,
            mute: true,
          }),
        },
        body: content,
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, updatedAt: Date.now(), error: `Upload failed: ${error}` };
      }

      return {
        success: true,
        updatedAt: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        updatedAt: Date.now(),
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Download a content file from the content folder
   */
  async downloadContentFile(filename: string): Promise<Blob | null> {
    await this.ensureValidToken();
    if (!this.tokens) return null;

    try {
      const filePath = `${CONTENT_FOLDER_PATH}/${filename}`;
      
      const response = await fetch(`${DROPBOX_CONTENT_URL}/files/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
        },
      });

      if (response.status === 409) {
        // File not found
        return null;
      }

      if (!response.ok) {
        return null;
      }

      return await response.blob();
    } catch {
      return null;
    }
  }

  /**
   * Delete a content file from the content folder
   */
  async deleteContentFile(filename: string): Promise<void> {
    await this.ensureValidToken();
    if (!this.tokens) return;

    try {
      const filePath = `${CONTENT_FOLDER_PATH}/${filename}`;
      
      await fetch(`${DROPBOX_API_URL}/files/delete_v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath }),
      });
    } catch {
      // Ignore errors - file might not exist
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) {
      this.tokens = await this.getStoredTokens();
    }

    if (!this.tokens) {
      return;
    }

    // Check if token is expired (with 5 minute buffer)
    if (this.tokens.expiresAt && this.tokens.expiresAt < Date.now() + 300000) {
      if (this.tokens.refreshToken) {
        await this.refreshToken();
      }
    }
  }

  private async storeTokens(tokens: OAuthTokens): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [TOKENS_STORAGE_KEY]: tokens }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  private async getStoredTokens(): Promise<OAuthTokens | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([TOKENS_STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[TOKENS_STORAGE_KEY] as OAuthTokens || null);
      });
    });
  }

  private async clearTokens(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([TOKENS_STORAGE_KEY], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  private async storePkceVerifier(verifier: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [PKCE_VERIFIER_KEY]: verifier }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  private async getPkceVerifier(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([PKCE_VERIFIER_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[PKCE_VERIFIER_KEY] as string || null);
      });
    });
  }

  private async clearPkceVerifier(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([PKCE_VERIFIER_KEY], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
}

// =============================================================================
// PKCE HELPERS
// =============================================================================

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// =============================================================================
// ERROR TYPE
// =============================================================================

export class DropboxError extends Error {
  constructor(
    message: string,
    public readonly operation: 'auth' | 'upload' | 'download' | 'metadata'
  ) {
    super(message);
    this.name = 'DropboxError';
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const dropboxAdapter = new DropboxAdapter();
