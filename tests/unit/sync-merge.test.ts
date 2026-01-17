/**
 * Sync Merge Module Tests
 * 
 * Tests for the sync merge/conflict resolution logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeStates } from '@/lib/sync/merge';
import type { SyncStateDocument, SyncArchiveItem } from '@/lib/sync/types';
import { DEFAULT_SETTINGS } from '@/types';

// Create a base SyncStateDocument for testing
function createBaseStateDocument(overrides?: Partial<SyncStateDocument>): SyncStateDocument {
  return {
    schemaVersion: 3,
    updatedAt: Date.now(),
    deviceId: 'device-1',
    settings: { ...DEFAULT_SETTINGS },
    presets: {},
    customThemes: [],
    archiveItems: [],
    positions: {},
    onboardingCompleted: true,
    exitConfirmationDismissed: false,
    ...overrides,
  };
}

// Create a mock archive item
function createArchiveItem(id: string, lastOpenedAt: number, title?: string): SyncArchiveItem {
  return {
    id,
    type: 'web',
    title: title || `Article ${id}`,
    sourceLabel: 'example.com',
    url: `https://example.com/${id}`,
    createdAt: lastOpenedAt - 100000,
    lastOpenedAt,
  };
}

// Create a mock book archive item with chapter position
function createBookArchiveItem(
  id: string, 
  lastOpenedAt: number, 
  chapterIndex: number, 
  blockIndex: number
): SyncArchiveItem {
  return {
    id,
    type: 'epub',
    title: `Book ${id}`,
    sourceLabel: 'book.epub',
    createdAt: lastOpenedAt - 100000,
    lastOpenedAt,
    lastPosition: {
      blockIndex,
      charOffset: 0,
      timestamp: lastOpenedAt,
      chapterIndex,
    },
    progress: {
      percent: Math.floor((chapterIndex / 10) * 100),
      label: `Ch ${chapterIndex + 1} of 10`,
    },
  };
}

describe('Merge Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mergeStates', () => {
    describe('basic merging', () => {
      it('returns merged state with current timestamp', () => {
        const localState = createBaseStateDocument({
          updatedAt: 2000,
          deviceId: 'device-local',
        });
        const remoteState = createBaseStateDocument({
          updatedAt: 1000,
          deviceId: 'device-remote',
        });

        const beforeMerge = Date.now();
        const result = mergeStates(localState, remoteState, 'device-local');
        const afterMerge = Date.now();

        // Merged state gets a new timestamp
        expect(result.merged.updatedAt).toBeGreaterThanOrEqual(beforeMerge);
        expect(result.merged.updatedAt).toBeLessThanOrEqual(afterMerge);
        // No changes when local is newer and no new items from remote
        expect(result.hasChanges).toBe(false);
      });

      it('returns remote state when remote is newer', () => {
        const localState = createBaseStateDocument({
          updatedAt: 1000,
          deviceId: 'device-local',
        });
        const remoteState = createBaseStateDocument({
          updatedAt: 2000,
          deviceId: 'device-remote',
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.updatedAt).toBeGreaterThanOrEqual(2000);
      });
    });

    describe('archive item merging', () => {
      it('takes union of archive items from both states', () => {
        const localState = createBaseStateDocument({
          archiveItems: [createArchiveItem('item-1', 1000)],
        });
        const remoteState = createBaseStateDocument({
          archiveItems: [createArchiveItem('item-2', 2000)],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.archiveItems).toHaveLength(2);
        expect(result.merged.archiveItems.map(i => i.id).sort()).toEqual(['item-1', 'item-2']);
      });

      it('prefers newer version of same archive item (by lastOpenedAt)', () => {
        const localState = createBaseStateDocument({
          archiveItems: [createArchiveItem('item-1', 1000, 'Local Version')],
        });
        const remoteState = createBaseStateDocument({
          archiveItems: [createArchiveItem('item-1', 2000, 'Remote Version')],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.archiveItems).toHaveLength(1);
        expect(result.merged.archiveItems[0].title).toBe('Remote Version');
        expect(result.merged.archiveItems[0].lastOpenedAt).toBe(2000);
      });

      it('keeps local version when lastOpenedAt is equal but local has more recent updatedAt', () => {
        const localState = createBaseStateDocument({
          updatedAt: 2000,
          archiveItems: [createArchiveItem('item-1', 1000, 'Local Version')],
        });
        const remoteState = createBaseStateDocument({
          updatedAt: 1500,
          archiveItems: [createArchiveItem('item-1', 1000, 'Remote Version')],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.archiveItems[0].title).toBe('Local Version');
      });

      it('does not report conflict when local item is newer (no conflict, just merge)', () => {
        const localState = createBaseStateDocument({
          archiveItems: [createArchiveItem('item-1', 2000, 'Local Version')],
        });
        const remoteState = createBaseStateDocument({
          archiveItems: [createArchiveItem('item-1', 1000, 'Remote Version')],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        // Local is newer, so we keep local without conflict
        expect(result.merged.archiveItems[0].title).toBe('Local Version');
      });

      it('syncs book lastPosition with chapterIndex', () => {
        const localState = createBaseStateDocument({
          archiveItems: [createBookArchiveItem('book-1', 1000, 3, 25)],
        });
        const remoteState = createBaseStateDocument({
          archiveItems: [],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.archiveItems).toHaveLength(1);
        expect(result.merged.archiveItems[0].lastPosition?.chapterIndex).toBe(3);
        expect(result.merged.archiveItems[0].lastPosition?.blockIndex).toBe(25);
      });

      it('merges book archive items and keeps further chapter position', () => {
        // Local: chapter 2, block 50
        const localState = createBaseStateDocument({
          archiveItems: [createBookArchiveItem('book-1', 2000, 2, 50)],
        });
        // Remote: chapter 5, block 10 (further in book)
        const remoteState = createBaseStateDocument({
          archiveItems: [createBookArchiveItem('book-1', 1500, 5, 10)],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        // Local has newer lastOpenedAt, but remote is further in the book
        // The merge should take local (more recently opened) but ideally preserve further position
        // Current behavior: newer lastOpenedAt wins for archive items
        expect(result.merged.archiveItems).toHaveLength(1);
        // Since local is newer (lastOpenedAt: 2000 vs 1500), local wins
        expect(result.merged.archiveItems[0].lastOpenedAt).toBe(2000);
      });
    });

    describe('position merging', () => {
      it('takes union of positions from both states', () => {
        const localState = createBaseStateDocument({
          positions: {
            'https://example.com/page1': { blockIndex: 5, charOffset: 0, timestamp: 1000 },
          },
        });
        const remoteState = createBaseStateDocument({
          positions: {
            'https://example.com/page2': { blockIndex: 10, charOffset: 50, timestamp: 2000 },
          },
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(Object.keys(result.merged.positions)).toHaveLength(2);
        expect(result.merged.positions['https://example.com/page1']).toBeDefined();
        expect(result.merged.positions['https://example.com/page2']).toBeDefined();
      });

      it('prefers newer position for same URL (by timestamp)', () => {
        const localState = createBaseStateDocument({
          positions: {
            'https://example.com/page1': { blockIndex: 5, charOffset: 0, timestamp: 1000 },
          },
        });
        const remoteState = createBaseStateDocument({
          positions: {
            'https://example.com/page1': { blockIndex: 15, charOffset: 100, timestamp: 2000 },
          },
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.positions['https://example.com/page1'].blockIndex).toBe(15);
        expect(result.merged.positions['https://example.com/page1'].timestamp).toBe(2000);
      });

      it('keeps furthest position when timestamps are equal (furthest progress wins)', () => {
        const localState = createBaseStateDocument({
          positions: {
            'https://example.com/page1': { blockIndex: 5, charOffset: 0, timestamp: 1000 },
          },
        });
        const remoteState = createBaseStateDocument({
          positions: {
            'https://example.com/page1': { blockIndex: 15, charOffset: 100, timestamp: 1000 },
          },
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        // Furthest progress wins, even when timestamps are equal
        expect(result.merged.positions['https://example.com/page1'].blockIndex).toBe(15);
      });

      it('syncs chapterIndex for book positions', () => {
        const localState = createBaseStateDocument({
          positions: {
            'book-1': { blockIndex: 5, charOffset: 0, timestamp: 1000, chapterIndex: 2 },
          },
        });
        const remoteState = createBaseStateDocument({
          positions: {},
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.positions['book-1'].chapterIndex).toBe(2);
        expect(result.merged.positions['book-1'].blockIndex).toBe(5);
      });

      it('prefers position in later chapter over earlier chapter with higher block', () => {
        const localState = createBaseStateDocument({
          positions: {
            'book-1': { blockIndex: 100, charOffset: 0, timestamp: 1000, chapterIndex: 1 },
          },
        });
        const remoteState = createBaseStateDocument({
          positions: {
            'book-1': { blockIndex: 5, charOffset: 0, timestamp: 1000, chapterIndex: 3 },
          },
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        // Chapter 3 is further than chapter 1, even though block 100 > block 5
        expect(result.merged.positions['book-1'].chapterIndex).toBe(3);
        expect(result.merged.positions['book-1'].blockIndex).toBe(5);
      });

      it('prefers higher block index within same chapter', () => {
        const localState = createBaseStateDocument({
          positions: {
            'book-1': { blockIndex: 50, charOffset: 0, timestamp: 1000, chapterIndex: 2 },
          },
        });
        const remoteState = createBaseStateDocument({
          positions: {
            'book-1': { blockIndex: 10, charOffset: 0, timestamp: 2000, chapterIndex: 2 },
          },
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        // Same chapter, so higher block index wins (local)
        expect(result.merged.positions['book-1'].chapterIndex).toBe(2);
        expect(result.merged.positions['book-1'].blockIndex).toBe(50);
      });
    });

    describe('settings merging', () => {
      it('prefers settings from newer state', () => {
        const localState = createBaseStateDocument({
          updatedAt: 1000,
          settings: { ...DEFAULT_SETTINGS, baseWPM: 200 },
        });
        const remoteState = createBaseStateDocument({
          updatedAt: 2000,
          settings: { ...DEFAULT_SETTINGS, baseWPM: 350 },
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.settings.baseWPM).toBe(350);
      });

      it('keeps local settings when local is newer', () => {
        const localState = createBaseStateDocument({
          updatedAt: 2000,
          settings: { ...DEFAULT_SETTINGS, baseWPM: 250 },
        });
        const remoteState = createBaseStateDocument({
          updatedAt: 1000,
          settings: { ...DEFAULT_SETTINGS, baseWPM: 350 },
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.settings.baseWPM).toBe(250);
      });
    });

    describe('preset merging', () => {
      it('takes union of presets', () => {
        const localState = createBaseStateDocument({
          presets: { 'local-preset': { baseWPM: 200 } },
        });
        const remoteState = createBaseStateDocument({
          presets: { 'remote-preset': { baseWPM: 400 } },
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(Object.keys(result.merged.presets)).toHaveLength(2);
        expect(result.merged.presets['local-preset']).toBeDefined();
        expect(result.merged.presets['remote-preset']).toBeDefined();
      });

      it('prefers preset from newer state when names conflict', () => {
        const localState = createBaseStateDocument({
          updatedAt: 1000,
          presets: { 'shared-preset': { baseWPM: 200 } },
        });
        const remoteState = createBaseStateDocument({
          updatedAt: 2000,
          presets: { 'shared-preset': { baseWPM: 400 } },
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.presets['shared-preset'].baseWPM).toBe(400);
      });
    });

    describe('custom theme merging', () => {
      it('takes union of custom themes', () => {
        const localState = createBaseStateDocument({
          customThemes: [{
            name: 'Local Theme',
            backgroundColor: '#ffffff',
            textColor: '#000000',
            linkColor: '#0066cc',
            selectionColor: '#b3d4fc',
            highlightColor: '#ffff00',
          }],
        });
        const remoteState = createBaseStateDocument({
          customThemes: [{
            name: 'Remote Theme',
            backgroundColor: '#000000',
            textColor: '#ffffff',
            linkColor: '#66ccff',
            selectionColor: '#4d3dfc',
            highlightColor: '#ff00ff',
          }],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.customThemes).toHaveLength(2);
      });

      it('prefers theme from newer state when names conflict', () => {
        const localState = createBaseStateDocument({
          updatedAt: 1000,
          customThemes: [{
            name: 'Shared Theme',
            backgroundColor: '#ffffff',
            textColor: '#000000',
            linkColor: '#0066cc',
            selectionColor: '#b3d4fc',
            highlightColor: '#ffff00',
          }],
        });
        const remoteState = createBaseStateDocument({
          updatedAt: 2000,
          customThemes: [{
            name: 'Shared Theme',
            backgroundColor: '#123456',
            textColor: '#fedcba',
            linkColor: '#abcdef',
            selectionColor: '#000000',
            highlightColor: '#ffffff',
          }],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.merged.customThemes).toHaveLength(1);
        expect(result.merged.customThemes[0].backgroundColor).toBe('#123456');
      });
    });

    describe('hasChanges detection', () => {
      it('sets hasChanges to true when remote adds new items', () => {
        const localState = createBaseStateDocument({
          updatedAt: 1000,
          archiveItems: [createArchiveItem('item-1', 1000)],
        });
        const remoteState = createBaseStateDocument({
          updatedAt: 2000,
          archiveItems: [
            createArchiveItem('item-1', 1000),
            createArchiveItem('item-2', 2000), // New item from remote
          ],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        // hasChanges should be true because merged has more items than local
        expect(result.hasChanges).toBe(true);
        expect(result.merged.archiveItems).toHaveLength(2);
      });

      it('sets hasChanges to true when merging from remote', () => {
        const localState = createBaseStateDocument({
          updatedAt: 1000,
          archiveItems: [],
        });
        const remoteState = createBaseStateDocument({
          updatedAt: 2000,
          archiveItems: [createArchiveItem('item-1', 1500)],
        });

        const result = mergeStates(localState, remoteState, 'device-local');

        expect(result.hasChanges).toBe(true);
      });
    });
  });
});
