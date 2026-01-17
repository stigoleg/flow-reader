/**
 * Storage Facade
 * 
 * Centralized storage abstraction layer that provides:
 * - Single source of truth for all storage operations
 * - Schema versioning and migration support
 * - Change notification callbacks
 * - Sync state preparation and application
 * 
 * Uses chrome-storage.ts for underlying Chrome storage operations.
 */

import type { 
  ReaderSettings, 
  ReadingPosition, 
  StorageSchema, 
  ArchiveItem, 
  CustomTheme,
  ArchiveItemType,
  ArchiveProgress,
} from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { CURRENT_STORAGE_VERSION, runMigrations } from './migrations';
import { normalizeUrl } from './url-utils';
import * as chromeStorage from './chrome-storage';

// =============================================================================
// TYPES
// =============================================================================

/** Extended storage schema with sync-related fields */
export interface ExtendedStorageSchema extends StorageSchema {
  dataUpdatedAt: number;
  deviceId: string;
  syncEnabled: boolean;
  syncProvider: SyncProviderType | null;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  deletedItems: Record<string, number>;
}

export type SyncProviderType = 'dropbox' | 'onedrive' | 'folder';

/** State document for sync (excludes large cached documents) */
export interface SyncStateDocument {
  schemaVersion: number;
  updatedAt: number;
  deviceId: string;
  
  settings: ReaderSettings;
  presets: Record<string, Partial<ReaderSettings>>;
  customThemes: CustomTheme[];
  
  /** Archive items without cachedDocument (too large for sync) */
  archiveItems: SyncArchiveItem[];
  
  positions: Record<string, ReadingPosition>;
  
  /** Deleted items tombstones - maps identifier to deletion timestamp */
  deletedItems?: Record<string, number>;
  
  onboardingCompleted: boolean;
  exitConfirmationDismissed: boolean;
}

/** Archive item for sync (excludes cachedDocument) */
export interface SyncArchiveItem {
  id: string;
  type: ArchiveItemType;
  title: string;
  author?: string;
  sourceLabel: string;
  url?: string;
  createdAt: number;
  lastOpenedAt: number;
  progress?: ArchiveProgress;
  lastPosition?: ReadingPosition;
  fileHash?: string;
  pasteContent?: string; // Size-limited paste content only
}

export type StorageChangeCallback = (changes: Partial<ExtendedStorageSchema>) => void;

// =============================================================================
// STORAGE FACADE CLASS
// =============================================================================

class StorageFacadeImpl {
  private changeListeners: Set<StorageChangeCallback> = new Set();
  private deviceId: string | null = null;

