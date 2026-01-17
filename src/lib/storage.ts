import type { ReaderSettings, ReadingPosition, StorageSchema, RecentDocument, CustomTheme, FlowDocument, DocumentMetadata, ArchiveItem } from '@/types';
import { DEFAULT_SETTINGS as defaultSettings } from '@/types';

const STORAGE_VERSION = 2;
const MAX_RECENT_DOCUMENTS = 20;

/** Storage operation error */
export class StorageError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/** Check for chrome.runtime.lastError and throw if present */
function checkLastError(operation: string): void {
  if (chrome.runtime.lastError) {
    throw new StorageError(chrome.runtime.lastError.message || 'Unknown storage error', operation);
  }
}

export async function getStorage(): Promise<StorageSchema> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (result) => {
      try {
        checkLastError('getStorage');
      } catch (error) {
        reject(error);
        return;
      }
      
      const data = result as Record<string, unknown>;
      if (!data || !data.version) {
        // Initialize with defaults and save to storage
        const initial: StorageSchema = {
          version: STORAGE_VERSION,
          settings: defaultSettings,
          presets: {},
          positions: {},
          archiveItems: [],
          recentDocuments: [],
          customThemes: [],
          onboardingCompleted: false,
          exitConfirmationDismissed: false,
        };
        // Save the initial state to storage
        chrome.storage.local.set(initial, () => {
          try {
            checkLastError('getStorage.init');
            resolve(initial);
          } catch (error) {
            reject(error);
          }
        });
      } else {
        // Merge stored settings with defaults to handle new settings added in updates
        const storedSettings = (data.settings || {}) as Partial<ReaderSettings>;
        const mergedSettings = { ...defaultSettings, ...storedSettings };
        resolve({
          version: data.version as number,
          settings: mergedSettings,
          presets: (data.presets || {}) as Record<string, Partial<ReaderSettings>>,
          positions: (data.positions || {}) as Record<string, ReadingPosition>,
          archiveItems: (data.archiveItems || []) as ArchiveItem[],
          recentDocuments: (data.recentDocuments || []) as RecentDocument[],
          customThemes: (data.customThemes || []) as CustomTheme[],
          onboardingCompleted: (data.onboardingCompleted || false) as boolean,
          exitConfirmationDismissed: (data.exitConfirmationDismissed || false) as boolean,
        });
      }
    });
  });
}

