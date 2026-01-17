/**
 * Merge Module
 * 
 * Handles conflict resolution when merging local and remote sync states.
 * Uses "furthest progress wins" strategy for reading positions and progress,
 * and "last writer wins" for other settings.
 */

import type { ReadingPosition, ArchiveProgress } from '@/types';
import type { 
  SyncStateDocument, 
  SyncArchiveItem, 
  MergeResult, 
  ConflictInfo 
} from './types';

// =============================================================================
// MAIN MERGE FUNCTION
// =============================================================================

/**
 * Merge local and remote sync states.
 * 
 * Strategy:
 * - Settings: last writer wins (based on updatedAt)
 * - Archive items: union by ID, prefer newest lastOpenedAt per item
 * - Positions: merge by document key, prefer newest timestamp
 * - Presets: union by name, prefer newest updatedAt
 * - Themes: union by name, prefer remote on conflict
 * - Deleted items: union of tombstones, items with tombstones are excluded
 */
export function mergeStates(
  local: SyncStateDocument,
  remote: SyncStateDocument,
  localDeviceId: string
): MergeResult {
  const conflicts: ConflictInfo[] = [];
  
  // Determine the winner based on updatedAt
  const remoteIsNewer = remote.updatedAt > local.updatedAt;
  const winner = remoteIsNewer ? remote : local;
  
  // Log merge direction in dev mode
  if (import.meta.env.DEV) {
    console.log(`FlowReader Sync: Merging states. Remote is ${remoteIsNewer ? 'newer' : 'older'}.`);
    console.log(`  Local: ${local.deviceId} @ ${new Date(local.updatedAt).toISOString()}`);
    console.log(`  Remote: ${remote.deviceId} @ ${new Date(remote.updatedAt).toISOString()}`);
  }
  
  // Check for settings conflicts
  if (!settingsEqual(local.settings, remote.settings)) {
    conflicts.push({
      type: 'settings',
      localValue: local.settings,
      remoteValue: remote.settings,
      resolution: remoteIsNewer ? 'remote-wins' : 'local-wins',
    });
  }
  
  // Merge deleted items tombstones (take the union, keeping the newest timestamp for each)
  const mergedDeletedItems = mergeDeletedItems(
    local.deletedItems || {},
    remote.deletedItems || {}
  );
  
  // Merge archive items (passing deleted items to filter them out)
  const { merged: mergedArchive, conflicts: archiveConflicts } = mergeArchiveItems(
    local.archiveItems,
    remote.archiveItems,
    mergedDeletedItems
  );
  conflicts.push(...archiveConflicts);
  
  // Merge positions
  const { merged: mergedPositions, conflicts: positionConflicts } = mergePositions(
    local.positions,
    remote.positions
  );
  conflicts.push(...positionConflicts);
  
  // Merge presets (union, remote wins on conflict)
  const mergedPresets = { ...local.presets, ...remote.presets };
  
  // Merge custom themes (union by name, remote wins on conflict)
  const mergedThemes = mergeCustomThemes(local.customThemes, remote.customThemes);
  
  // Determine if there were actual changes
  const hasChanges = conflicts.length > 0 || 
    mergedArchive.length !== local.archiveItems.length ||
    Object.keys(mergedPositions).length !== Object.keys(local.positions).length;
  
  const merged: SyncStateDocument = {
    schemaVersion: Math.max(local.schemaVersion, remote.schemaVersion),
    updatedAt: Date.now(),
    deviceId: localDeviceId,
    
    // Settings from winner
    settings: winner.settings,
    
    // Merged collections
    presets: mergedPresets,
    customThemes: mergedThemes,
    archiveItems: mergedArchive,
    positions: mergedPositions,
    deletedItems: mergedDeletedItems,
    
    // Content manifest from remote (content sync will update this)
    contentManifest: remote.contentManifest || local.contentManifest,
    
    // Flags from winner
    onboardingCompleted: winner.onboardingCompleted,
    exitConfirmationDismissed: winner.exitConfirmationDismissed,
  };
  
  // Log conflicts in dev mode
  if (import.meta.env.DEV && conflicts.length > 0) {
    console.log(`FlowReader Sync: ${conflicts.length} conflicts resolved:`, conflicts);
  }
  
  return { merged, conflicts, hasChanges };
}

// =============================================================================
// DELETED ITEMS MERGE
// =============================================================================

/**
 * Merge deleted items tombstones from local and remote.
 * Takes the union, keeping the newest timestamp for each item.
 */
function mergeDeletedItems(
  local: Record<string, number>,
  remote: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...local };
  
  for (const [key, remoteTimestamp] of Object.entries(remote)) {
    const localTimestamp = merged[key];
    // Keep the newest deletion timestamp
    if (!localTimestamp || remoteTimestamp > localTimestamp) {
      merged[key] = remoteTimestamp;
    }
  }
  
  return merged;
}

