/**
 * Centralized storage abstraction providing schema versioning, change notifications,
 * and sync state preparation. Uses chrome-storage.ts for Chrome storage operations.
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
import { storageMutex } from './async-mutex';


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


class StorageFacadeImpl {
  private changeListeners: Set<StorageChangeCallback> = new Set();
  private deviceId: string | null = null;

  constructor() {
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

  /** Get full storage state with defaults applied. Auto-initializes if empty. */
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

  async updateSettings(settings: Partial<ReaderSettings>): Promise<void> {
    return storageMutex.withLock(async () => {
      const state = await this.getState();
      const newSettings = { ...state.settings, ...settings };
      
      return this.setValues({ 
        settings: newSettings,
        version: CURRENT_STORAGE_VERSION,
      });
    });
  }

  async updatePositions(positions: Record<string, ReadingPosition>): Promise<void> {
    return storageMutex.withLock(async () => {
      const state = await this.getState();
      const newPositions = { ...state.positions, ...positions };
      
      return this.setValues({ positions: newPositions });
    });
  }

  async updateArchiveItems(items: ArchiveItem[]): Promise<void> {
    return this.setValues({ 
      archiveItems: items,
      version: CURRENT_STORAGE_VERSION,
    });
  }

  /**
   * Add a deleted item tombstone for sync.
   * Uses multiple identifiers (id, fileHash, normalized URL) to ensure the item
   * won't be re-synced back from any device.
   */
  async addDeletedItemTombstone(item: {
    id: string;
    fileHash?: string;
    url?: string;
  }): Promise<void> {
    return storageMutex.withLock(async () => {
      const state = await this.getState();
      const deletedItems = { ...state.deletedItems };
      const now = Date.now();
      
      deletedItems[item.id] = now;
      
      if (item.fileHash) {
        deletedItems[`hash:${item.fileHash}`] = now;
      }
      
      if (item.url) {
        const normalized = normalizeUrl(item.url);
        deletedItems[`url:${normalized}`] = now;
      }
      
      return this.setValues({ deletedItems });
    });
  }

  async clearDeletedItemTombstones(): Promise<void> {
    return this.setValues({ deletedItems: {} });
  }

  async updateCustomThemes(themes: CustomTheme[]): Promise<void> {
    return this.setValues({ customThemes: themes });
  }

  async updatePresets(presets: Record<string, Partial<ReaderSettings>>): Promise<void> {
    return this.setValues({ presets });
  }

  async updateFlags(flags: {
    onboardingCompleted?: boolean;
    exitConfirmationDismissed?: boolean;
  }): Promise<void> {
    return this.setValues(flags);
  }

  async updateSyncConfig(config: {
    syncEnabled?: boolean;
    syncProvider?: SyncProviderType | null;
    lastSyncTime?: number | null;
    lastSyncError?: string | null;
  }): Promise<void> {
    return this.setValues(config);
  }

  /** Get state prepared for sync (excludes large cached documents) */
  async getStateForSync(): Promise<SyncStateDocument> {
    const state = await this.getState();
    const deviceId = await this.getDeviceId();

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
    }));

    return {
      schemaVersion: CURRENT_STORAGE_VERSION,
      updatedAt: state.dataUpdatedAt,
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

  /** Apply remote state from sync (preserves local cachedDocument data) */
  async applyRemoteState(remote: SyncStateDocument): Promise<void> {
    return storageMutex.withLock(async () => {
      const localState = await this.getState();

      const mergedArchiveItems: ArchiveItem[] = remote.archiveItems.map(remoteItem => {
        const localItem = localState.archiveItems.find(l => l.id === remoteItem.id);
        return {
          ...remoteItem,
          cachedDocument: localItem?.cachedDocument,
        };
      });

      for (const localItem of localState.archiveItems) {
        if (!mergedArchiveItems.find(m => m.id === localItem.id)) {
          mergedArchiveItems.push(localItem);
        }
      }

      await this.setValues({
        _fromRemoteSync: true,
        version: CURRENT_STORAGE_VERSION,
        dataUpdatedAt: remote.updatedAt,
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
    });
  }

  async getCurrentVersion(): Promise<number> {
    const version = await chromeStorage.getOne<number>('version');
    return version || 1;
  }

  async runMigrations(): Promise<void> {
    return runMigrations();
  }

  onChange(callback: StorageChangeCallback): () => void {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  /** Get archive items with full data (including cachedDocument) for content sync */
  async getArchiveItemsForContentSync(): Promise<ArchiveItem[]> {
    const state = await this.getState();
    return state.archiveItems;
  }

  /** Update a single archive item's cached document when downloading from remote */
  async updateArchiveItemCachedDocument(
    itemId: string, 
    cachedDocument: ArchiveItem['cachedDocument']
  ): Promise<void> {
    return storageMutex.withLock(async () => {
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
    });
  }

  async clearAll(): Promise<void> {
    await chromeStorage.clear();
    this.deviceId = null;
  }


  /** Keys that represent user data (should update dataUpdatedAt when modified) */
  private static readonly SYNC_RELEVANT_KEYS: readonly string[] = [
    'settings', 'presets', 'customThemes', 'archiveItems', 'positions', 'deletedItems'
  ];

  private async setValues(values: Record<string, unknown>): Promise<void> {
    const hasDataChange = StorageFacadeImpl.SYNC_RELEVANT_KEYS.some(key => key in values);
    
    // _fromRemoteSync flag prevents updating timestamp when applying remote state
    if (hasDataChange && !values._fromRemoteSync) {
      values.dataUpdatedAt = Date.now();
    }
    
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
