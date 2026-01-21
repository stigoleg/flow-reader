/**
 * Sync Service
 * 
 * Core sync orchestration service that coordinates:
 * - Provider management (connect, disconnect)
 * - Encryption/decryption of state
 * - Merge conflict resolution
 * - Sync status tracking
 */

import { storageFacade } from '../storage-facade';
import { SyncError } from '../errors';
import { encrypt, decrypt, generateSalt, getSaltFromBlob } from './encryption';
import { mergeStates } from './merge';
import { contentSyncManager } from './content-sync';
import { 
  arrayBufferToBase64, 
  base64ToUint8Array, 
  unicodeToBase64, 
  base64ToUnicode 
} from '../encoding';
import * as chromeStorage from '../chrome-storage';
import type { 
  SyncProvider, 
  SyncProviderType, 
  SyncStatus, 
  SyncResult,
  SyncStateDocument,
  SyncEventCallback,
  SyncEvent,
  EncryptedBlob,
  SyncPhase,
} from './types';


const SYNC_CONFIG_KEY = 'syncConfig';

interface StoredSyncConfig {
  enabled: boolean;
  provider: SyncProviderType | null;
  encryptionSalt: string | null;
  encryptionEnabled: boolean; // false for folder sync (iCloud/Google Drive)
  lastSyncTime: number | null;
  lastSyncError: string | null;
}


class SyncServiceImpl {
  private provider: SyncProvider | null = null;
  private passphrase: string | null = null; // In-memory only, never stored
  private status: SyncStatus = { state: 'disabled' };
  private eventListeners: Set<SyncEventCallback> = new Set();
  private syncInProgress = false;
  private syncStartedAt: number | null = null;

  /**
   * Update the current sync phase (for progress display)
   */
  private setPhase(phase: SyncPhase): void {
    if (this.status.state === 'syncing' && this.syncStartedAt) {
      this.status = { state: 'syncing', startedAt: this.syncStartedAt, phase };
    }
  }

  /**
   * Initialize the sync service (call on extension startup)
   */
  async initialize(): Promise<void> {
    const config = await this.getConfig();
    
    if (config?.enabled && config.provider) {
      this.status = { state: 'idle', lastSyncTime: config.lastSyncTime ?? undefined };
    } else {
      this.status = { state: 'disabled' };
    }
  }

  /**
   * Get current sync configuration
   */
  async getConfig(): Promise<StoredSyncConfig | null> {
    const config = await chromeStorage.getOne<StoredSyncConfig>(SYNC_CONFIG_KEY);
    return config || null;
  }

  /**
   * Save sync configuration
   */
  private async saveConfig(config: StoredSyncConfig): Promise<void> {
    await chromeStorage.setOne(SYNC_CONFIG_KEY, config);
  }

  /**
   * Configure sync with a provider
   * If there's an existing remote file, we use its salt; otherwise generate new
   */
  async configure(
    provider: SyncProvider,
    passphrase: string
  ): Promise<void> {
    // Validate passphrase
    if (!passphrase || passphrase.length < 8) {
      throw new SyncError('Passphrase must be at least 8 characters', 'configuration');
    }

    this.provider = provider;
    this.passphrase = passphrase;

    // Check if there's an existing remote file to get salt from
    let salt: Uint8Array;
    let existingRemoteState: SyncStateDocument | null = null;
    
    const remoteMeta = await provider.getRemoteMetadata();
    if (remoteMeta.exists) {
      // Download existing file to get the salt and verify passphrase
      const remoteBlob = await provider.download();
      if (remoteBlob && this.isEncryptedBlob(remoteBlob)) {
        // Use the salt from the existing file
        salt = getSaltFromBlob(remoteBlob);
        
        // Verify passphrase by attempting to decrypt
        try {
          existingRemoteState = await decrypt(remoteBlob, passphrase);
        } catch {
          this.passphrase = null; // Clear invalid passphrase
          throw new SyncError('Incorrect passphrase for existing sync data', 'decrypt');
        }
      } else {
        // Unencrypted remote file - generate new salt for encryption
        salt = generateSalt();
      }
    } else {
      // No remote file - generate new salt
      salt = generateSalt();
    }

    const config: StoredSyncConfig = {
      enabled: true,
      provider: provider.providerType,
      encryptionSalt: arrayBufferToBase64(salt),
      encryptionEnabled: true,
      lastSyncTime: null,
      lastSyncError: null,
    };

    await this.saveConfig(config);
    
    // Set up content sync manager with encryption credentials
    contentSyncManager.setEncryption(passphrase, salt);
    
    // If we got existing remote state, apply it locally first (pull before push)
    if (existingRemoteState) {
      await storageFacade.applyRemoteState(existingRemoteState);
    }
    
    this.status = { state: 'idle' };

    this.emitEvent({
      type: 'provider-connected',
      timestamp: Date.now(),
      data: { provider: provider.providerType },
    });
  }