/**
 * Check if an item should be excluded because it was deleted.
 * Checks by ID, fileHash, and normalized URL.
 */
function isItemDeleted(
  item: SyncArchiveItem,
  deletedItems: Record<string, number>
): boolean {
  // Check by ID
  if (deletedItems[item.id]) {
    return true;
  }
  
  // Check by fileHash
  if (item.fileHash && deletedItems[`hash:${item.fileHash}`]) {
    return true;
  }
  
  // Check by normalized URL
  if (item.url) {
    const normalizedItemUrl = normalizeUrl(item.url);
    if (deletedItems[`url:${normalizedItemUrl}`]) {
      return true;
    }
  }
  
  return false;
}

// =============================================================================
// ARCHIVE ITEMS MERGE
// =============================================================================

interface ArchiveMergeResult {
  merged: SyncArchiveItem[];
  conflicts: ConflictInfo[];
}

/**
 * Normalize a URL for consistent comparison during deduplication
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    // Remove tracking parameters
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref']
      .forEach(param => parsed.searchParams.delete(param));
    parsed.searchParams.sort();
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Merge two archive items, keeping the best data from each.
 * - Uses furthest reading position
 * - Uses highest progress percentage
 * - Prefers newer metadata (title, lastOpenedAt, etc.)
 * - Keeps the ID from the item with furthest progress (for continuity)
 */
function mergeArchiveItemPair(
  item1: SyncArchiveItem,
  item2: SyncArchiveItem
): SyncArchiveItem {
  // Determine which item has furthest progress
  // Handle undefined positions: an item with a position is further than one without
  const item1Further = item1.lastPosition && item2.lastPosition 
    ? isPositionFurther(item1.lastPosition, item2.lastPosition)
    : !!item1.lastPosition && !item2.lastPosition;
  const item2Further = item1.lastPosition && item2.lastPosition 
    ? isPositionFurther(item2.lastPosition, item1.lastPosition)
    : !!item2.lastPosition && !item1.lastPosition;
  
  // Also check percentage progress
  const item1Percent = item1.progress?.percent ?? 0;
  const item2Percent = item2.progress?.percent ?? 0;
  
  // The "primary" item is the one with more progress (we keep its ID)
  let primary: SyncArchiveItem;
  let secondary: SyncArchiveItem;
  
  if (item1Further || (!item2Further && item1Percent >= item2Percent)) {
    primary = item1;
    secondary = item2;
  } else {
    primary = item2;
    secondary = item1;
  }
  
  // Merge: use primary's ID and progress, but take newer metadata
  const newerMetadata = primary.lastOpenedAt >= secondary.lastOpenedAt ? primary : secondary;
  
  return {
    ...newerMetadata,
    id: primary.id, // Keep the ID from the item with most progress
    createdAt: Math.min(primary.createdAt, secondary.createdAt), // Keep earliest creation
    lastPosition: furtherPosition(primary.lastPosition, secondary.lastPosition),
    progress: furtherProgress(primary.progress, secondary.progress),
    // Ensure we have fileHash and url if available
    fileHash: primary.fileHash || secondary.fileHash,
    url: primary.url || secondary.url,
  };
}

/**
 * Merge archive items with deduplication.
 * - First, deduplicate by fileHash (for files) and normalized URL (for web content)
 * - Then, merge by ID for items that don't match by content
 * - Use "furthest progress wins" for reading position
 * - Prefer newer lastOpenedAt for other metadata
 * - Filter out items that have been deleted (have tombstones)
 */
