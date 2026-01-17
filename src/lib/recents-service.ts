import type { ArchiveItem, ArchiveItemType, ArchiveProgress, ReadingPosition, DocumentMetadata, FlowDocument } from '@/types';
import { syncService } from './sync/sync-service';
import { storageFacade } from './storage-facade';
import { computeTextHash } from './file-utils';
import { normalizeUrl, hashString } from './url-utils';
import { mergeFullArchiveItems } from './archive-utils';


export const MAX_ARCHIVE_ITEMS = 200;
export const MAX_PASTE_CONTENT_SIZE = 100_000;
const DEBOUNCE_DELAY = 300;


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


let pendingWrite: ReturnType<typeof setTimeout> | null = null;
let pendingItems: ArchiveItem[] | null = null;
let pendingResolvers: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

async function getArchiveItems(): Promise<ArchiveItem[]> {
  const state = await storageFacade.getState();
  return state.archiveItems;
}

/**
 * Save archive items with debouncing.
 * Multiple rapid calls will be coalesced into a single save, and ALL callers
 * will have their promises resolved when the save completes.
 */
async function saveArchiveItems(items: ArchiveItem[]): Promise<void> {
  pendingItems = items;
  
  if (pendingWrite) {
    clearTimeout(pendingWrite);
  }
  
  return new Promise((resolve, reject) => {
    // Add this caller to the list of pending resolvers
    pendingResolvers.push({ resolve, reject });
    
    pendingWrite = setTimeout(async () => {
      const itemsToSave = pendingItems;
      const resolvers = pendingResolvers;
      
      // Reset state before async work
      pendingItems = null;
      pendingWrite = null;
      pendingResolvers = [];
      
      if (!itemsToSave) {
        // No items to save - resolve all waiters
        resolvers.forEach(r => r.resolve());
        return;
      }
      
      try {
        await storageFacade.updateArchiveItems(itemsToSave);
        // Resolve all waiters on success
        resolvers.forEach(r => r.resolve());
      } catch (error) {
        // Reject all waiters on failure
        const err = error instanceof Error ? error : new Error(String(error));
        resolvers.forEach(r => r.reject(err));
      }
    }, DEBOUNCE_DELAY);
  });
}

/**
 * Immediately save archive items, bypassing debounce.
 * Used for critical operations like delete where we need immediate persistence.
 * Any pending debounced saves will be superseded and resolved.
 */
async function flushArchiveItems(items: ArchiveItem[]): Promise<void> {
  if (pendingWrite) {
    clearTimeout(pendingWrite);
    pendingWrite = null;
  }
  
  // Capture and clear pending resolvers - they'll be resolved by this flush
  const resolvers = pendingResolvers;
  pendingItems = null;
  pendingResolvers = [];
  
  try {
    await storageFacade.updateArchiveItems(items);
    // Resolve any pending callers that were waiting for debounced save
    resolvers.forEach(r => r.resolve());
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    resolvers.forEach(r => r.reject(err));
    throw error; // Re-throw for the flush caller
  }
}

function deduplicateItems(items: ArchiveItem[]): ArchiveItem[] {
  const byFileHash = new Map<string, ArchiveItem[]>();
  const byNormalizedUrl = new Map<string, ArchiveItem[]>();
  
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
  
  for (const [, duplicates] of byFileHash) {
    if (duplicates.length === 1) {
      if (!processedIds.has(duplicates[0].id)) {
        merged.set(duplicates[0].id, duplicates[0]);
        processedIds.add(duplicates[0].id);
      }
    } else {
      let mergedItem = duplicates[0];
      for (let i = 1; i < duplicates.length; i++) {
        mergedItem = mergeFullArchiveItems(mergedItem, duplicates[i]);
        processedIds.add(duplicates[i].id);
      }
      
      for (const item of duplicates) {
        merged.delete(item.id);
      }
      merged.set(mergedItem.id, mergedItem);
      processedIds.add(mergedItem.id);
    }
  }
  
  for (const [, duplicates] of byNormalizedUrl) {
    const unprocessed = duplicates.filter(item => !processedIds.has(item.id));
    
    if (unprocessed.length === 0) continue;
    
    if (unprocessed.length === 1) {
      merged.set(unprocessed[0].id, unprocessed[0]);
      processedIds.add(unprocessed[0].id);
    } else {
      let mergedItem = unprocessed[0];
      for (let i = 1; i < unprocessed.length; i++) {
        mergedItem = mergeFullArchiveItems(mergedItem, unprocessed[i]);
        processedIds.add(unprocessed[i].id);
      }
      
      for (const item of unprocessed) {
        merged.delete(item.id);
      }
      merged.set(mergedItem.id, mergedItem);
      processedIds.add(mergedItem.id);
    }
  }
  
  for (const item of items) {
    if (!processedIds.has(item.id)) {
      merged.set(item.id, item);
      processedIds.add(item.id);
    }
  }
  
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
    await flushArchiveItems(deduped);
  }
  
  return { removed: removedCount };
}

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