  /**
   * Configure sync with a provider WITHOUT encryption (for folder sync via iCloud/Google Drive)
   * This allows automatic syncing without requiring passphrase on each device
   */
  async configureWithoutEncryption(provider: SyncProvider): Promise<void> {
    this.provider = provider;
    this.passphrase = null; // No passphrase needed

    // Clear content manager encryption (content will be stored unencrypted)
    contentSyncManager.clearEncryption();

    const config: StoredSyncConfig = {
      enabled: true,
      provider: provider.providerType,
      encryptionSalt: null,
      encryptionEnabled: false,
      lastSyncTime: null,
      lastSyncError: null,
    };

    await this.saveConfig(config);
    this.status = { state: 'idle' };

    this.emitEvent({
      type: 'provider-connected',
      timestamp: Date.now(),
      data: { provider: provider.providerType },
    });
  }

  /**
   * Set the passphrase (for existing configuration on new device)
   * Also updates content sync manager encryption
   */
  async setPassphrase(passphrase: string): Promise<void> {
    this.passphrase = passphrase;
    
    // Get the salt from config and set up content manager
    const config = await this.getConfig();
    if (config?.encryptionSalt) {
      const salt = base64ToUint8Array(config.encryptionSalt);
      contentSyncManager.setEncryption(passphrase, salt);
    }
  }

  /**
   * Check if passphrase is set
   */
  hasPassphrase(): boolean {
    return this.passphrase !== null;
  }

  /**
   * Check if sync is ready to run
   * Returns true if:
   * - Sync is enabled and provider is configured
   * - AND either encryption is disabled OR passphrase is set
   */
  async isReadyToSync(): Promise<boolean> {
    const config = await this.getConfig();
    if (!config?.enabled || !config.provider) {
      return false;
    }
    
    // For unencrypted sync (folder sync), we don't need a passphrase
    if (config.encryptionEnabled === false) {
      return this.provider !== null;
    }
    
    // For encrypted sync, we need both provider and passphrase
    return this.provider !== null && this.passphrase !== null;
  }

  /**
   * Set the active provider
   */
  setProvider(provider: SyncProvider): void {
    this.provider = provider;
  }

