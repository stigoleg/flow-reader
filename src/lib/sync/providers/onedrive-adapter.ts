/**
 * OneDrive Sync Adapter
 * 
 * Uses Microsoft Graph API with OAuth2 PKCE for authentication.
 * Stores sync file in app-specific folder: /Apps/FlowReader/flowreader_state.enc
 */

import type { 
  SyncProvider, 
  EncryptedBlob, 
  UploadResult, 
  RemoteMetadata,
  OAuthTokens,
} from '../types';
import { generateCodeVerifier, generateCodeChallenge } from '../oauth-utils';
import { OAuthStorageHelper } from '../oauth-storage';


const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

const SYNC_FILE_PATH = '/flowreader_state.enc';
const CONTENT_FOLDER_PATH = '/content';
const TOKENS_STORAGE_KEY = 'onedriveTokens';
const PKCE_VERIFIER_KEY = 'onedrivePkceVerifier';
const CLIENT_ID_STORAGE_KEY = 'onedriveClientId';

// Scopes needed for OneDrive file access
const SCOPES = [
  'Files.ReadWrite.AppFolder',  // Access to app-specific folder
  'offline_access',             // Get refresh token
].join(' ');


export class OneDriveAdapter implements SyncProvider {
  readonly name = 'OneDrive';
  readonly providerType = 'onedrive' as const;
  readonly needsAuth = true;

  private tokens: OAuthTokens | null = null;
  private oauthStorage = new OAuthStorageHelper(TOKENS_STORAGE_KEY, PKCE_VERIFIER_KEY);

