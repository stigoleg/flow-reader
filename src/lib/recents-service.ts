/**
 * Recents Service
 * 
 * Unified service for managing archive items (reading history).
 * Provides CRUD operations, search, and filtering for the Archive page.
 */

import type { ArchiveItem, ArchiveItemType, ArchiveProgress, ReadingPosition, DocumentMetadata, RecentDocument, FlowDocument } from '@/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Maximum number of archive items to store */
export const MAX_ARCHIVE_ITEMS = 200;

/** Maximum size of paste content to store (100KB) */
export const MAX_PASTE_CONTENT_SIZE = 100_000;

/** Debounce delay for storage writes (ms) */
const DEBOUNCE_DELAY = 300;

/** Current storage version */
const STORAGE_VERSION = 2;

// =============================================================================
// TYPES
// =============================================================================

export interface QueryOptions {
  /** Filter by search query (matches title, author, sourceLabel) */
  search?: string;
  /** Filter by content type(s) */
  types?: ArchiveItemType[];
  /** Sort field */
  sortBy?: 'lastOpenedAt' | 'title' | 'createdAt';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Maximum number of results */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
}

export interface AddRecentInput {
  type: ArchiveItemType;
  title: string;
  author?: string;
  sourceLabel: string;
  url?: string;
  progress?: ArchiveProgress;
  lastPosition?: ReadingPosition;
  pasteContent?: string;
  cachedDocument?: FlowDocument;
  fileHash?: string;
}

// =============================================================================
// INTERNAL STATE
// =============================================================================

let pendingWrite: ReturnType<typeof setTimeout> | null = null;
let pendingItems: ArchiveItem[] | null = null;

// =============================================================================
// STORAGE HELPERS
// =============================================================================

/**
 * Get archive items from storage
 */
async function getArchiveItems(): Promise<ArchiveItem[]> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['archiveItems', 'recentDocuments', 'version'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      const version = result.version as number | undefined;
      const archiveItems = result.archiveItems as ArchiveItem[] | undefined;
      const recentDocuments = result.recentDocuments as RecentDocument[] | undefined;
      
      // If we have archive items and version >= 2, use them directly
      if (archiveItems && version && version >= STORAGE_VERSION) {
        resolve(archiveItems);
        return;
      }
      
      // If we only have old recentDocuments, migrate them
      if (recentDocuments && recentDocuments.length > 0 && !archiveItems) {
        const migrated = migrateRecentDocuments(recentDocuments);
        // Save the migrated items
        saveArchiveItems(migrated).then(() => resolve(migrated)).catch(reject);
        return;
      }
      
      // No items yet
      resolve(archiveItems || []);
    });
  });
}

/**
 * Save archive items to storage (debounced)
 */