function mergeArchiveItems(
  local: SyncArchiveItem[],
  remote: SyncArchiveItem[],
  deletedItems: Record<string, number>
): ArchiveMergeResult {
  const conflicts: ConflictInfo[] = [];
  
  // Combine all items for deduplication
  const allItems = [...local, ...remote];
  
  // Build indexes for deduplication
  const byFileHash = new Map<string, SyncArchiveItem[]>();
  const byNormalizedUrl = new Map<string, SyncArchiveItem[]>();
  
  for (const item of allItems) {
    // Index by fileHash (most reliable for files)
    if (item.fileHash) {
      const existing = byFileHash.get(item.fileHash) || [];
      existing.push(item);
      byFileHash.set(item.fileHash, existing);
    }
    
    // Index by normalized URL (for web content)
    if (item.url) {
      const normalizedItemUrl = normalizeUrl(item.url);
      const existing = byNormalizedUrl.get(normalizedItemUrl) || [];
      existing.push(item);
      byNormalizedUrl.set(normalizedItemUrl, existing);
    }
  }
  
  // Track which items have been merged (to avoid double-processing)
  const processedIds = new Set<string>();
  const merged = new Map<string, SyncArchiveItem>();
  
  // First pass: merge items by fileHash
  for (const [fileHash, items] of byFileHash) {
    if (items.length === 1) {
      // No duplicates for this hash
      if (!processedIds.has(items[0].id)) {
        merged.set(items[0].id, items[0]);
        processedIds.add(items[0].id);
      }
    } else {
      // Multiple items with same fileHash - merge them
      let mergedItem = items[0];
      for (let i = 1; i < items.length; i++) {
        const oldMergedId = mergedItem.id;
        mergedItem = mergeArchiveItemPair(mergedItem, items[i]);
        
        // Log deduplication
        if (import.meta.env.DEV) {
          console.log(`FlowReader Sync: Deduplicating by fileHash:`, fileHash.slice(0, 8));
          console.log(`  Merged: "${items[i].title}" (${items[i].id}) into "${mergedItem.title}" (${mergedItem.id})`);
        }
        
        // Mark all involved IDs as processed
        processedIds.add(items[i].id);
        processedIds.add(oldMergedId);
      }
      
      // Remove any previously merged item with old ID and add the new merged one
      for (const item of items) {
        merged.delete(item.id);
      }
      merged.set(mergedItem.id, mergedItem);
      processedIds.add(mergedItem.id);
    }
  }
  
  // Second pass: merge items by normalized URL (if not already processed by fileHash)
  for (const [normalizedItemUrl, items] of byNormalizedUrl) {
    // Filter to only items not already processed
    const unprocessedItems = items.filter(item => !processedIds.has(item.id));
    
    if (unprocessedItems.length === 0) {
      continue;
    } else if (unprocessedItems.length === 1) {
      // No duplicates for this URL
      merged.set(unprocessedItems[0].id, unprocessedItems[0]);
      processedIds.add(unprocessedItems[0].id);
    } else {
      // Multiple items with same URL - merge them
      let mergedItem = unprocessedItems[0];
      for (let i = 1; i < unprocessedItems.length; i++) {
        const oldMergedId = mergedItem.id;
        mergedItem = mergeArchiveItemPair(mergedItem, unprocessedItems[i]);
        
        // Log deduplication
        if (import.meta.env.DEV) {
          console.log(`FlowReader Sync: Deduplicating by URL:`, normalizedItemUrl.slice(0, 50));
          console.log(`  Merged: "${unprocessedItems[i].title}" (${unprocessedItems[i].id}) into "${mergedItem.title}" (${mergedItem.id})`);
        }
        
        processedIds.add(unprocessedItems[i].id);
        processedIds.add(oldMergedId);
      }
      
      // Remove any previously merged items and add the new merged one
      for (const item of unprocessedItems) {
        merged.delete(item.id);
      }
      merged.set(mergedItem.id, mergedItem);
      processedIds.add(mergedItem.id);
    }
  }
  
  // Third pass: add any remaining items that weren't matched by fileHash or URL
  for (const item of allItems) {
    if (!processedIds.has(item.id)) {
      // Check if an item with same ID already exists
      const existingItem = merged.get(item.id);
      
      if (!existingItem) {
        merged.set(item.id, item);
      } else {
        // Same ID exists - merge them
        const remoteIsNewer = item.lastOpenedAt > existingItem.lastOpenedAt;
        const mergedPosition = furtherPosition(existingItem.lastPosition, item.lastPosition);
        const mergedProgress = furtherProgress(existingItem.progress, item.progress);
        
        if (remoteIsNewer) {
          merged.set(item.id, {
            ...item,
            lastPosition: mergedPosition,
            progress: mergedProgress,
          });
          
          if (!archiveItemsEqual(existingItem, item)) {
            conflicts.push({
              type: 'archive-item',
              itemId: item.id,
              localValue: existingItem,
              remoteValue: item,
              resolution: 'remote-wins',
            });
          }
        } else {
          merged.set(item.id, {
            ...existingItem,
            lastPosition: mergedPosition,
            progress: mergedProgress,
          });
        }
      }
      
      processedIds.add(item.id);
    }
  }
  
  // Filter out deleted items and sort by lastOpenedAt descending
  const sortedMerged = Array.from(merged.values())
    .filter(item => !isItemDeleted(item, deletedItems))
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  
  // Log deleted items filtering in dev mode
  const filteredCount = merged.size - sortedMerged.length;
  if (import.meta.env.DEV && filteredCount > 0) {
    console.log(`FlowReader Sync: Filtered out ${filteredCount} deleted item(s)`);
  }
  
  return { merged: sortedMerged, conflicts };
}

// =============================================================================
// POSITIONS MERGE
// =============================================================================

interface PositionsMergeResult {
  merged: Record<string, ReadingPosition>;
  conflicts: ConflictInfo[];
}