  /**
   * Set the Microsoft Client ID (provided by user)
   */
  async setClientId(clientId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [CLIENT_ID_STORAGE_KEY]: clientId }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get the stored Microsoft Client ID
   */
  private async getClientId(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([CLIENT_ID_STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[CLIENT_ID_STORAGE_KEY] as string || null);
      });
    });
  }

  /**
   * Start OAuth2 PKCE flow - returns the auth URL to open
   */
  async startAuth(): Promise<string> {
    const clientId = await this.getClientId();
    if (!clientId) {
      throw new OneDriveError('Microsoft Client ID not configured. Please set your Client ID first.', 'auth');
    }
    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store verifier for later
    await this.oauthStorage.storePkceVerifier(codeVerifier);

    // Get redirect URL (extension page)
    const redirectUri = chrome.identity.getRedirectURL();

    // Build auth URL
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      response_mode: 'query',
    });

    return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Complete OAuth2 flow with authorization code
   */
  async completeAuth(code: string): Promise<OAuthTokens> {
    const codeVerifier = await this.oauthStorage.getPkceVerifier();
    if (!codeVerifier) {
      throw new OneDriveError('PKCE verifier not found', 'auth');
    }

    const clientId = await this.getClientId();
    if (!clientId) {
      throw new OneDriveError('Microsoft Client ID not configured', 'auth');
    }

    const redirectUri = chrome.identity.getRedirectURL();

    const response = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        scope: SCOPES,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new OneDriveError(`Token exchange failed: ${error}`, 'auth');
    }

    const data = await response.json();
    
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type,
      scope: data.scope,
    };

    await this.oauthStorage.storeTokens(this.tokens);
    await this.oauthStorage.clearPkceVerifier();

    return this.tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<OAuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new OneDriveError('No refresh token available', 'auth');
    }

    const clientId = await this.getClientId();
    if (!clientId) {
      throw new OneDriveError('Microsoft Client ID not configured', 'auth');
    }

    const response = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refreshToken,
        scope: SCOPES,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new OneDriveError(`Token refresh failed: ${error}`, 'auth');
    }

    const data = await response.json();
    
    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.tokens.refreshToken, // Microsoft may return new refresh token
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type,
      scope: data.scope,
    };

    await this.oauthStorage.storeTokens(this.tokens);
    return this.tokens;
  }

  /**
   * Upload encrypted state to OneDrive
   * Uses the special approot folder which is automatically created
   */
  async upload(blob: EncryptedBlob): Promise<UploadResult> {
    try {
      await this.ensureValidToken();

      if (!this.tokens) {
        return { success: false, updatedAt: Date.now(), error: 'Not authenticated' };
      }

      const content = JSON.stringify(blob, null, 2);

      // Use special approot path - OneDrive creates the app folder automatically
      // Path: /drive/special/approot:/filename:/content
      const uploadUrl = `${GRAPH_API_URL}/me/drive/special/approot:${SYNC_FILE_PATH}:/content`;

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Content-Type': 'application/json',
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
        updatedAt: new Date(data.lastModifiedDateTime).getTime(),
        etag: data.eTag,
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
   * Download encrypted state from OneDrive
   */
  async download(): Promise<EncryptedBlob | null> {
    await this.ensureValidToken();

    if (!this.tokens) {
      return null;
    }

    try {
      // Get the file content using the special approot path
      const downloadUrl = `${GRAPH_API_URL}/me/drive/special/approot:${SYNC_FILE_PATH}:/content`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
        },
      });

      if (response.status === 404) {
        // File not found
        return null;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new OneDriveError(`Download failed: ${error}`, 'download');
      }

      const content = await response.text();
      return JSON.parse(content) as EncryptedBlob;
    } catch (error) {
      if (error instanceof OneDriveError) {
        throw error;
      }
      // Check for 404 in error
      if (error instanceof Error && error.message.includes('404')) {
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
      // Get file metadata using the special approot path
      const metadataUrl = `${GRAPH_API_URL}/me/drive/special/approot:${SYNC_FILE_PATH}`;

      const response = await fetch(metadataUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
        },
      });

      if (response.status === 404) {
        // File not found
        return { exists: false, updatedAt: 0, size: 0 };
      }

      if (!response.ok) {
        return { exists: false, updatedAt: 0, size: 0 };
      }

      const data = await response.json();
      
      return {
        exists: true,
        updatedAt: new Date(data.lastModifiedDateTime).getTime(),
        size: data.size,
        etag: data.eTag,
      };
    } catch {
      return { exists: false, updatedAt: 0, size: 0 };
    }
  }

  /**
   * Check if connected to OneDrive
   */
  async isConnected(): Promise<boolean> {
    if (!this.tokens) {
      // Try to load tokens from storage
      this.tokens = await this.oauthStorage.getStoredTokens();
    }
    return this.tokens !== null;
  }

  /**
   * Disconnect from OneDrive
   */
  async disconnect(): Promise<void> {
    // Microsoft doesn't have a simple token revocation endpoint for consumer accounts
    // The token will eventually expire on its own
    // We just clear local storage
    this.tokens = null;
    await this.oauthStorage.clearTokens();
  }


  /**
   * Ensure the content folder exists in OneDrive app folder
   */
  async ensureContentFolder(): Promise<void> {
    await this.ensureValidToken();
    if (!this.tokens) return;

    try {
      // Try to get folder metadata first
      const metadataUrl = `${GRAPH_API_URL}/me/drive/special/approot:${CONTENT_FOLDER_PATH}`;
      
      const response = await fetch(metadataUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
        },
      });

      if (response.status === 404) {
        // Folder doesn't exist - create it
        const createUrl = `${GRAPH_API_URL}/me/drive/special/approot/children`;
        
        await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'content',
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          }),
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
      const listUrl = `${GRAPH_API_URL}/me/drive/special/approot:${CONTENT_FOLDER_PATH}:/children`;
      
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
        },
      });

      if (response.status === 404) {
        // Folder doesn't exist
        return [];
      }

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const files: string[] = [];
      
      for (const item of data.value || []) {
        if (item.file) {
          files.push(item.name);
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
      const uploadUrl = `${GRAPH_API_URL}/me/drive/special/approot:${filePath}:/content`;
      const content = await data.arrayBuffer();

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
          'Content-Type': 'application/octet-stream',
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
      const downloadUrl = `${GRAPH_API_URL}/me/drive/special/approot:${filePath}:/content`;
      
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
        },
      });

      if (response.status === 404) {
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
      const deleteUrl = `${GRAPH_API_URL}/me/drive/special/approot:${filePath}`;
      
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.tokens.accessToken}`,
        },
      });
    } catch {
      // Ignore errors - file might not exist
    }
  }


  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) {
      this.tokens = await this.oauthStorage.getStoredTokens();
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
}


export class OneDriveError extends Error {
  constructor(
    message: string,
    public readonly operation: 'auth' | 'upload' | 'download' | 'metadata'
  ) {
    super(message);
    this.name = 'OneDriveError';
  }
}


export const oneDriveAdapter = new OneDriveAdapter();