  constructor() {
    // Listen for storage changes from other contexts
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        const convertedChanges: Partial<ExtendedStorageSchema> = {};
        for (const [key, change] of Object.entries(changes)) {
          if (change.newValue !== undefined) {
            (convertedChanges as Record<string, unknown>)[key] = change.newValue;
          }
        }
        this.notifyListeners(convertedChanges);
      }
    });
  }

  /**
   * Get full storage state with defaults applied.
   * Auto-initializes storage if empty (matches storage.ts behavior).
   */
  async getState(): Promise<ExtendedStorageSchema> {
    const data = await chromeStorage.get<Record<string, unknown>>(null);
    
    // If no data or no version, auto-initialize with defaults
    if (!data || !data.version) {
      const initial: ExtendedStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        dataUpdatedAt: 0, // Fresh install = no user data yet, remote will win on first sync
        settings: DEFAULT_SETTINGS,
        presets: {},
        positions: {},
        archiveItems: [],
        recentDocuments: [],
        customThemes: [],
        onboardingCompleted: false,
        exitConfirmationDismissed: false,
        deviceId: this.getOrCreateDeviceId(),
        syncEnabled: false,
        syncProvider: null,
        lastSyncTime: null,
        lastSyncError: null,
        deletedItems: {},
      };
      await chromeStorage.set(initial as unknown as Record<string, unknown>);
      return initial;
    }

    // Merge stored settings with defaults to handle new settings added in updates
    const storedSettings = (data.settings || {}) as Partial<ReaderSettings>;
    const mergedSettings = { ...DEFAULT_SETTINGS, ...storedSettings };

    return {
      version: data.version as number,
      dataUpdatedAt: (data.dataUpdatedAt || 0) as number,
      settings: mergedSettings,
      presets: (data.presets || {}) as Record<string, Partial<ReaderSettings>>,
      positions: (data.positions || {}) as Record<string, ReadingPosition>,
      archiveItems: (data.archiveItems || []) as ArchiveItem[],
      recentDocuments: (data.recentDocuments || []) as StorageSchema['recentDocuments'],
      customThemes: (data.customThemes || []) as CustomTheme[],
      onboardingCompleted: (data.onboardingCompleted || false) as boolean,
      exitConfirmationDismissed: (data.exitConfirmationDismissed || false) as boolean,
      deviceId: (data.deviceId || this.getOrCreateDeviceId()) as string,
      syncEnabled: (data.syncEnabled || false) as boolean,
      syncProvider: (data.syncProvider || null) as SyncProviderType | null,
      lastSyncTime: (data.lastSyncTime || null) as number | null,
      lastSyncError: (data.lastSyncError || null) as string | null,
      deletedItems: (data.deletedItems || {}) as Record<string, number>,
    };
  }

  /**
   * Get device ID (creates one if not exists)
   */
  async getDeviceId(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    }

    const result = await chromeStorage.getOne<string>('deviceId');
    
    if (result) {
      this.deviceId = result;
      return this.deviceId;
    }
    
    const newDeviceId = this.generateDeviceId();
    await chromeStorage.setOne('deviceId', newDeviceId);
    this.deviceId = newDeviceId;
    return newDeviceId;
  }

  /**
   * Update settings (partial update)
   */
  async updateSettings(settings: Partial<ReaderSettings>): Promise<void> {
    const state = await this.getState();
    const newSettings = { ...state.settings, ...settings };
    
    return this.setValues({ 
      settings: newSettings,
      version: CURRENT_STORAGE_VERSION,
    });
  }

  /**
   * Update positions
   */
  async updatePositions(positions: Record<string, ReadingPosition>): Promise<void> {
    const state = await this.getState();
    const newPositions = { ...state.positions, ...positions };
    
    return this.setValues({ positions: newPositions });
  }

  /**
   * Update archive items
   */
  async updateArchiveItems(items: ArchiveItem[]): Promise<void> {
    return this.setValues({ 
      archiveItems: items,
      version: CURRENT_STORAGE_VERSION,
    });
  }

  /**
   * Add a deleted item tombstone for sync
   * Uses multiple identifiers (id, fileHash, normalized URL) to ensure the item
   * won't be re-synced back from any device
   */
  async addDeletedItemTombstone(item: {
    id: string;
    fileHash?: string;
    url?: string;
  }): Promise<void> {
    const state = await this.getState();
    const deletedItems = { ...state.deletedItems };
    const now = Date.now();
    
    // Add tombstone for the item ID
    deletedItems[item.id] = now;
    
    // Also add tombstone for fileHash if present (for file-based deduplication)
    if (item.fileHash) {
      deletedItems[`hash:${item.fileHash}`] = now;
    }
    
    // Also add tombstone for normalized URL if present (for web deduplication)
    if (item.url) {
      const normalized = normalizeUrl(item.url);
      deletedItems[`url:${normalized}`] = now;
    }
    
    return this.setValues({ deletedItems });
  }

  /**
   * Clear all deleted item tombstones
   */
  async clearDeletedItemTombstones(): Promise<void> {
    return this.setValues({ deletedItems: {} });
  }

  /**
   * Update custom themes
   */
  async updateCustomThemes(themes: CustomTheme[]): Promise<void> {
    return this.setValues({ customThemes: themes });
  }

  /**
   * Update presets
   */
  async updatePresets(presets: Record<string, Partial<ReaderSettings>>): Promise<void> {
    return this.setValues({ presets });
  }

  /**
   * Update UI flags (onboardingCompleted, exitConfirmationDismissed)
   */
  async updateFlags(flags: {
    onboardingCompleted?: boolean;
    exitConfirmationDismissed?: boolean;
  }): Promise<void> {
    return this.setValues(flags);
  }

  /**
   * Update sync configuration
   */
  async updateSyncConfig(config: {
    syncEnabled?: boolean;
    syncProvider?: SyncProviderType | null;
    lastSyncTime?: number | null;
    lastSyncError?: string | null;
  }): Promise<void> {
    return this.setValues(config);
  }

  /**
   * Get state prepared for sync (excludes large cached documents)
   */
  async getStateForSync(): Promise<SyncStateDocument> {
    const state = await this.getState();
    const deviceId = await this.getDeviceId();

    // Convert archive items to sync format (remove cachedDocument)
    const syncArchiveItems: SyncArchiveItem[] = state.archiveItems.map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      author: item.author,
      sourceLabel: item.sourceLabel,
      url: item.url,
      createdAt: item.createdAt,
      lastOpenedAt: item.lastOpenedAt,
      progress: item.progress,
      lastPosition: item.lastPosition,
      fileHash: item.fileHash,
      pasteContent: item.pasteContent,
      // Explicitly exclude cachedDocument
    }));

    return {
      schemaVersion: CURRENT_STORAGE_VERSION,
      updatedAt: state.dataUpdatedAt, // Use stored timestamp, not Date.now()
      deviceId,
      settings: state.settings,
      presets: state.presets,
      customThemes: state.customThemes,
      archiveItems: syncArchiveItems,
      positions: state.positions,
      deletedItems: state.deletedItems,
      onboardingCompleted: state.onboardingCompleted,
      exitConfirmationDismissed: state.exitConfirmationDismissed,
    };
  }

  /**
   * Apply remote state from sync (preserves local cachedDocument data)
   */
  async applyRemoteState(remote: SyncStateDocument): Promise<void> {
    const localState = await this.getState();

    // Merge archive items - preserve local cachedDocument
    const mergedArchiveItems: ArchiveItem[] = remote.archiveItems.map(remoteItem => {
      const localItem = localState.archiveItems.find(l => l.id === remoteItem.id);
      return {
        ...remoteItem,
        // Preserve local cachedDocument if it exists
        cachedDocument: localItem?.cachedDocument,
      };
    });

    // Add any local items not in remote (they may have been added locally since last sync)
    for (const localItem of localState.archiveItems) {
      if (!mergedArchiveItems.find(m => m.id === localItem.id)) {
        mergedArchiveItems.push(localItem);
      }
    }

    await this.setValues({
      _fromRemoteSync: true, // Flag to prevent setValues from overwriting dataUpdatedAt
      version: CURRENT_STORAGE_VERSION,
      dataUpdatedAt: remote.updatedAt, // Preserve remote timestamp for future conflict resolution
      settings: remote.settings,
      presets: remote.presets,
      customThemes: remote.customThemes,
      archiveItems: mergedArchiveItems,
      positions: remote.positions,
      onboardingCompleted: remote.onboardingCompleted,
      exitConfirmationDismissed: remote.exitConfirmationDismissed,
      lastSyncTime: Date.now(),
      lastSyncError: null,
    });
  }

  /**
   * Get current storage version
   */
  async getCurrentVersion(): Promise<number> {
    const version = await chromeStorage.getOne<number>('version');
    return version || 1;
  }

  /**
   * Run migrations if needed
   */
  async runMigrations(): Promise<void> {
    return runMigrations();
  }

  /**
   * Subscribe to storage changes
   */
  onChange(callback: StorageChangeCallback): () => void {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  /**
   * Get archive items with their full data (including cachedDocument)
   * For use by content sync manager
   */
  async getArchiveItemsForContentSync(): Promise<ArchiveItem[]> {
    const state = await this.getState();
    return state.archiveItems;
  }

  /**
   * Update a single archive item's cached document
   * For use when downloading content from remote
   */
  async updateArchiveItemCachedDocument(
    itemId: string, 
    cachedDocument: ArchiveItem['cachedDocument']
  ): Promise<void> {
    const state = await this.getState();
    const updatedItems = state.archiveItems.map(item => 
      item.id === itemId 
        ? { ...item, cachedDocument } 
        : item
    );
    
    return this.setValues({ 
      archiveItems: updatedItems,
      version: CURRENT_STORAGE_VERSION,
    });
  }

  /**
   * Clear all storage data
   */
  async clearAll(): Promise<void> {
    await chromeStorage.clear();
    this.deviceId = null;
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /** Keys that represent user data (should update dataUpdatedAt when modified) */
  private static readonly SYNC_RELEVANT_KEYS: readonly string[] = [
    'settings', 'presets', 'customThemes', 'archiveItems', 'positions', 'deletedItems'
  ];

  private async setValues(values: Record<string, unknown>): Promise<void> {
    // Check if any sync-relevant data is being modified
    const hasDataChange = StorageFacadeImpl.SYNC_RELEVANT_KEYS.some(key => key in values);
    
    // If this is a data change and not from remote sync, update dataUpdatedAt
    // The _fromRemoteSync flag prevents updating timestamp when applying remote state
    if (hasDataChange && !values._fromRemoteSync) {
      values.dataUpdatedAt = Date.now();
    }
    
    // Remove internal flag before saving (it's not part of the schema)
    delete values._fromRemoteSync;
    
    await chromeStorage.set(values);
  }

  private notifyListeners(changes: Partial<ExtendedStorageSchema>): void {
    for (const listener of this.changeListeners) {
      try {
        listener(changes);
      } catch (error) {
        console.error('StorageFacade: Error in change listener:', error);
      }
    }
  }

  private getOrCreateDeviceId(): string {
    if (this.deviceId) {
      return this.deviceId;
    }
    this.deviceId = this.generateDeviceId();
    // Fire and forget - save the device ID
    chromeStorage.setOne('deviceId', this.deviceId).catch(err => {
      console.error('StorageFacade: Failed to persist device ID:', err);
    });
    return this.deviceId;
  }

  private generateDeviceId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/** Storage facade singleton */
export const storageFacade = new StorageFacadeImpl();

// Re-export types for convenience
export type { 
  ReaderSettings, 
  ReadingPosition, 
  StorageSchema, 
  ArchiveItem, 
  CustomTheme 
} from '@/types';
