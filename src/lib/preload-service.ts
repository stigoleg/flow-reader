/**
 * Background Content Preloading Service
 * 
 * Preloads content for items likely to be read next to improve
 * navigation speed between documents.
 * 
 * Strategy:
 * 1. Prioritize "In Progress" items (highest chance of continuing)
 * 2. Then recently added unread web articles
 * 3. Skip items that already have cached content
 * 4. Limit to 2-3 items to avoid excessive storage
 */

import type { ArchiveItem, FlowDocument } from '@/types';
import { getArchiveItems, updateArchiveItem } from './recents-service';
import { storageFacade } from './storage-facade';

/** Maximum number of items to preload */
const MAX_PRELOAD_ITEMS = 3;

/** Minimum time between preload attempts (5 minutes) */
const PRELOAD_COOLDOWN_MS = 5 * 60 * 1000;

/** Last preload timestamp to prevent excessive calls */
let lastPreloadTime = 0;

/** Items currently being preloaded (to avoid duplicates) */
const preloadingItems = new Set<string>();

/**
 * Get items that are candidates for preloading
 * Returns items sorted by priority:
 * 1. In-progress items (sorted by lastOpenedAt descending)
 * 2. Unread web items (sorted by createdAt descending)
 */
export async function getPreloadCandidates(): Promise<ArchiveItem[]> {
  const items = await getArchiveItems();
  
  // Filter to web items without cached documents
  const webItemsWithoutCache = items.filter(item => 
    item.type === 'web' && 
    !item.cachedDocument && 
    item.url &&
    !preloadingItems.has(item.id)
  );
  
  // Separate in-progress and unread
  const inProgress: ArchiveItem[] = [];
  const unread: ArchiveItem[] = [];
  
  for (const item of webItemsWithoutCache) {
    const progress = item.progress?.percent ?? 0;
    if (progress > 0 && progress < 95) {
      inProgress.push(item);
    } else if (progress === 0) {
      unread.push(item);
    }
  }
  
  // Sort in-progress by lastOpenedAt (most recent first)
  inProgress.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  
  // Sort unread by createdAt (most recent first)
  unread.sort((a, b) => b.createdAt - a.createdAt);
  
  // Combine: in-progress first, then unread
  return [...inProgress, ...unread].slice(0, MAX_PRELOAD_ITEMS);
}

/**
 * Preload content for a single item
 * Extracts content from URL and caches it in the archive item
 */
async function preloadItem(item: ArchiveItem): Promise<boolean> {
  if (!item.url || preloadingItems.has(item.id)) {
    return false;
  }
  
  preloadingItems.add(item.id);
  
  try {
    // Request extraction from the service worker
    const response = await chrome.runtime.sendMessage({
      type: 'EXTRACT_FROM_URL',
      url: item.url,
    });
    
    if (response?.error || !response) {
      console.warn(`FlowReader: Failed to preload ${item.title}:`, response?.error);
      return false;
    }
    
    const document = response as FlowDocument;
    
    // Update the archive item with the cached document
    await updateArchiveItem(item.id, {
      cachedDocument: document,
    });
    
    console.log(`FlowReader: Preloaded "${item.title}"`);
    return true;
  } catch (error) {
    console.warn(`FlowReader: Error preloading ${item.title}:`, error);
    return false;
  } finally {
    preloadingItems.delete(item.id);
  }
}

/**
 * Check if preloading is enabled in settings
 */
async function isPreloadingEnabled(): Promise<boolean> {
  try {
    const state = await storageFacade.getState();
    // Default to true if setting doesn't exist
    return state.settings?.enablePreloading !== false;
  } catch {
    return true; // Default to enabled
  }
}

/**
 * Trigger background preloading of next items
 * Should be called when:
 * - User finishes reading a document
 * - User opens the archive page
 * - Extension becomes idle
 * 
 * Uses cooldown to prevent excessive calls
 */
export async function triggerPreload(): Promise<void> {
  // Check cooldown
  const now = Date.now();
  if (now - lastPreloadTime < PRELOAD_COOLDOWN_MS) {
    return;
  }
  
  // Check if preloading is enabled
  if (!await isPreloadingEnabled()) {
    return;
  }
  
  lastPreloadTime = now;
  
  try {
    const candidates = await getPreloadCandidates();
    
    if (candidates.length === 0) {
      return;
    }
    
    console.log(`FlowReader: Starting background preload for ${candidates.length} items`);
    
    // Preload items sequentially to avoid overwhelming the browser
    for (const item of candidates) {
      await preloadItem(item);
      // Small delay between items
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error('FlowReader: Error during background preload:', error);
  }
}

/**
 * Preload a specific item immediately (bypass cooldown)
 * Useful when user hovers over an item or explicitly requests preload
 */
export async function preloadSpecificItem(itemId: string): Promise<boolean> {
  const items = await getArchiveItems();
  const item = items.find(i => i.id === itemId);
  
  if (!item || item.cachedDocument || item.type !== 'web' || !item.url) {
    return false;
  }
  
  return preloadItem(item);
}

/**
 * Clear cached document from an item to free up storage
 */
export async function clearCachedDocument(itemId: string): Promise<void> {
  await updateArchiveItem(itemId, {
    cachedDocument: undefined,
  });
}

/**
 * Get statistics about cached content
 */
export async function getCacheStats(): Promise<{
  totalItems: number;
  cachedItems: number;
  preloadCandidates: number;
}> {
  const items = await getArchiveItems();
  const candidates = await getPreloadCandidates();
  
  return {
    totalItems: items.length,
    cachedItems: items.filter(i => i.cachedDocument).length,
    preloadCandidates: candidates.length,
  };
}
