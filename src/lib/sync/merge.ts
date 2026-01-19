/**
 * Merge Module
 * 
 * Handles conflict resolution when merging local and remote sync states.
 * Uses "furthest progress wins" strategy for reading positions and progress,
 * and "last writer wins" for other settings.
 */

import type { ReadingPosition, Collection, Annotation, ReadingStats } from '@/types';
import { DEFAULT_READING_STATS } from '@/types';
import type { 
  SyncStateDocument, 
  SyncArchiveItem, 
  MergeResult, 
  ConflictInfo 
} from './types';
import { normalizeUrl } from '../url-utils';
import { 
  isPositionFurther, 
  furtherPosition, 
  furtherProgress,
  mergeArchiveItemPair as mergeArchiveItemPairBase,
} from '../archive-utils';


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
  
  // Merge collections
  const mergedCollections = mergeCollections(local.collections, remote.collections, remoteIsNewer);
  
  // Merge annotations
  const mergedAnnotations = mergeAnnotations(local.annotations, remote.annotations, remoteIsNewer);
  
  // Merge reading stats (sum totals, keep highest streaks, merge histories)
  const mergedReadingStats = mergeReadingStats(local.readingStats, remote.readingStats);
  
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
    
    // Merged data
    collections: mergedCollections,
    annotations: mergedAnnotations,
    presets: mergedPresets,
    customThemes: mergedThemes,
    archiveItems: mergedArchive,
    positions: mergedPositions,
    deletedItems: mergedDeletedItems,
    
    // Content manifest from remote (content sync will update this)
    contentManifest: remote.contentManifest || local.contentManifest,
    
    // Reading stats (merged from both devices)
    readingStats: mergedReadingStats,
    
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


interface ArchiveMergeResult {
  merged: SyncArchiveItem[];
  conflicts: ConflictInfo[];
}

/**
 * Normalize a URL for consistent comparison during deduplication.
 * Re-exported from url-utils for testing exports.
 */
// normalizeUrl imported from ../url-utils

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
  return mergeArchiveItemPairBase(item1, item2);
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


/**
 * Merge collections from local and remote.
 * Uses updatedAt to determine winner for conflicts.
 */
function mergeCollections(
  local: Collection[] | undefined,
  remote: Collection[] | undefined,
  remoteIsNewer: boolean
): Collection[] {
  const collectionMap = new Map<string, Collection>();
  
  // Add local collections
  for (const collection of (local ?? [])) {
    collectionMap.set(collection.id, collection);
  }
  
  // Merge remote collections
  for (const collection of (remote ?? [])) {
    const existing = collectionMap.get(collection.id);
    if (!existing) {
      collectionMap.set(collection.id, collection);
    } else {
      // Use updatedAt to determine winner, fall back to remoteIsNewer
      if (collection.updatedAt > existing.updatedAt || 
          (collection.updatedAt === existing.updatedAt && remoteIsNewer)) {
        collectionMap.set(collection.id, collection);
      }
    }
  }
  
  return Array.from(collectionMap.values());
}


/**
 * Merge annotations from local and remote.
 * Uses updatedAt to determine winner for conflicts.
 * Annotations are merged per-document, then per-annotation within each document.
 */
