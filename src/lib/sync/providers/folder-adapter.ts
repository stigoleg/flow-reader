/**
 * Folder Sync Adapter
 * 
 * Uses the File System Access API to sync to a user-selected folder.
 * This works with iCloud Drive, Google Drive folder, Dropbox folder, or any local folder.
 * The desktop sync app handles cross-device synchronization.
 */

import type { 
  SyncProvider, 
  EncryptedBlob, 
  UploadResult, 
  RemoteMetadata 
} from '../types';


const SYNC_FILE_NAME = 'flowreader_state.enc';
const CONTENT_FOLDER_NAME = 'content';
const FOLDER_HANDLE_KEY = 'folderSyncHandle';


export class FolderAdapter implements SyncProvider {
  readonly name = 'Folder Sync';
  readonly providerType = 'folder' as const;
  readonly needsAuth = false;

  private folderHandle: FileSystemDirectoryHandle | null = null;
  private folderPath: string | null = null;

  /**
   * Prompt user to select a folder for sync
   */
  async selectFolder(): Promise<{ handle: FileSystemDirectoryHandle; path: string }> {
    // Check if File System Access API is available
    if (!('showDirectoryPicker' in window)) {
      throw new FolderSyncError(
        'Folder sync is not supported in this browser. Use Chrome, Edge, or another Chromium-based browser.',
        'select-folder'
      );
    }

    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });

      this.folderHandle = handle;
      this.folderPath = handle.name;

      // Store handle for persistence
      await this.storeHandle(handle);

      return { handle, path: handle.name };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new FolderSyncError('Folder selection was cancelled', 'select-folder');
      }
      throw error;
    }
  }

  /**
   * Restore folder handle from storage (if permission persists)
   */
  async restoreHandle(): Promise<boolean> {
    try {
      const stored = await this.getStoredHandle();
      if (!stored) {
        return false;
      }

      // Check if we still have permission
      const permission = await stored.queryPermission({ mode: 'readwrite' });
      
      if (permission === 'granted') {
        this.folderHandle = stored;
        this.folderPath = stored.name;
        return true;
      }

      // Try to request permission
      const requested = await stored.requestPermission({ mode: 'readwrite' });
      if (requested === 'granted') {
        this.folderHandle = stored;
        this.folderPath = stored.name;
        return true;
      }

      return false;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[FlowReader:FolderSync] restoreHandle failed:', error);
      }
      return false;
    }
  }

  /**
   * Upload encrypted state to folder
   */
  async upload(blob: EncryptedBlob): Promise<UploadResult> {
    if (!this.folderHandle) {
      return { 
        success: false, 
        updatedAt: Date.now(), 
        error: 'No folder selected' 
      };
    }

    try {
      // Verify we still have permission
      const permission = await this.folderHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        return { 
          success: false, 
          updatedAt: Date.now(), 
          error: 'Folder permission denied. Please re-select the folder.' 
        };
      }

      // Get or create the sync file
      const fileHandle = await this.folderHandle.getFileHandle(SYNC_FILE_NAME, { create: true });
      
      // Write the encrypted blob as JSON
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(blob, null, 2));
      await writable.close();

      return {
        success: true,
        updatedAt: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        updatedAt: Date.now(),
        error: error instanceof Error ? error.message : 'Failed to write sync file',
      };
    }
  }

  /**
   * Download encrypted state from folder
   */
  async download(): Promise<EncryptedBlob | null> {
    if (!this.folderHandle) {
      return null;
    }

    try {
      // Verify permission
      const permission = await this.folderHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        return null;
      }

      // Try to get the sync file
      const fileHandle = await this.folderHandle.getFileHandle(SYNC_FILE_NAME);
      const file = await fileHandle.getFile();
      const content = await file.text();
      
      return JSON.parse(content) as EncryptedBlob;
    } catch (error) {
      // File doesn't exist yet - that's OK
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get metadata about remote sync file
   */
  async getRemoteMetadata(): Promise<RemoteMetadata> {
    if (!this.folderHandle) {
      return { exists: false, updatedAt: 0, size: 0 };
    }

    try {
      // Verify permission
      const permission = await this.folderHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        return { exists: false, updatedAt: 0, size: 0 };
      }

      const fileHandle = await this.folderHandle.getFileHandle(SYNC_FILE_NAME);
      const file = await fileHandle.getFile();
      
      return {
        exists: true,
        updatedAt: file.lastModified,
        size: file.size,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return { exists: false, updatedAt: 0, size: 0 };
      }
      throw error;
    }
  }

  /**
   * Check if folder is connected
   */
  async isConnected(): Promise<boolean> {
    if (!this.folderHandle) {
      // Try to restore from storage
      return await this.restoreHandle();
    }

    try {
      const permission = await this.folderHandle.queryPermission({ mode: 'readwrite' });
      return permission === 'granted';
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[FlowReader:FolderSync] isConnected permission check failed:', error);
      }
      return false;
    }
  }

  /**
   * Disconnect folder sync
   */
  async disconnect(): Promise<void> {
    this.folderHandle = null;
    this.folderPath = null;
    await this.clearStoredHandle();
  }

  /**
   * Get the current folder path (for display)
   */
  getFolderPath(): string | null {
    return this.folderPath;
  }


  /**
   * Ensure the content subfolder exists
   */
  async ensureContentFolder(): Promise<void> {
    if (!this.folderHandle) {
      throw new FolderSyncError('No folder selected', 'write');
    }

    try {
      await this.folderHandle.getDirectoryHandle(CONTENT_FOLDER_NAME, { create: true });
    } catch (error) {
      throw new FolderSyncError(
        `Failed to create content folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'write'
      );
    }
  }

  /**
   * List all content files in the content subfolder
   */
  async listContentFiles(): Promise<string[]> {
    if (!this.folderHandle) {
      return [];
    }

    try {
      const contentFolder = await this.folderHandle.getDirectoryHandle(CONTENT_FOLDER_NAME, { create: false });
      const files: string[] = [];
      
      // Use entries() which is more widely supported
      // @ts-expect-error - FileSystemDirectoryHandle iteration is not well-typed
      for await (const [name, handle] of contentFolder.entries()) {
        if (handle.kind === 'file') {
          files.push(name);
        }
      }
      
      return files;
    } catch (error) {
      // Folder doesn't exist - that's OK
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Upload a content file to the content subfolder
   */
  async uploadContentFile(filename: string, data: Blob): Promise<UploadResult> {
    if (!this.folderHandle) {
      return { 
        success: false, 
        updatedAt: Date.now(), 
        error: 'No folder selected' 
      };
    }

    try {
      // Verify we still have permission
      const permission = await this.folderHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        return { 
          success: false, 
          updatedAt: Date.now(), 
          error: 'Folder permission denied. Please re-select the folder.' 
        };
      }

      // Get or create content folder
      const contentFolder = await this.folderHandle.getDirectoryHandle(CONTENT_FOLDER_NAME, { create: true });
      
      // Get or create the file
      const fileHandle = await contentFolder.getFileHandle(filename, { create: true });
      
      // Write the blob
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();

      return {
        success: true,
        updatedAt: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        updatedAt: Date.now(),
        error: error instanceof Error ? error.message : 'Failed to write content file',
      };
    }
  }

  /**
   * Download a content file from the content subfolder
   */
  async downloadContentFile(filename: string): Promise<Blob | null> {
    if (!this.folderHandle) {
      return null;
    }

    try {
      // Verify permission
      const permission = await this.folderHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        return null;
      }

      // Get content folder
      const contentFolder = await this.folderHandle.getDirectoryHandle(CONTENT_FOLDER_NAME, { create: false });
      
      // Get the file
      const fileHandle = await contentFolder.getFileHandle(filename);
      const file = await fileHandle.getFile();
      
      return file;
    } catch (error) {
      // File or folder doesn't exist - that's OK
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a content file from the content subfolder
   */
  async deleteContentFile(filename: string): Promise<void> {
    if (!this.folderHandle) {
      return;
    }

    try {
      // Get content folder
      const contentFolder = await this.folderHandle.getDirectoryHandle(CONTENT_FOLDER_NAME, { create: false });
      
      // Delete the file
      await contentFolder.removeEntry(filename);
    } catch (error) {
      // File or folder doesn't exist - that's OK
      // Also handle other non-critical DOMExceptions gracefully
      if (error instanceof DOMException) {
        // NotFoundError: file doesn't exist
        // InvalidStateError: handle may have been invalidated
        // NotAllowedError: permission may have been revoked
        if (error.name === 'NotFoundError' || 
            error.name === 'InvalidStateError' ||
            error.name === 'NotAllowedError') {
          return;
        }
      }
      throw error;
    }
  }

  // PRIVATE METHODS - Handle persistence using IndexedDB

  private async storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FlowReaderSync', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('handles', 'readwrite');
        const store = tx.objectStore('handles');
        store.put(handle, FOLDER_HANDLE_KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }

  private async getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FlowReaderSync', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('handles', 'readonly');
        const store = tx.objectStore('handles');
        const getRequest = store.get(FOLDER_HANDLE_KEY);
        
        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result as FileSystemDirectoryHandle | null);
        };
        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
    });
  }

  private async clearStoredHandle(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FlowReaderSync', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('handles', 'readwrite');
        const store = tx.objectStore('handles');
        store.delete(FOLDER_HANDLE_KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }
}


export class FolderSyncError extends Error {
  constructor(
    message: string,
    public readonly operation: 'select-folder' | 'read' | 'write'
  ) {
    super(message);
    this.name = 'FolderSyncError';
  }
}


export const folderAdapter = new FolderAdapter();