async function saveArchiveItems(items: ArchiveItem[]): Promise<void> {
  pendingItems = items;
  
  if (pendingWrite) {
    clearTimeout(pendingWrite);
  }
  
  return new Promise((resolve, reject) => {
    pendingWrite = setTimeout(() => {
      const itemsToSave = pendingItems;
      pendingItems = null;
      pendingWrite = null;
      
      if (!itemsToSave) {
        resolve();
        return;
      }
      
      chrome.storage.local.set({ 
        archiveItems: itemsToSave,
        version: STORAGE_VERSION,
      }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    }, DEBOUNCE_DELAY);
  });
}

/**
 * Force immediate save (for critical operations)
 */
async function flushArchiveItems(items: ArchiveItem[]): Promise<void> {
  if (pendingWrite) {
    clearTimeout(pendingWrite);
    pendingWrite = null;
  }
  pendingItems = null;
  
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ 
      archiveItems: items,
      version: STORAGE_VERSION,
    }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// =============================================================================
// MIGRATION
// =============================================================================

/**
 * Migrate old RecentDocument format to ArchiveItem
 */
function migrateRecentDocuments(docs: RecentDocument[]): ArchiveItem[] {
  return docs.map((doc): ArchiveItem => {
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
}

/**
 * Map document source to archive item type
 */
export function mapSourceToType(source: string): ArchiveItemType {
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

/**
 * Extract source label from a recent document
 */
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

// =============================================================================
// ID GENERATION
// =============================================================================

/**
 * Generate a stable ID for a document
 */
export function generateItemId(metadata: DocumentMetadata): string {
  // For file-based sources, use the file hash
  if (metadata.fileHash) {
    return `file_${metadata.source}_${metadata.fileHash}`;
  }
  
  // For web sources, use the URL
  if (metadata.url) {
    // Create a simple hash of the URL
    return `web_${hashString(metadata.url)}`;
  }
  
  // For paste and other sources, use timestamp + random
  return `${metadata.source}_${metadata.createdAt}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Simple string hash for generating IDs
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// =============================================================================
// SOURCE LABEL HELPERS
// =============================================================================

/**
 * Get source label from document metadata
 */
export function getSourceLabel(metadata: DocumentMetadata): string {
  // For web sources, extract domain
  if (metadata.url) {
    try {
      const url = new URL(metadata.url);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return metadata.url;
    }
  }
  
  // For file sources, use filename
  if (metadata.fileName) {
    return metadata.fileName;
  }
  
  // Fallback to source type
  return metadata.source;
}

// =============================================================================
// CORE API
// =============================================================================

/**
 * Add a new item to the archive or update an existing one
 */
export async function addRecent(input: AddRecentInput): Promise<ArchiveItem> {
  const items = await getArchiveItems();
  const now = Date.now();
  
  // Check for existing item with same characteristics
  const existingIndex = items.findIndex(item => {
    // Match by file hash for file-based documents
    if (input.fileHash && item.fileHash === input.fileHash) {
      return true;
    }
    // Match by URL for web documents
    if (input.url && item.url === input.url) {
      return true;
    }
    return false;
  });
  
  // Truncate paste content if too large
  let pasteContent = input.pasteContent;
  if (pasteContent && pasteContent.length > MAX_PASTE_CONTENT_SIZE) {
    pasteContent = pasteContent.slice(0, MAX_PASTE_CONTENT_SIZE);
    console.warn(`Paste content truncated from ${input.pasteContent?.length} to ${MAX_PASTE_CONTENT_SIZE} characters`);
  }
  
  let item: ArchiveItem;
  
  if (existingIndex >= 0) {
    // Update existing item and move to top
    const existing = items[existingIndex];
    item = {
      ...existing,
      ...input,
      pasteContent,
      id: existing.id,
      createdAt: existing.createdAt,
      lastOpenedAt: now,
    };
    items.splice(existingIndex, 1);
  } else {
    // Create new item
    item = {
      ...input,
      pasteContent,
      id: `${input.type}_${now}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: now,
      lastOpenedAt: now,
    };
  }
  
  // Add to top of list
  items.unshift(item);
  
  // Evict oldest items if over limit
  if (items.length > MAX_ARCHIVE_ITEMS) {
    items.splice(MAX_ARCHIVE_ITEMS);
  }
  
  await saveArchiveItems(items);
  return item;
}

/**
 * Update the lastOpenedAt timestamp and optionally the position/progress
 */
export async function updateLastOpened(
  id: string,
  position?: ReadingPosition,
  progress?: ArchiveProgress
): Promise<void> {
  const items = await getArchiveItems();
  const index = items.findIndex(item => item.id === id);
  
  if (index < 0) {
    return; // Item not found, no-op
  }
  
  const item = items[index];
  const updated: ArchiveItem = {
    ...item,
    lastOpenedAt: Date.now(),
  };
  
  if (position !== undefined) {
    updated.lastPosition = position;
  }
  
  if (progress !== undefined) {
    updated.progress = progress;
  }
  
  // Move to top of list
  items.splice(index, 1);
  items.unshift(updated);
  
  await saveArchiveItems(items);
}

/**
 * Remove an item from the archive
 */
export async function removeRecent(id: string): Promise<void> {
  const items = await getArchiveItems();
  const filtered = items.filter(item => item.id !== id);
  
  if (filtered.length !== items.length) {
    await flushArchiveItems(filtered);
  }
}

/**
 * Clear all items from the archive
 */
export async function clearRecents(): Promise<void> {
  await flushArchiveItems([]);
}

/**
 * Query archive items with filtering and search
 */
export async function queryRecents(options: QueryOptions = {}): Promise<ArchiveItem[]> {
  const {
    search,
    types,
    sortBy = 'lastOpenedAt',
    sortOrder = 'desc',
    limit,
    offset = 0,
  } = options;
  
  let items = await getArchiveItems();
  
  // Filter by type
  if (types && types.length > 0) {
    items = items.filter(item => types.includes(item.type));
  }
  
  // Filter by search query
  if (search && search.trim()) {
    const query = search.toLowerCase().trim();
    items = items.filter(item => {
      const title = item.title.toLowerCase();
      const author = item.author?.toLowerCase() || '';
      const sourceLabel = item.sourceLabel.toLowerCase();
      
      return title.includes(query) || 
             author.includes(query) || 
             sourceLabel.includes(query);
    });
  }
  
  // Sort
  items.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'lastOpenedAt':
        comparison = a.lastOpenedAt - b.lastOpenedAt;
        break;
      case 'createdAt':
        comparison = a.createdAt - b.createdAt;
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  // Apply offset and limit
  if (offset > 0 || limit !== undefined) {
    items = items.slice(offset, limit !== undefined ? offset + limit : undefined);
  }
  
  return items;
}

/**
 * Get a single archive item by ID
 */
export async function getRecent(id: string): Promise<ArchiveItem | null> {
  const items = await getArchiveItems();
  return items.find(item => item.id === id) || null;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a document should have its content cached
 */
export function shouldCacheDocument(source: string): boolean {
  // Cache file-based documents since they can't be re-fetched
  return ['pdf', 'docx', 'epub', 'mobi'].includes(source);
}

/**
 * Calculate progress from reading position
 */
export function calculateProgress(
  currentBlockIndex: number,
  totalBlocks: number,
  chapterInfo?: { currentChapter: number; totalChapters: number }
): ArchiveProgress {
  const percent = totalBlocks > 0 
    ? Math.round((currentBlockIndex / totalBlocks) * 100)
    : 0;
  
  let label = `${percent}%`;
  
  if (chapterInfo && chapterInfo.totalChapters > 1) {
    label = `Ch ${chapterInfo.currentChapter + 1} of ${chapterInfo.totalChapters}`;
    if (percent > 0) {
      label += ` (${percent}%)`;
    }
  }
  
  return { percent, label };
}

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) {
    return 'Just now';
  }
  
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  
  if (days === 1) {
    return 'Yesterday';
  }
  
  if (days < 7) {
    return `${days} days ago`;
  }
  
  // Format as date
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get type badge label for display
 */
export function getTypeBadgeLabel(type: ArchiveItemType): string {
  switch (type) {
    case 'web':
      return 'Web';
    case 'pdf':
      return 'PDF';
    case 'docx':
      return 'Word';
    case 'epub':
      return 'EPUB';
    case 'mobi':
      return 'MOBI';
    case 'paste':
      return 'Paste';
    default:
      return type;
  }
}