function mergeAnnotations(
  local: Record<string, Annotation[]> | undefined,
  remote: Record<string, Annotation[]> | undefined,
  remoteIsNewer: boolean
): Record<string, Annotation[]> {
  const localAnnotations = local ?? {};
  const remoteAnnotations = remote ?? {};
  const result: Record<string, Annotation[]> = {};
  
  // Get all document keys from both local and remote
  const allDocKeys = new Set([
    ...Object.keys(localAnnotations),
    ...Object.keys(remoteAnnotations),
  ]);
  
  for (const docKey of allDocKeys) {
    const localDocAnnotations = localAnnotations[docKey] ?? [];
    const remoteDocAnnotations = remoteAnnotations[docKey] ?? [];
    
    // Merge annotations for this document
    const annotationMap = new Map<string, Annotation>();
    
    // Add local annotations
    for (const annotation of localDocAnnotations) {
      annotationMap.set(annotation.id, annotation);
    }
    
    // Merge remote annotations
    for (const annotation of remoteDocAnnotations) {
      const existing = annotationMap.get(annotation.id);
      if (!existing) {
        annotationMap.set(annotation.id, annotation);
      } else {
        // Use updatedAt to determine winner, fall back to remoteIsNewer
        if (annotation.updatedAt > existing.updatedAt || 
            (annotation.updatedAt === existing.updatedAt && remoteIsNewer)) {
          annotationMap.set(annotation.id, annotation);
        }
      }
    }
    
    // Only add to result if there are annotations
    const mergedAnnotations = Array.from(annotationMap.values());
    if (mergedAnnotations.length > 0) {
      // Sort by createdAt for consistent ordering
      result[docKey] = mergedAnnotations.sort((a, b) => a.createdAt - b.createdAt);
    }
  }
  
  return result;
}


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


// Note: isPositionFurther, furtherPosition, and furtherProgress are imported from archive-utils.ts

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


/**
 * Merge reading statistics from local and remote.
 * Strategy:
 * - Totals: Take max values (they may overlap from same device syncing)
 * - Streaks: Keep the highest values
 * - Daily/Weekly stats: Merge by date, take max values for same dates
 * - WPM history: Merge by date, prefer higher session count
 * - Hourly activity: Take max values for same hours
 * - Personal bests: Keep highest records
 */