export async function saveSettings(settings: Partial<ReaderSettings>): Promise<void> {
  const storage = await getStorage();
  const newSettings = { ...storage.settings, ...settings };

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ 
      version: STORAGE_VERSION,
      settings: newSettings 
    }, () => {
      try {
        checkLastError('saveSettings');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function getSettings(): Promise<ReaderSettings> {
  const storage = await getStorage();
  return storage.settings;
}

export async function savePosition(urlOrMetadata: string | DocumentMetadata, position: ReadingPosition): Promise<void> {
  const storage = await getStorage();
  const key = typeof urlOrMetadata === 'string' 
    ? getUrlKey(urlOrMetadata) 
    : getUrlKey(getDocumentKey(urlOrMetadata));
  const positions = { ...storage.positions, [key]: position };

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ positions }, () => {
      try {
        checkLastError('savePosition');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function getPosition(urlOrMetadata: string | DocumentMetadata): Promise<ReadingPosition | null> {
  const storage = await getStorage();
  const key = typeof urlOrMetadata === 'string' 
    ? getUrlKey(urlOrMetadata) 
    : getUrlKey(getDocumentKey(urlOrMetadata));
  return storage.positions[key] || null;
}

export async function addRecentDocument(doc: RecentDocument): Promise<void> {
  const storage = await getStorage();
  const recentDocuments = [
    doc,
    ...storage.recentDocuments.filter((d) => d.id !== doc.id),
  ].slice(0, MAX_RECENT_DOCUMENTS);

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ recentDocuments }, () => {
      try {
        checkLastError('addRecentDocument');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function getRecentDocuments(): Promise<RecentDocument[]> {
  const storage = await getStorage();
  return storage.recentDocuments;
}

export async function savePreset(name: string, preset: Partial<ReaderSettings>): Promise<void> {
  const storage = await getStorage();
  const presets = { ...storage.presets, [name]: preset };

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ presets }, () => {
      try {
        checkLastError('savePreset');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function getPresets(): Promise<Record<string, Partial<ReaderSettings>>> {
  const storage = await getStorage();
  return storage.presets;
}

export async function deletePreset(name: string): Promise<void> {
  const storage = await getStorage();
  const { [name]: _, ...presets } = storage.presets;

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ presets }, () => {
      try {
        checkLastError('deletePreset');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function isOnboardingCompleted(): Promise<boolean> {
  const storage = await getStorage();
  return storage.onboardingCompleted;
}

export async function completeOnboarding(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ onboardingCompleted: true }, () => {
      try {
        checkLastError('completeOnboarding');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function resetSettings(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ settings: defaultSettings }, () => {
      try {
        checkLastError('resetSettings');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function clearStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      try {
        checkLastError('clearStorage');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function isExitConfirmationDismissed(): Promise<boolean> {
  const storage = await getStorage();
  return storage.exitConfirmationDismissed;
}

export async function dismissExitConfirmation(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ exitConfirmationDismissed: true }, () => {
      try {
        checkLastError('dismissExitConfirmation');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Generate a storage key from a URL.
 * Uses base64 encoding for collision-free keys.
 * Keys are prefixed and truncated to stay within storage limits.
 */
function getUrlKey(url: string): string {
  // Use base64 encoding for a collision-free key
  const encoded = btoa(encodeURIComponent(url));
  // Truncate to reasonable length (chrome.storage keys can be long, but let's be safe)
  // 200 chars is plenty for uniqueness while staying well under limits
  return `pos_${encoded.slice(0, 200)}`;
}

/**
 * Generate a stable storage key for a document.
 * - For web/selection sources: uses the URL
 * - For file-based sources (epub, mobi, pdf, docx): uses source + file hash
 * 
 * This ensures that re-importing the same file resumes from the saved position,
 * even if the file is opened from a different location.
 */
export function getDocumentKey(metadata: DocumentMetadata): string {
  // File-based sources use hash for stable identification
  if (metadata.fileHash && (metadata.source === 'epub' || metadata.source === 'mobi' || metadata.source === 'pdf' || metadata.source === 'docx')) {
    return `file_${metadata.source}_${metadata.fileHash}`;
  }
  
  // Web/selection sources use URL
  return metadata.url || `doc_${metadata.createdAt}`;
}

// =============================================================================
// CUSTOM THEMES
// =============================================================================

export async function getCustomThemes(): Promise<CustomTheme[]> {
  const storage = await getStorage();
  return storage.customThemes;
}

export async function saveCustomTheme(theme: CustomTheme): Promise<void> {
  const storage = await getStorage();
  // Update existing or add new
  const existingIndex = storage.customThemes.findIndex(t => t.name === theme.name);
  let customThemes: CustomTheme[];
  
  if (existingIndex >= 0) {
    customThemes = [...storage.customThemes];
    customThemes[existingIndex] = theme;
  } else {
    customThemes = [...storage.customThemes, theme];
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ customThemes }, () => {
      try {
        checkLastError('saveCustomTheme');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function deleteCustomTheme(name: string): Promise<void> {
  const storage = await getStorage();
  const customThemes = storage.customThemes.filter(t => t.name !== name);

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ customThemes }, () => {
      try {
        checkLastError('deleteCustomTheme');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

// =============================================================================
// CURRENT DOCUMENT (for refresh persistence)
// =============================================================================

const CURRENT_DOCUMENT_KEY = 'currentDocument';

/**
 * Save the current document to storage so it survives page refresh.
 * This is separate from recentDocuments - it's specifically for the 
 * currently-open document in the reader tab.
 */
export async function saveCurrentDocument(doc: FlowDocument): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [CURRENT_DOCUMENT_KEY]: doc }, () => {
      try {
        checkLastError('saveCurrentDocument');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Get the current document from storage (if any).
 * Used to restore state after a page refresh.
 */
export async function getCurrentDocument(): Promise<FlowDocument | null> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(CURRENT_DOCUMENT_KEY, (result) => {
      try {
        checkLastError('getCurrentDocument');
        const doc = result[CURRENT_DOCUMENT_KEY] as FlowDocument | undefined;
        resolve(doc || null);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Clear the current document from storage.
 * Called when the user closes the reader or imports a new document.
 */
export async function clearCurrentDocument(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(CURRENT_DOCUMENT_KEY, () => {
      try {
        checkLastError('clearCurrentDocument');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}
