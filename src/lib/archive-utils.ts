/**
 * Archive Utilities
 * 
 * Shared utilities for archive item operations including:
 * - Reading position comparison
 * - Archive item merging
 * - Progress comparison
 * 
 * Used by both recents-service.ts and sync/merge.ts.
 */

import type { ReadingPosition, ArchiveProgress, ArchiveItem } from '@/types';

// =============================================================================
// POSITION COMPARISON
// =============================================================================

/**
 * Check if position A is further in the document than position B.
 * Compares chapter index first (for books), then block index.
 * 
 * @param posA - First reading position
 * @param posB - Second reading position
 * @returns true if posA is further than posB
 */
export function isPositionFurther(
  posA: ReadingPosition | undefined,
  posB: ReadingPosition | undefined
): boolean {
  if (!posA) return false;
  if (!posB) return true;
  
  // For books, compare chapter index first
  const aChapter = posA.chapterIndex ?? 0;
  const bChapter = posB.chapterIndex ?? 0;
  
  if (aChapter > bChapter) return true;
  if (aChapter < bChapter) return false;
  
  // Same chapter (or no chapters) - compare block index
  return posA.blockIndex > posB.blockIndex;
}

/**
 * Get the further of two positions.
 * Uses "furthest progress wins" strategy.
 * If positions are equal, returns the one with newer timestamp.
 */
export function furtherPosition(
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

// =============================================================================
// PROGRESS COMPARISON
// =============================================================================

/**
 * Get the further of two progress values (higher percentage wins).
 * For archive items, we always want to show the furthest reading progress.
 */
export function furtherProgress(
  a: ArchiveProgress | undefined,
  b: ArchiveProgress | undefined
): ArchiveProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  
  const aProgress = a.percent ?? 0;
  const bProgress = b.percent ?? 0;
  
  return aProgress >= bProgress ? a : b;
}

// =============================================================================
// ARCHIVE ITEM MERGING
// =============================================================================

/**
 * Base type for items that can be merged.
 * Works with both ArchiveItem and SyncArchiveItem.
 */
interface MergeableItem {
  id: string;
  title: string;
  lastOpenedAt: number;
  createdAt: number;
  lastPosition?: ReadingPosition;
  progress?: ArchiveProgress;
  fileHash?: string;
  url?: string;
  pasteContent?: string;
}

/**
 * Merge two archive items, keeping the best data from each.
 * 
 * Strategy:
 * - Uses furthest reading position
 * - Uses highest progress percentage
 * - Prefers newer metadata (title, lastOpenedAt, etc.)
 * - Keeps the ID from the item with furthest progress (for continuity)
 * 
 * @param item1 - First item to merge
 * @param item2 - Second item to merge
 * @returns Merged item with best data from both
 */
export function mergeArchiveItemPair<T extends MergeableItem>(
  item1: T,
  item2: T
): T {
  // Determine which item has furthest progress
  const item1Further = isPositionFurther(item1.lastPosition, item2.lastPosition);
  const item2Further = isPositionFurther(item2.lastPosition, item1.lastPosition);
  
  // Also check percentage progress
  const item1Percent = item1.progress?.percent ?? 0;
  const item2Percent = item2.progress?.percent ?? 0;
  
  // The "primary" item is the one with more progress (we keep its ID)
  let primary: T;
  let secondary: T;
  
  if (item1Further || (!item2Further && item1Percent >= item2Percent)) {
    primary = item1;
    secondary = item2;
  } else {
    primary = item2;
    secondary = item1;
  }
  
  // Merge: use primary's ID and progress, but take newer metadata
  const newerMetadata = primary.lastOpenedAt >= secondary.lastOpenedAt ? primary : secondary;
  
  // Get the better position
  const mergedPosition = furtherPosition(primary.lastPosition, secondary.lastPosition);
  
  // Get the better progress
  const mergedProgress = furtherProgress(primary.progress, secondary.progress);
  
  return {
    ...newerMetadata,
    id: primary.id, // Keep the ID from the item with most progress
    createdAt: Math.min(primary.createdAt, secondary.createdAt), // Keep earliest creation
    lastPosition: mergedPosition,
    progress: mergedProgress,
    // Ensure we have fileHash and url if available
    fileHash: primary.fileHash || secondary.fileHash,
    url: primary.url || secondary.url,
    // Preserve cached data
    pasteContent: primary.pasteContent || secondary.pasteContent,
  };
}

/**
 * Merge two full ArchiveItems (includes cachedDocument handling).
 * Use this when merging local archive items that may have cached documents.
 */
export function mergeFullArchiveItems(
  item1: ArchiveItem,
  item2: ArchiveItem
): ArchiveItem {
  const merged = mergeArchiveItemPair(item1, item2);
  
  // Prefer the cached document that exists
  return {
    ...merged,
    cachedDocument: item1.cachedDocument || item2.cachedDocument,
  };
}

/**
 * Type guard to check if an item is a full ArchiveItem (has cachedDocument field).
 */
export function isFullArchiveItem(item: MergeableItem): item is ArchiveItem {
  return 'cachedDocument' in item;
}