  /**
   * Disconnect and disable sync
   */
  async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
    }

    this.provider = null;
    this.passphrase = null;
    
    // Clear content manager encryption
    contentSyncManager.clearEncryption();

    const config: StoredSyncConfig = {
      enabled: false,
      provider: null,
      encryptionSalt: null,
      encryptionEnabled: false,
      lastSyncTime: null,
      lastSyncError: null,
    };

    await this.saveConfig(config);
    this.status = { state: 'disabled' };

    this.emitEvent({
      type: 'provider-disconnected',
      timestamp: Date.now(),
    });
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Perform a sync operation
   */
  async syncNow(): Promise<SyncResult> {
    // Check prerequisites
    if (!this.provider) {
      return { success: false, timestamp: Date.now(), action: 'error', error: 'No provider configured' };
    }

    const config = await this.getConfig();
    if (!config?.enabled) {
      return { success: false, timestamp: Date.now(), action: 'error', error: 'Sync not enabled' };
    }

    // Only require passphrase if encryption is enabled
    if (config.encryptionEnabled && !this.passphrase) {
      return { success: false, timestamp: Date.now(), action: 'error', error: 'Passphrase not set' };
    }

    if (this.syncInProgress) {
      return { success: false, timestamp: Date.now(), action: 'error', error: 'Sync already in progress' };
    }

    // Start sync
    this.syncInProgress = true;
    this.syncStartedAt = Date.now();
    this.status = { state: 'syncing', startedAt: this.syncStartedAt, phase: 'connecting' };
    
    this.emitEvent({
      type: 'sync-started',
      timestamp: Date.now(),
    });

    try {
      const result = await this.performSync(config);
      
      // Update config with sync time
      await this.saveConfig({
        ...config,
        lastSyncTime: result.timestamp,
        lastSyncError: result.success ? null : result.error || null,
      });

      this.status = { state: 'idle', lastSyncTime: result.timestamp };

      this.emitEvent({
        type: result.success ? 'sync-completed' : 'sync-failed',
        timestamp: result.timestamp,
        data: result,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      
      await this.saveConfig({
        ...config,
        lastSyncError: errorMessage,
      });

      this.status = { 
        state: 'error', 
        message: errorMessage, 
        lastAttempt: Date.now(),
      };

      this.emitEvent({
        type: 'sync-failed',
        timestamp: Date.now(),
        data: { 
          success: false, 
          timestamp: Date.now(), 
          action: 'error', 
          error: errorMessage 
        },
      });

      return { 
        success: false, 
        timestamp: Date.now(), 
        action: 'error', 
        error: errorMessage 
      };
    } finally {
      this.syncInProgress = false;
      this.syncStartedAt = null;
    }
  }

  /**
   * Subscribe to sync events
   */
  onEvent(callback: SyncEventCallback): () => void {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }


  private async performSync(config: StoredSyncConfig): Promise<SyncResult> {
    if (!this.provider) {
      throw new SyncError('Provider not set', 'sync');
    }

    // For encrypted sync, require passphrase
    if (config.encryptionEnabled && !this.passphrase) {
      throw new SyncError('Passphrase not set for encrypted sync', 'sync');
    }

    // Get local state
    const localState = await storageFacade.getStateForSync();
    const deviceId = await storageFacade.getDeviceId();

    // Check remote metadata
    this.setPhase('downloading');
    const remoteMeta = await this.provider.getRemoteMetadata();

    if (!remoteMeta.exists) {
      // No remote state - upload local
      this.setPhase('uploading');
      if (config.encryptionEnabled) {
        const salt = config.encryptionSalt 
          ? base64ToUint8Array(config.encryptionSalt)
          : generateSalt();
        
        const encrypted = await encrypt(localState, this.passphrase!, salt);
        const uploadResult = await this.provider.upload(encrypted);

        if (!uploadResult.success) {
          throw new SyncError(uploadResult.error || 'Upload failed', 'upload');
        }
      } else {
        // Unencrypted mode - store plain JSON (cast for type compatibility)
        const plainBlob = this.createPlainBlob(localState);
        const uploadResult = await this.provider.upload(plainBlob);

        if (!uploadResult.success) {
          throw new SyncError(uploadResult.error || 'Upload failed', 'upload');
        }
      }

      return {
        success: true,
        timestamp: Date.now(),
        action: 'uploaded',
      };
    }

    // Download remote state
    const remoteBlob = await this.provider.download();
    
    if (!remoteBlob) {
      throw new SyncError('Failed to download remote state', 'download');
    }

    let remoteState: SyncStateDocument;
    if (config.encryptionEnabled) {
      // Decrypt remote state
      try {
        remoteState = await decrypt(remoteBlob, this.passphrase!);
      } catch (error) {
        if (error instanceof Error && error.message.includes('passphrase')) {
          throw new SyncError('Incorrect passphrase', 'decrypt');
        }
        throw error;
      }
    } else {
      // Unencrypted mode - parse plain blob
      remoteState = this.parsePlainBlob(remoteBlob);
    }

    // Compare states
    const localNewer = localState.updatedAt > remoteState.updatedAt;
    const remoteNewer = remoteState.updatedAt > localState.updatedAt;
    const sameDevice = remoteState.deviceId === deviceId;

    // If same device and timestamps match, no sync needed
    if (sameDevice && localState.updatedAt === remoteState.updatedAt) {
      return {
        success: true,
        timestamp: Date.now(),
        action: 'no-change',
      };
    }

    // Merge states
    this.setPhase('merging');
    const mergeResult = mergeStates(localState, remoteState, deviceId);

    // Log conflicts
    if (mergeResult.conflicts.length > 0) {
      for (const conflict of mergeResult.conflicts) {
        this.emitEvent({
          type: 'conflict-detected',
          timestamp: Date.now(),
          data: conflict,
        });
      }
    }

    // Apply merged state locally
    await storageFacade.applyRemoteState(mergeResult.merged);

    // Upload merged state if we have changes or local was newer
    if (mergeResult.hasChanges || localNewer) {
      this.setPhase('uploading');
      if (config.encryptionEnabled) {
        const salt = getSaltFromBlob(remoteBlob);
        const encrypted = await encrypt(mergeResult.merged, this.passphrase!, salt);
        const uploadResult = await this.provider.upload(encrypted);

        if (!uploadResult.success) {
          throw new SyncError(uploadResult.error || 'Upload failed', 'upload');
        }
      } else {
        // Unencrypted mode
        const plainBlob = this.createPlainBlob(mergeResult.merged);
        const uploadResult = await this.provider.upload(plainBlob);

        if (!uploadResult.success) {
          throw new SyncError(uploadResult.error || 'Upload failed', 'upload');
        }
      }
    }

    // Perform content sync (separate files for document content)
    this.setPhase('syncing-content');
    await this.performContentSync(mergeResult.merged);

    return {
      success: true,
      timestamp: Date.now(),
      action: mergeResult.hasChanges ? 'merged' : (remoteNewer ? 'downloaded' : 'uploaded'),
      conflicts: mergeResult.conflicts.length > 0 ? mergeResult.conflicts : undefined,
    };
  }

  /**
   * Perform content sync (document files) after state sync
   * This syncs the actual document content as separate compressed files
   */
  private async performContentSync(mergedState: SyncStateDocument): Promise<void> {
    if (!this.provider) return;
    
    try {
      // Get local archive items with their full data (including cachedDocument)
      const localItems = await storageFacade.getArchiveItemsForContentSync();
      
      // Get the content manifest from the merged state (if any)
      const remoteManifest = mergedState.contentManifest;
      
      // Sync content between local and remote
      const syncResult = await contentSyncManager.syncContent(
        this.provider,
        localItems,
        remoteManifest
      );
      
      // Apply any downloaded documents to local storage
      for (const downloaded of syncResult.downloaded) {
        await storageFacade.updateArchiveItemCachedDocument(
          downloaded.itemId,
          downloaded.document
        );
      }
      
      // Update the content manifest in local state if there were changes
      if (syncResult.uploaded.length > 0 || syncResult.downloaded.length > 0) {
        // Update the manifest in the synced state and re-upload
        const updatedState: SyncStateDocument = {
          ...mergedState,
          contentManifest: syncResult.manifest,
          updatedAt: Date.now(),
        };
        
        // Re-upload state with updated manifest
        const config = await this.getConfig();
        if (config?.encryptionEnabled && this.passphrase) {
          const salt = config.encryptionSalt 
            ? base64ToUint8Array(config.encryptionSalt)
            : generateSalt();
          const encrypted = await encrypt(updatedState, this.passphrase, salt);
          await this.provider.upload(encrypted);
        } else if (config && !config.encryptionEnabled) {
          const plainBlob = this.createPlainBlob(updatedState);
          await this.provider.upload(plainBlob);
        }
        
        // Apply locally as well
        await storageFacade.applyRemoteState(updatedState);
      }
      
      // Prune orphaned content files
      const archiveItemIds = new Set(localItems.map(item => item.id));
      await contentSyncManager.pruneOrphanedContent(
        this.provider,
        syncResult.manifest,
        archiveItemIds
      );
      
      // Log content sync results in dev mode
      if (import.meta.env.DEV) {
        console.log('FlowReader Content Sync:', {
          uploaded: syncResult.uploaded.length,
          downloaded: syncResult.downloaded.length,
          errors: syncResult.errors.length,
          manifestItems: Object.keys(syncResult.manifest.items).length,
        });
        
        // Log detailed info for debugging book sync issues
        if (syncResult.errors.length > 0) {
          console.log('FlowReader Content Sync Errors:', syncResult.errors);
        }
        
        // Log local items without cachedDocument that weren't downloaded
        const itemsNeedingContent = localItems.filter(item => 
          !item.cachedDocument && 
          (item.type === 'epub' || item.type === 'mobi' || item.type === 'pdf' || item.type === 'docx')
        );
        const downloadedIds = new Set(syncResult.downloaded.map(d => d.itemId));
        const notDownloaded = itemsNeedingContent.filter(item => !downloadedIds.has(item.id));
        
        if (notDownloaded.length > 0) {
          console.log('FlowReader Content Sync: Items needing content but not downloaded:', 
            notDownloaded.map(item => ({
              id: item.id,
              type: item.type,
              title: item.title,
              fileHash: item.fileHash,
              hasFileHash: !!item.fileHash,
            }))
          );
          console.log('FlowReader Content Sync: Available manifest hashes:', 
            Object.keys(syncResult.manifest.items)
          );
        }
      }
    } catch (error) {
      // Content sync errors should not fail the overall sync
      console.error('FlowReader Content Sync Error:', error);
    }
  }

  /**
   * Create a plain blob wrapper for unencrypted sync
   * Uses the same shape as EncryptedBlob for type compatibility with providers
   */
  private createPlainBlob(state: SyncStateDocument): EncryptedBlob {
    // Store the plain JSON in the ciphertext field with special markers
    return {
      version: 1,
      algorithm: 'AES-GCM',
      salt: 'UNENCRYPTED',  // Marker indicating this is not actually encrypted
      iv: 'PLAIN',          // Marker indicating this is plain data
      ciphertext: unicodeToBase64(JSON.stringify(state)),  // Base64-encoded JSON (Unicode-safe)
      encryptedAt: Date.now(),
    };
  }

  /**
   * Check if a blob is encrypted (vs plain/unencrypted)
   */
  isEncryptedBlob(blob: EncryptedBlob): boolean {
    return blob.salt !== 'UNENCRYPTED' || blob.iv !== 'PLAIN';
  }

  /**
   * Parse a plain blob (unencrypted sync)
   */
  private parsePlainBlob(blob: EncryptedBlob): SyncStateDocument {
    if (this.isEncryptedBlob(blob)) {
      throw new SyncError('Expected unencrypted sync data but found encrypted blob', 'download');
    }
    
    try {
      const json = base64ToUnicode(blob.ciphertext);
      return JSON.parse(json) as SyncStateDocument;
    } catch {
      throw new SyncError('Failed to parse unencrypted sync data', 'download');
    }
  }

  /**
   * Check if the remote has an existing sync file and whether it's encrypted
   * Returns: { exists: false } | { exists: true, encrypted: boolean }
   */
  async checkRemoteState(provider: SyncProvider): Promise<{ exists: boolean; encrypted?: boolean }> {
    const metadata = await provider.getRemoteMetadata();
    if (!metadata.exists) {
      return { exists: false };
    }

    // Download and check if encrypted
    const blob = await provider.download();
    if (!blob) {
      return { exists: false };
    }

    return { 
      exists: true, 
      encrypted: this.isEncryptedBlob(blob) 
    };
  }

  /**
   * Delete a specific item's content from the sync provider
   * Called when an item is deleted locally to keep sync in sync
   */
  async deleteItemContent(item: { id: string; fileHash?: string; url?: string }): Promise<void> {
    if (!this.provider) {
      return; // No provider configured, nothing to delete
    }

    const config = await this.getConfig();
    if (!config?.enabled) {
      return; // Sync not enabled
    }

    try {
      await contentSyncManager.deleteItemContent(this.provider, item as import('@/types').ArchiveItem);
    } catch (error) {
      console.error('Failed to delete item content from sync:', error);
      // Don't throw - local deletion should succeed even if remote deletion fails
    }
  }

  private emitEvent(event: SyncEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('SyncService: Error in event listener:', error);
      }
    }
  }
}

// Re-export SyncError for backwards compatibility
export { SyncError } from '../errors';


export const syncService = new SyncServiceImpl();
