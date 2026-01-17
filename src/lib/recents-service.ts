/**
 * Recents Service
 * 
 * Unified service for managing archive items (reading history).
 * Provides CRUD operations, search, and filtering for the Archive page.
 */

import type { ArchiveItem, ArchiveItemType, ArchiveProgress, ReadingPosition, DocumentMetadata, RecentDocument, FlowDocument } from '@/types';
import { CURRENT_STORAGE_VERSION } from './migrations';
import { syncService } from './sync/sync-service';
import { storageFacade } from './storage-facade';
import { computeTextHash } from './file-utils';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Maximum number of archive items to store */
export const MAX_ARCHIVE_ITEMS = 200;

/** Maximum size of paste content to store (100KB) */
export const MAX_PASTE_CONTENT_SIZE = 100_000;

/** Debounce delay for storage writes (ms) */
const DEBOUNCE_DELAY = 300;

/** Current storage version - use centralized constant */
const STORAGE_VERSION = CURRENT_STORAGE_VERSION;

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
// DEDUPLICATION
// =============================================================================

/**
 * Compare two positions and return true if posA is further in the document
 */
function isPositionFurther(
  posA: ReadingPosition | undefined,
  posB: ReadingPosition | undefined
): boolean {
  if (!posA) return false;
  if (!posB) return true;
  
  const aChapter = posA.chapterIndex ?? 0;
  const bChapter = posB.chapterIndex ?? 0;
  
  if (aChapter > bChapter) return true;
  if (aChapter < bChapter) return false;
  
  return posA.blockIndex > posB.blockIndex;
}

/**
 * Merge two archive items, keeping the best data from each.
 * - Uses furthest reading position
 * - Uses highest progress percentage
 * - Prefers newer metadata
 * - Keeps the ID from the item with furthest progress
 */
function mergeArchiveItemPair(
  item1: ArchiveItem,
  item2: ArchiveItem
): ArchiveItem {
  const item1Further = isPositionFurther(item1.lastPosition, item2.lastPosition);
  const item2Further = isPositionFurther(item2.lastPosition, item1.lastPosition);
  
  const item1Percent = item1.progress?.percent ?? 0;
  const item2Percent = item2.progress?.percent ?? 0;
  
  let primary: ArchiveItem;
  let secondary: ArchiveItem;
  
  if (item1Further || (!item2Further && item1Percent >= item2Percent)) {
    primary = item1;
    secondary = item2;
  } else {
    primary = item2;
    secondary = item1;
  }
  
  const newerMetadata = primary.lastOpenedAt >= secondary.lastOpenedAt ? primary : secondary;
  
  // Get the better position
  const mergedPosition = item1Further ? item1.lastPosition 
    : item2Further ? item2.lastPosition 
    : (item1.lastPosition?.timestamp ?? 0) >= (item2.lastPosition?.timestamp ?? 0) ? item1.lastPosition : item2.lastPosition;
  
  // Get the better progress
  const mergedProgress = item1Percent >= item2Percent ? item1.progress : item2.progress;
  
  return {
    ...newerMetadata,
    id: primary.id,
    createdAt: Math.min(primary.createdAt, secondary.createdAt),
    lastPosition: mergedPosition,
    progress: mergedProgress,
    fileHash: primary.fileHash || secondary.fileHash,
    url: primary.url || secondary.url,
    // Prefer the cached document that exists
    cachedDocument: primary.cachedDocument || secondary.cachedDocument,
    pasteContent: primary.pasteContent || secondary.pasteContent,
  };
}

/**
 * Deduplicate archive items by fileHash and URL.
 * Returns a new array with duplicates merged (furthest progress wins).
 */
