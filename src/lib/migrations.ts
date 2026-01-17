/**
 * Migration System
 * 
 * Centralized schema versioning and migration handling for FlowReader storage.
 * Migrations are run on extension update to ensure data compatibility.
 */

import type { StorageSchema, ArchiveItem, RecentDocument } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

/** Current storage schema version */
export const CURRENT_STORAGE_VERSION = 3;

/** Migration function type */
type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

/** Migration registry - maps version to migration function */
const migrations: Record<number, MigrationFn> = {
  // v1 → v2: Migrate recentDocuments to archiveItems
  2: migrateV1ToV2,
  // v2 → v3: Add syncSettings field
  3: migrateV2ToV3,
};

/**
 * Run all necessary migrations to bring storage to current version
 */
export async function runMigrations(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, async (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const currentVersion = (data.version as number) || 1;
      
      if (currentVersion >= CURRENT_STORAGE_VERSION) {
        // Already at latest version
        resolve();
        return;
      }

      console.log(`FlowReader: Migrating storage from v${currentVersion} to v${CURRENT_STORAGE_VERSION}`);

      let migratedData = { ...data };

      // Run each migration in sequence
      for (let version = currentVersion + 1; version <= CURRENT_STORAGE_VERSION; version++) {
        const migrationFn = migrations[version];
        if (migrationFn) {
          console.log(`FlowReader: Running migration to v${version}`);
          migratedData = migrationFn(migratedData);
        }
      }

      // Update version
      migratedData.version = CURRENT_STORAGE_VERSION;

      // Save migrated data
      chrome.storage.local.set(migratedData, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log(`FlowReader: Migration complete. Now at v${CURRENT_STORAGE_VERSION}`);
          resolve();
        }
      });
    });
  });
}

/**
 * Initialize storage with default values (first install only)
 */
export async function initializeDefaultStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      // Only initialize if storage is empty or has no version
      if (data && data.version) {
        resolve();
        return;
      }

      const initialData: StorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        settings: DEFAULT_SETTINGS,
        presets: {},
        positions: {},
        archiveItems: [],
        recentDocuments: [], // Kept for backward compatibility
        customThemes: [],
        onboardingCompleted: false,
        exitConfirmationDismissed: false,
      };

      chrome.storage.local.set(initialData, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('FlowReader: Initialized storage with defaults');
          resolve();
        }
      });
    });
  });
}

/**
 * Check current storage version
 */
export async function getStorageVersion(): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['version'], (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve((data.version as number) || 1);
    });
  });
}


/**
 * v1 → v2: Migrate recentDocuments to archiveItems format
 */
function migrateV1ToV2(data: Record<string, unknown>): Record<string, unknown> {
  const recentDocuments = data.recentDocuments as RecentDocument[] | undefined;
  
  if (!recentDocuments || recentDocuments.length === 0) {
    return {
      ...data,
      archiveItems: data.archiveItems || [],
    };
  }

  // Only migrate if archiveItems doesn't exist yet
  if (data.archiveItems && (data.archiveItems as ArchiveItem[]).length > 0) {
    return data;
  }

  const archiveItems: ArchiveItem[] = recentDocuments.map((doc): ArchiveItem => {
    const type = mapSourceToType(doc.source);
    return {
      id: doc.id,
      type,
      title: doc.title,
      sourceLabel: extractSourceLabel(doc),
      url: doc.url,
      createdAt: doc.timestamp,
      lastOpenedAt: doc.timestamp,
      cachedDocument: doc.cachedDocument,
      fileHash: doc.cachedDocument?.metadata.fileHash,
    };
  });

  return {
    ...data,
    archiveItems,
    // Keep recentDocuments for backward compatibility but don't use it
  };
}

/**
 * v2 → v3: Add sync-related fields
 */
function migrateV2ToV3(data: Record<string, unknown>): Record<string, unknown> {
  return {
    ...data,
    // Add deviceId if not present
    deviceId: data.deviceId || generateDeviceId(),
    // Add sync settings placeholder (sync is disabled by default)
    syncEnabled: false,
    syncProvider: null,
    lastSyncTime: null,
    lastSyncError: null,
  };
}


function mapSourceToType(source: string): ArchiveItem['type'] {
  switch (source) {
    case 'web':
    case 'selection':
      return 'web';
    case 'pdf':
      return 'pdf';
    case 'docx':
      return 'docx';
    case 'epub':
      return 'epub';
    case 'mobi':
      return 'mobi';
    case 'paste':
      return 'paste';
    default:
      return 'web';
  }
}

function extractSourceLabel(doc: RecentDocument): string {
  if (doc.url) {
    try {
      const url = new URL(doc.url);
      return url.hostname;
    } catch {
      return doc.url;
    }
  }

  if (doc.cachedDocument?.metadata.fileName) {
    return doc.cachedDocument.metadata.fileName;
  }

  return doc.source;
}

/**
 * Generate a unique device identifier
 */
function generateDeviceId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