/**
 * Merge reading positions by document key.
 * Uses "furthest progress wins" strategy - the position that's further in the document wins.
 * This ensures reading progress is never lost when syncing across devices.
 */
function mergePositions(
  local: Record<string, ReadingPosition>,
  remote: Record<string, ReadingPosition>
): PositionsMergeResult {
  const conflicts: ConflictInfo[] = [];
  const merged: Record<string, ReadingPosition> = { ...local };
  
  for (const [key, remotePos] of Object.entries(remote)) {
    const localPos = merged[key];
    
    if (!localPos) {
      // New position from remote
      merged[key] = remotePos;
    } else {
      // Position exists in both - prefer furthest progress
      const remoteFurther = isPositionFurther(remotePos, localPos);
      const localFurther = isPositionFurther(localPos, remotePos);
      
      if (remoteFurther) {
        merged[key] = remotePos;
        
        if (!positionsEqual(localPos, remotePos)) {
          conflicts.push({
            type: 'position',
            itemId: key,
            localValue: localPos,
            remoteValue: remotePos,
            resolution: 'remote-wins',
          });
        }
      } else if (!localFurther && remotePos.timestamp > localPos.timestamp) {
        // If positions are equal, fall back to timestamp
        merged[key] = remotePos;
      }
      // else: local is further or same position with newer local timestamp, keep local
    }
  }
  
  return { merged, conflicts };
}

// =============================================================================
// CUSTOM THEMES MERGE
// =============================================================================

/**
 * Merge custom themes by name.
 * Remote wins on name conflict.
 */
function mergeCustomThemes(
  local: SyncStateDocument['customThemes'],
  remote: SyncStateDocument['customThemes']
): SyncStateDocument['customThemes'] {
  const themeMap = new Map<string, typeof local[0]>();
  
  // Add local themes
  for (const theme of local) {
    themeMap.set(theme.name, theme);
  }
  
  // Merge remote themes (overwrite on conflict)
  for (const theme of remote) {
    themeMap.set(theme.name, theme);
  }
  
  return Array.from(themeMap.values());
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if position A is further in the document than position B.
 * Compares chapter index first (for books), then block index.
 */
function isPositionFurther(a: ReadingPosition, b: ReadingPosition): boolean {
  // For books, compare chapter index first
  const aChapter = a.chapterIndex ?? 0;
  const bChapter = b.chapterIndex ?? 0;
  
  if (aChapter > bChapter) return true;
  if (aChapter < bChapter) return false;
  
  // Same chapter (or no chapters) - compare block index
  return a.blockIndex > b.blockIndex;
}

/**
 * Get the further of two positions (for archive item last position)
 * Uses furthest progress wins strategy
 */
function furtherPosition(
  a: ReadingPosition | undefined,
  b: ReadingPosition | undefined
): ReadingPosition | undefined {
  if (!a) return b;
  if (!b) return a;
  
  if (isPositionFurther(a, b)) return a;
  if (isPositionFurther(b, a)) return b;
  
  // Same position - return the one with newer timestamp
  return a.timestamp > b.timestamp ? a : b;
}

/**
 * Get the further of two progress values (higher percentage wins)
 * For archive items, we always want to show the furthest reading progress
 */
function furtherProgress(
  a: ArchiveProgress | undefined,
  b: ArchiveProgress | undefined
): ArchiveProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  
  // Compare overall progress percentage
  const aProgress = a.percent ?? 0;
  const bProgress = b.percent ?? 0;
  
  return aProgress >= bProgress ? a : b;
}

/**
 * Get the newer of two positions based on timestamp
 * @deprecated Use furtherPosition for merge operations
 */
function newerPosition(
  a: ReadingPosition | undefined,
  b: ReadingPosition | undefined
): ReadingPosition | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.timestamp > b.timestamp ? a : b;
}

/**
 * Compare two settings objects for equality
 */
function settingsEqual(a: SyncStateDocument['settings'], b: SyncStateDocument['settings']): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compare two archive items for equality (ignoring lastOpenedAt)
 */
function archiveItemsEqual(a: SyncArchiveItem, b: SyncArchiveItem): boolean {
  // Compare relevant fields, ignoring volatile ones
  return a.title === b.title &&
    a.author === b.author &&
    a.type === b.type &&
    a.sourceLabel === b.sourceLabel;
}

/**
 * Compare two positions for equality
 */
function positionsEqual(a: ReadingPosition, b: ReadingPosition): boolean {
  return a.blockIndex === b.blockIndex &&
    a.charOffset === b.charOffset &&
    a.chapterIndex === b.chapterIndex;
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export const _testing = {
  mergeArchiveItems,
  mergePositions,
  mergeCustomThemes,
  newerPosition,
  furtherPosition,
  furtherProgress,
  isPositionFurther,
  settingsEqual,
  archiveItemsEqual,
  positionsEqual,
};