function deduplicateItems(items: ArchiveItem[]): ArchiveItem[] {
  const byFileHash = new Map<string, ArchiveItem[]>();
  const byNormalizedUrl = new Map<string, ArchiveItem[]>();
  
  // Build indexes
  for (const item of items) {
    if (item.fileHash) {
      const existing = byFileHash.get(item.fileHash) || [];
      existing.push(item);
      byFileHash.set(item.fileHash, existing);
    }
    
    if (item.url) {
      const normalizedItemUrl = normalizeUrl(item.url);
      const existing = byNormalizedUrl.get(normalizedItemUrl) || [];
      existing.push(item);
      byNormalizedUrl.set(normalizedItemUrl, existing);
    }
  }
  
  const processedIds = new Set<string>();
  const merged = new Map<string, ArchiveItem>();
  
  // First pass: merge by fileHash
  for (const [, duplicates] of byFileHash) {
    if (duplicates.length === 1) {
      if (!processedIds.has(duplicates[0].id)) {
        merged.set(duplicates[0].id, duplicates[0]);
        processedIds.add(duplicates[0].id);
      }
    } else {
      let mergedItem = duplicates[0];
      for (let i = 1; i < duplicates.length; i++) {
        console.log(`Deduplicating: "${duplicates[i].title}" (same fileHash as "${mergedItem.title}")`);
        mergedItem = mergeArchiveItemPair(mergedItem, duplicates[i]);
        processedIds.add(duplicates[i].id);
      }
      
      for (const item of duplicates) {
        merged.delete(item.id);
      }
      merged.set(mergedItem.id, mergedItem);
      processedIds.add(mergedItem.id);
    }
  }
  
  // Second pass: merge by URL
  for (const [, duplicates] of byNormalizedUrl) {
    const unprocessed = duplicates.filter(item => !processedIds.has(item.id));
    
    if (unprocessed.length === 0) continue;
    
    if (unprocessed.length === 1) {
      merged.set(unprocessed[0].id, unprocessed[0]);
      processedIds.add(unprocessed[0].id);
    } else {
      let mergedItem = unprocessed[0];
      for (let i = 1; i < unprocessed.length; i++) {
        console.log(`Deduplicating: "${unprocessed[i].title}" (same URL as "${mergedItem.title}")`);
        mergedItem = mergeArchiveItemPair(mergedItem, unprocessed[i]);
        processedIds.add(unprocessed[i].id);
      }
      
      for (const item of unprocessed) {
        merged.delete(item.id);
      }
      merged.set(mergedItem.id, mergedItem);
      processedIds.add(mergedItem.id);
    }
  }
  
  // Third pass: add any remaining items
  for (const item of items) {
    if (!processedIds.has(item.id)) {
      merged.set(item.id, item);
      processedIds.add(item.id);
    }
  }
  
  // Sort by lastOpenedAt descending
  return Array.from(merged.values())
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

/**
 * Deduplicate archive items in storage.
 * Call this on startup or when duplicates are suspected.
 */
export async function deduplicateArchive(): Promise<{ removed: number }> {
  const items = await getArchiveItems();
  const originalCount = items.length;
  
  const deduped = deduplicateItems(items);
  const removedCount = originalCount - deduped.length;
  
  if (removedCount > 0) {
    console.log(`Deduplicated archive: removed ${removedCount} duplicate(s) from ${originalCount} items`);
    await flushArchiveItems(deduped);
  }
  
  return { removed: removedCount };
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
    return `web_${hashString(normalizeUrl(metadata.url))}`;
  }
  
  // For paste and other sources, use timestamp + random
  return `${metadata.source}_${metadata.createdAt}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a stable ID for an AddRecentInput
 * Uses fileHash for files, normalized URL for web content, computed hash for paste
 */
function generateStableId(input: AddRecentInput): string {
  const now = Date.now();
  
  // For file-based documents, use the file hash (most reliable)
  if (input.fileHash) {
    return `file_${input.type}_${input.fileHash}`;
  }
  
  // For web sources, use normalized URL hash
  if (input.url) {
    return `web_${hashString(normalizeUrl(input.url))}`;
  }
  
  // For paste content, compute hash for stable ID
  if (input.pasteContent) {
    const textHash = computeTextHash(input.pasteContent);
    return `paste_${textHash}`;
  }
  
  // For other sources without identifiable content, use timestamp + random
  return `${input.type}_${now}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Normalize a URL for consistent comparison
 * - Removes trailing slashes
 * - Removes www. prefix
 * - Removes common tracking parameters
 * - Lowercases the domain
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Lowercase the hostname and remove www.
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    
    // Remove trailing slash from pathname
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref'];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    
    // Sort remaining search params for consistency
    parsed.searchParams.sort();
    
    // Remove hash (fragment)
    parsed.hash = '';
    
    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is but lowercase
    return url.toLowerCase();
  }
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
  const normalizedInputUrl = input.url ? normalizeUrl(input.url) : null;
  
  // For paste items without fileHash, compute hash from pasteContent for matching
  const inputFileHash = input.fileHash || (input.pasteContent ? computeTextHash(input.pasteContent) : undefined);
  
  const existingIndex = items.findIndex(item => {
    // Match by file hash for file-based documents (most reliable)
    if (inputFileHash && item.fileHash === inputFileHash) {
      return true;
    }
    // Match by normalized URL for web documents
    if (normalizedInputUrl && item.url && normalizeUrl(item.url) === normalizedInputUrl) {
      return true;
    }
    // Match paste items by computing hash from their stored pasteContent
    // This handles legacy paste items that don't have fileHash stored
    if (inputFileHash && item.type === 'paste' && item.pasteContent && !item.fileHash) {
      const existingHash = computeTextHash(item.pasteContent);
      if (existingHash === inputFileHash) {
        return true;
      }
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
    
    // Preserve existing pasteContent and cachedDocument if not provided in input
    const finalPasteContent = pasteContent ?? existing.pasteContent;
    const finalCachedDocument = input.cachedDocument ?? existing.cachedDocument;
    
    item = {
      ...existing,
      ...input,
      pasteContent: finalPasteContent,
      cachedDocument: finalCachedDocument,
      id: existing.id,
      createdAt: existing.createdAt,
      lastOpenedAt: now,
      // Ensure fileHash is set for paste items (migrates legacy items)
      fileHash: input.fileHash || existing.fileHash || inputFileHash,
    };
    items.splice(existingIndex, 1);
  } else {
    // Create new item with stable ID based on content hash or URL
    const stableId = generateStableId(input);
    item = {
      ...input,
      pasteContent,
      id: stableId,
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
  const itemToRemove = items.find(item => item.id === id);
  const filtered = items.filter(item => item.id !== id);
  
  if (filtered.length !== items.length) {
    await flushArchiveItems(filtered);
    
    // Add tombstone and delete synced content if item was found
    if (itemToRemove) {
      // Add tombstone to prevent item from being re-synced
      storageFacade.addDeletedItemTombstone({
        id: itemToRemove.id,
        fileHash: itemToRemove.fileHash,
        url: itemToRemove.url,
      }).catch(error => {
        console.error('Failed to add deleted item tombstone:', error);
      });
      
      // Delete content from sync provider if sync is enabled
      syncService.deleteItemContent({
        id: itemToRemove.id,
        fileHash: itemToRemove.fileHash,
        url: itemToRemove.url,
      }).catch(error => {
        console.error('Failed to delete synced content:', error);
      });
    }
  }
}

/**
 * Clear all items from the archive
 */
export async function clearRecents(): Promise<void> {
  // Get items before clearing to delete their synced content
  const items = await getArchiveItems();
  
  await flushArchiveItems([]);
  
  // Add tombstones and delete content from sync provider for all items
  for (const item of items) {
    // Add tombstone to prevent item from being re-synced
    storageFacade.addDeletedItemTombstone({
      id: item.id,
      fileHash: item.fileHash,
      url: item.url,
    }).catch(error => {
      console.error('Failed to add deleted item tombstone:', error);
    });
    
    // Delete content from sync provider
    syncService.deleteItemContent({
      id: item.id,
      fileHash: item.fileHash,
      url: item.url,
    }).catch(error => {
      console.error('Failed to delete synced content:', error);
    });
  }
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