function mergeReadingStats(
  localStats: ReadingStats | undefined,
  remoteStats: ReadingStats | undefined
): ReadingStats {
  const local = localStats || DEFAULT_READING_STATS;
  const remote = remoteStats || DEFAULT_READING_STATS;
  
  // Merge daily stats (take max values for same dates to avoid double-counting)
  const mergedDailyStats: Record<string, typeof local.dailyStats[string]> = {};
  const allDates = new Set([...Object.keys(local.dailyStats), ...Object.keys(remote.dailyStats)]);
  for (const date of allDates) {
    const localDay = local.dailyStats[date];
    const remoteDay = remote.dailyStats[date];
    if (localDay && remoteDay) {
      // Merge same-date entries
      const mergedDocuments = new Set([...localDay.documentsOpened, ...remoteDay.documentsOpened]);
      const mergedCompleted = new Set([...localDay.documentsCompleted, ...remoteDay.documentsCompleted]);
      mergedDailyStats[date] = {
        date,
        readingTimeMs: Math.max(localDay.readingTimeMs, remoteDay.readingTimeMs),
        wordsRead: Math.max(localDay.wordsRead, remoteDay.wordsRead),
        documentsOpened: Array.from(mergedDocuments),
        documentsCompleted: Array.from(mergedCompleted),
        annotationsCreated: Math.max(localDay.annotationsCreated, remoteDay.annotationsCreated),
      };
    } else {
      mergedDailyStats[date] = localDay || remoteDay;
    }
  }
  
  // Merge weekly stats (take max values for same weeks)
  const mergedWeeklyStats: Record<string, typeof local.weeklyStats[string]> = {};
  const allWeeks = new Set([...Object.keys(local.weeklyStats), ...Object.keys(remote.weeklyStats)]);
  for (const weekStart of allWeeks) {
    const localWeek = local.weeklyStats[weekStart];
    const remoteWeek = remote.weeklyStats[weekStart];
    if (localWeek && remoteWeek) {
      mergedWeeklyStats[weekStart] = {
        weekStart,
        readingTimeMs: Math.max(localWeek.readingTimeMs, remoteWeek.readingTimeMs),
        wordsRead: Math.max(localWeek.wordsRead, remoteWeek.wordsRead),
        documentsCompleted: Math.max(localWeek.documentsCompleted, remoteWeek.documentsCompleted),
        annotationsCreated: Math.max(localWeek.annotationsCreated, remoteWeek.annotationsCreated),
        avgWpm: Math.round((localWeek.avgWpm + remoteWeek.avgWpm) / 2),
        sessionCount: Math.max(localWeek.sessionCount, remoteWeek.sessionCount),
        activeDays: Math.max(localWeek.activeDays, remoteWeek.activeDays),
      };
    } else {
      mergedWeeklyStats[weekStart] = localWeek || remoteWeek;
    }
  }
  
  // Merge WPM history (prefer entries with higher session count for same dates)
  const wpmByDate = new Map<string, typeof local.wpmHistory[number]>();
  for (const entry of [...local.wpmHistory, ...remote.wpmHistory]) {
    const existing = wpmByDate.get(entry.date);
    if (!existing || entry.sessionCount > existing.sessionCount) {
      wpmByDate.set(entry.date, entry);
    }
  }
  const mergedWpmHistory = Array.from(wpmByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Merge hourly activity (take max for each hour to avoid double-counting)
  const mergedHourlyActivity = Array.from({ length: 24 }, (_, hour) => {
    const localHour = local.hourlyActivity.find(h => h.hour === hour);
    const remoteHour = remote.hourlyActivity.find(h => h.hour === hour);
    return {
      hour,
      totalReadingTimeMs: Math.max(localHour?.totalReadingTimeMs || 0, remoteHour?.totalReadingTimeMs || 0),
      sessionCount: Math.max(localHour?.sessionCount || 0, remoteHour?.sessionCount || 0),
    };
  }).filter(h => h.totalReadingTimeMs > 0 || h.sessionCount > 0);
  
  // Merge personal bests (keep the best records)
  const mergedPersonalBests = {
    longestSession: pickBestSessionRecord(local.personalBests.longestSession, remote.personalBests.longestSession),
    mostWordsInDay: pickBestWordsRecord(local.personalBests.mostWordsInDay, remote.personalBests.mostWordsInDay),
    fastestWpm: pickBestWpmRecord(local.personalBests.fastestWpm, remote.personalBests.fastestWpm),
  };
  
  // Determine the most recent reading date
  const lastReadingDate = [local.lastReadingDate, remote.lastReadingDate]
    .filter(Boolean)
    .sort()
    .pop() || null;
  
  return {
    // Take max of totals to avoid double-counting from same device
    totalReadingTimeMs: Math.max(local.totalReadingTimeMs, remote.totalReadingTimeMs),
    totalWordsRead: Math.max(local.totalWordsRead, remote.totalWordsRead),
    totalDocumentsCompleted: Math.max(local.totalDocumentsCompleted, remote.totalDocumentsCompleted),
    totalAnnotationsCreated: Math.max(local.totalAnnotationsCreated, remote.totalAnnotationsCreated),
    
    // Streaks - keep the highest
    currentStreak: Math.max(local.currentStreak, remote.currentStreak),
    longestStreak: Math.max(local.longestStreak, remote.longestStreak),
    lastReadingDate,
    
    // Merged histories
    dailyStats: mergedDailyStats,
    weeklyStats: mergedWeeklyStats,
    wpmHistory: mergedWpmHistory,
    hourlyActivity: mergedHourlyActivity,
    personalBests: mergedPersonalBests,
    
    // Goals from the device with most recent reading
    goals: (local.lastReadingDate || '') >= (remote.lastReadingDate || '') ? local.goals : remote.goals,
  };
}

/**
 * Pick the better of two longest session records
 */
function pickBestSessionRecord(
  a: { date: string; durationMs: number } | null,
  b: { date: string; durationMs: number } | null
): { date: string; durationMs: number } | null {
  if (!a) return b;
  if (!b) return a;
  return a.durationMs >= b.durationMs ? a : b;
}

/**
 * Pick the better of two most words in day records
 */
function pickBestWordsRecord(
  a: { date: string; words: number } | null,
  b: { date: string; words: number } | null
): { date: string; words: number } | null {
  if (!a) return b;
  if (!b) return a;
  return a.words >= b.words ? a : b;
}

/**
 * Pick the better of two fastest WPM records
 */
function pickBestWpmRecord(
  a: { date: string; wpm: number } | null,
  b: { date: string; wpm: number } | null
): { date: string; wpm: number } | null {
  if (!a) return b;
  if (!b) return a;
  return a.wpm >= b.wpm ? a : b;
}


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