export function generateItemId(metadata: DocumentMetadata): string {
  if (metadata.fileHash) {
    return `file_${metadata.source}_${metadata.fileHash}`;
  }
  
  if (metadata.url) {
    return `web_${hashString(normalizeUrl(metadata.url))}`;
  }
  
  return `${metadata.source}_${metadata.createdAt}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateStableId(input: AddRecentInput): string {
  const now = Date.now();
  
  if (input.fileHash) {
    return `file_${input.type}_${input.fileHash}`;
  }
  
  if (input.url) {
    return `web_${hashString(normalizeUrl(input.url))}`;
  }
  
  if (input.pasteContent) {
    const textHash = computeTextHash(input.pasteContent);
    return `paste_${textHash}`;
  }
  
  return `${input.type}_${now}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getSourceLabel(metadata: DocumentMetadata): string {
  if (metadata.url) {
    try {
      const url = new URL(metadata.url);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return metadata.url;
    }
  }
  
  if (metadata.fileName) {
    return metadata.fileName;
  }
  
  return metadata.source;
}

export async function addRecent(input: AddRecentInput): Promise<ArchiveItem> {
  const items = await getArchiveItems();
  const now = Date.now();
  
  const normalizedInputUrl = input.url ? normalizeUrl(input.url) : null;
  const inputFileHash = input.fileHash || (input.pasteContent ? computeTextHash(input.pasteContent) : undefined);
  
  const existingIndex = items.findIndex(item => {
    if (inputFileHash && item.fileHash === inputFileHash) {
      return true;
    }
    if (normalizedInputUrl && item.url && normalizeUrl(item.url) === normalizedInputUrl) {
      return true;
    }
    // Handle legacy paste items without fileHash
    if (inputFileHash && item.type === 'paste' && item.pasteContent && !item.fileHash) {
      const existingHash = computeTextHash(item.pasteContent);
      if (existingHash === inputFileHash) {
        return true;
      }
    }
    return false;
  });
  
  let pasteContent = input.pasteContent;
  if (pasteContent && pasteContent.length > MAX_PASTE_CONTENT_SIZE) {
    pasteContent = pasteContent.slice(0, MAX_PASTE_CONTENT_SIZE);
    console.warn(`Paste content truncated from ${input.pasteContent?.length} to ${MAX_PASTE_CONTENT_SIZE} characters`);
  }
  
  let item: ArchiveItem;
  
  if (existingIndex >= 0) {
    const existing = items[existingIndex];
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
      fileHash: input.fileHash || existing.fileHash || inputFileHash,
    };
    items.splice(existingIndex, 1);
  } else {
    const stableId = generateStableId(input);
    item = {
      ...input,
      pasteContent,
      id: stableId,
      createdAt: now,
      lastOpenedAt: now,
    };
  }
  
  items.unshift(item);
  
  if (items.length > MAX_ARCHIVE_ITEMS) {
    items.splice(MAX_ARCHIVE_ITEMS);
  }
  
  await saveArchiveItems(items);
  return item;
}

export async function updateLastOpened(
  id: string,
  position?: ReadingPosition,
  progress?: ArchiveProgress
): Promise<void> {
  const items = await getArchiveItems();
  const index = items.findIndex(item => item.id === id);
  
  if (index < 0) {
    return;
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
  
  items.splice(index, 1);
  items.unshift(updated);
  
  await saveArchiveItems(items);
}

export async function updateArchiveItem(
  id: string,
  updates: Partial<Pick<ArchiveItem, 'title' | 'author' | 'sourceLabel'>>
): Promise<ArchiveItem | null> {
  const items = await getArchiveItems();
  const index = items.findIndex(item => item.id === id);
  
  if (index < 0) {
    return null;
  }
  
  const item = items[index];
  const updated: ArchiveItem = {
    ...item,
    ...updates,
  };
  
  if (updates.title && updated.cachedDocument) {
    updated.cachedDocument = {
      ...updated.cachedDocument,
      metadata: {
        ...updated.cachedDocument.metadata,
        title: updates.title,
      },
    };
  }
  
  items[index] = updated;
  await saveArchiveItems(items);
  
  return updated;
}

export async function removeRecent(id: string): Promise<void> {
  const items = await getArchiveItems();
  const itemToRemove = items.find(item => item.id === id);
  const filtered = items.filter(item => item.id !== id);
  
  if (filtered.length !== items.length) {
    await flushArchiveItems(filtered);
    
    if (itemToRemove) {
      // Tombstone creation is critical for sync - await it to ensure
      // the item won't be re-synced back from other devices
      try {
        await storageFacade.addDeletedItemTombstone({
          id: itemToRemove.id,
          fileHash: itemToRemove.fileHash,
          url: itemToRemove.url,
        });
      } catch (error) {
        console.error('Failed to add deleted item tombstone:', error);
        // Continue anyway - the item is already removed locally
      }
      
      // Content deletion is best-effort, fire-and-forget is acceptable
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

export async function clearRecents(): Promise<void> {
  const items = await getArchiveItems();
  
  await flushArchiveItems([]);
  
  // Create tombstones for all items to prevent re-sync
  // Use Promise.allSettled to ensure we try all items even if some fail
  const tombstonePromises = items.map(async item => {
    try {
      await storageFacade.addDeletedItemTombstone({
        id: item.id,
        fileHash: item.fileHash,
        url: item.url,
      });
    } catch (error) {
      console.error('Failed to add deleted item tombstone:', error);
    }
  });
  
  await Promise.allSettled(tombstonePromises);
  
  // Content deletion is best-effort, fire-and-forget is acceptable
  for (const item of items) {
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
  
  if (types && types.length > 0) {
    items = items.filter(item => types.includes(item.type));
  }
  
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
  
  if (offset > 0 || limit !== undefined) {
    items = items.slice(offset, limit !== undefined ? offset + limit : undefined);
  }
  
  return items;
}

export async function getRecent(id: string): Promise<ArchiveItem | null> {
  const items = await getArchiveItems();
  return items.find(item => item.id === id) || null;
}


/** Cache file-based documents since they can't be re-fetched */
export function shouldCacheDocument(source: string): boolean {
  return ['pdf', 'docx', 'epub', 'mobi'].includes(source);
}

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
  
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

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
