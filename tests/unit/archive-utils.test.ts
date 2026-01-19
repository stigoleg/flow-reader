import { describe, it, expect } from 'vitest';
import {
  isPositionFurther,
  furtherPosition,
  furtherProgress,
  mergeArchiveItemPair,
  mergeFullArchiveItems,
} from '@/lib/archive-utils';
import type { ReadingPosition, ArchiveProgress, ArchiveItem } from '@/types';

describe('Archive Utils', () => {
  describe('isPositionFurther', () => {
    it('returns false if first position is undefined', () => {
      const posB: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000 };
      expect(isPositionFurther(undefined, posB)).toBe(false);
    });

    it('returns true if second position is undefined', () => {
      const posA: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000 };
      expect(isPositionFurther(posA, undefined)).toBe(true);
    });

    it('returns false if both positions are undefined', () => {
      expect(isPositionFurther(undefined, undefined)).toBe(false);
    });

    it('compares block indices when no chapters', () => {
      const posA: ReadingPosition = { blockIndex: 10, charOffset: 0, timestamp: 1000 };
      const posB: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000 };
      expect(isPositionFurther(posA, posB)).toBe(true);
      expect(isPositionFurther(posB, posA)).toBe(false);
    });

    it('returns false for equal positions', () => {
      const posA: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000 };
      const posB: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 2000 };
      expect(isPositionFurther(posA, posB)).toBe(false);
      expect(isPositionFurther(posB, posA)).toBe(false);
    });

    it('compares chapter indices first for books', () => {
      const posA: ReadingPosition = { blockIndex: 0, charOffset: 0, timestamp: 1000, chapterIndex: 3 };
      const posB: ReadingPosition = { blockIndex: 100, charOffset: 0, timestamp: 1000, chapterIndex: 1 };
      expect(isPositionFurther(posA, posB)).toBe(true);
    });

    it('compares block indices within same chapter', () => {
      const posA: ReadingPosition = { blockIndex: 20, charOffset: 0, timestamp: 1000, chapterIndex: 2 };
      const posB: ReadingPosition = { blockIndex: 10, charOffset: 0, timestamp: 1000, chapterIndex: 2 };
      expect(isPositionFurther(posA, posB)).toBe(true);
      expect(isPositionFurther(posB, posA)).toBe(false);
    });

    it('treats missing chapterIndex as 0', () => {
      const posA: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000 };
      const posB: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000, chapterIndex: 0 };
      expect(isPositionFurther(posA, posB)).toBe(false);
      expect(isPositionFurther(posB, posA)).toBe(false);
    });
  });

  describe('furtherPosition', () => {
    it('returns second if first is undefined', () => {
      const posB: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000 };
      expect(furtherPosition(undefined, posB)).toBe(posB);
    });

    it('returns first if second is undefined', () => {
      const posA: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000 };
      expect(furtherPosition(posA, undefined)).toBe(posA);
    });

    it('returns undefined if both are undefined', () => {
      expect(furtherPosition(undefined, undefined)).toBeUndefined();
    });

    it('returns the further position', () => {
      const posA: ReadingPosition = { blockIndex: 10, charOffset: 0, timestamp: 1000 };
      const posB: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000 };
      expect(furtherPosition(posA, posB)).toBe(posA);
      expect(furtherPosition(posB, posA)).toBe(posA);
    });

    it('returns newer timestamp when positions are equal', () => {
      const posA: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 1000 };
      const posB: ReadingPosition = { blockIndex: 5, charOffset: 0, timestamp: 2000 };
      expect(furtherPosition(posA, posB)).toBe(posB);
      expect(furtherPosition(posB, posA)).toBe(posB);
    });
  });

  describe('furtherProgress', () => {
    it('returns second if first is undefined', () => {
      const progressB: ArchiveProgress = { percent: 50, label: '50%' };
      expect(furtherProgress(undefined, progressB)).toBe(progressB);
    });

    it('returns first if second is undefined', () => {
      const progressA: ArchiveProgress = { percent: 50, label: '50%' };
      expect(furtherProgress(progressA, undefined)).toBe(progressA);
    });

    it('returns undefined if both are undefined', () => {
      expect(furtherProgress(undefined, undefined)).toBeUndefined();
    });

    it('returns higher percentage progress', () => {
      const progressA: ArchiveProgress = { percent: 75, label: '75%' };
      const progressB: ArchiveProgress = { percent: 50, label: '50%' };
      expect(furtherProgress(progressA, progressB)).toBe(progressA);
      expect(furtherProgress(progressB, progressA)).toBe(progressA);
    });

    it('returns first when percentages are equal', () => {
      const progressA: ArchiveProgress = { percent: 50, label: 'Ch 1' };
      const progressB: ArchiveProgress = { percent: 50, label: 'Ch 2' };
      expect(furtherProgress(progressA, progressB)).toBe(progressA);
    });

    it('treats undefined percent as 0', () => {
      const progressA: ArchiveProgress = { percent: undefined as unknown as number, label: '?' };
      const progressB: ArchiveProgress = { percent: 10, label: '10%' };
      expect(furtherProgress(progressA, progressB)).toBe(progressB);
    });
  });

  describe('mergeArchiveItemPair', () => {
    const baseItem1 = {
      id: 'item-1',
      type: 'web' as const,
      title: 'Item 1',
      sourceLabel: 'example.com',
      lastOpenedAt: 1000,
      createdAt: 500,
    };

    const baseItem2 = {
      id: 'item-2',
      type: 'web' as const,
      title: 'Item 2 Updated',
      sourceLabel: 'example.com',
      lastOpenedAt: 2000,
      createdAt: 600,
    };

    it('keeps ID from item with further position', () => {
      const item1 = {
        ...baseItem1,
        lastPosition: { blockIndex: 10, charOffset: 0, timestamp: 1000 } as ReadingPosition,
      };
      const item2 = {
        ...baseItem2,
        lastPosition: { blockIndex: 5, charOffset: 0, timestamp: 1000 } as ReadingPosition,
      };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.id).toBe('item-1');
    });

    it('uses newer metadata when item1 has further position', () => {
      const item1 = {
        ...baseItem1,
        lastOpenedAt: 1000,
        lastPosition: { blockIndex: 10, charOffset: 0, timestamp: 1000 } as ReadingPosition,
      };
      const item2 = {
        ...baseItem2,
        lastOpenedAt: 2000,
        lastPosition: { blockIndex: 5, charOffset: 0, timestamp: 1000 } as ReadingPosition,
      };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.title).toBe('Item 2 Updated'); // From newer item
      expect(merged.id).toBe('item-1'); // From further position item
    });

    it('keeps earliest createdAt', () => {
      const item1 = { ...baseItem1, createdAt: 500 };
      const item2 = { ...baseItem2, createdAt: 600 };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.createdAt).toBe(500);
    });

    it('merges position to furthest', () => {
      const item1 = {
        ...baseItem1,
        lastPosition: { blockIndex: 10, charOffset: 0, timestamp: 1000 } as ReadingPosition,
      };
      const item2 = {
        ...baseItem2,
        lastPosition: { blockIndex: 15, charOffset: 0, timestamp: 1000 } as ReadingPosition,
      };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.lastPosition?.blockIndex).toBe(15);
    });

    it('merges progress to highest', () => {
      const item1 = {
        ...baseItem1,
        progress: { percent: 30, label: '30%' } as ArchiveProgress,
      };
      const item2 = {
        ...baseItem2,
        progress: { percent: 60, label: '60%' } as ArchiveProgress,
      };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.progress?.percent).toBe(60);
    });

    it('preserves fileHash from either item', () => {
      const item1 = { ...baseItem1, fileHash: 'hash123' };
      const item2 = { ...baseItem2 };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.fileHash).toBe('hash123');
    });

    it('preserves url from either item', () => {
      const item1 = { ...baseItem1, url: 'https://example.com/article' };
      const item2 = { ...baseItem2 };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.url).toBe('https://example.com/article');
    });

    it('merges collectionIds as union', () => {
      const item1 = { ...baseItem1, collectionIds: ['col-1', 'col-2'] };
      const item2 = { ...baseItem2, collectionIds: ['col-2', 'col-3'] };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.collectionIds).toContain('col-1');
      expect(merged.collectionIds).toContain('col-2');
      expect(merged.collectionIds).toContain('col-3');
    });

    it('handles items without collectionIds', () => {
      const merged = mergeArchiveItemPair(baseItem1, baseItem2);
      expect(merged.collectionIds).toBeUndefined();
    });

    it('preserves pasteContent from either item', () => {
      const item1 = { ...baseItem1, pasteContent: 'pasted text' };
      const item2 = { ...baseItem2 };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.pasteContent).toBe('pasted text');
    });

    it('uses percentage when positions are missing', () => {
      const item1 = {
        ...baseItem1,
        progress: { percent: 80, label: '80%' } as ArchiveProgress,
      };
      const item2 = {
        ...baseItem2,
        progress: { percent: 40, label: '40%' } as ArchiveProgress,
      };

      const merged = mergeArchiveItemPair(item1, item2);
      expect(merged.id).toBe('item-1'); // Item with 80% should be primary
    });
  });

  describe('mergeFullArchiveItems', () => {
    it('preserves cachedDocument from either item', () => {
      const mockDoc = {
        metadata: { title: 'Test', source: 'web', createdAt: 1000 },
        blocks: [],
        plainText: 'test',
      };

      const item1: ArchiveItem = {
        id: 'item-1',
        type: 'web',
        title: 'Item 1',
        sourceLabel: 'example.com',
        lastOpenedAt: 1000,
        createdAt: 500,
        cachedDocument: mockDoc,
      };

      const item2: ArchiveItem = {
        id: 'item-2',
        type: 'web',
        title: 'Item 2',
        sourceLabel: 'example.com',
        lastOpenedAt: 2000,
        createdAt: 600,
      };

      const merged = mergeFullArchiveItems(item1, item2);
      expect(merged.cachedDocument).toBe(mockDoc);
    });

    it('prefers first cachedDocument when both exist', () => {
      const doc1 = {
        metadata: { title: 'Doc 1', source: 'web', createdAt: 1000 },
        blocks: [],
        plainText: 'doc 1',
      };
      const doc2 = {
        metadata: { title: 'Doc 2', source: 'web', createdAt: 2000 },
        blocks: [],
        plainText: 'doc 2',
      };

      const item1: ArchiveItem = {
        id: 'item-1',
        type: 'web',
        title: 'Item 1',
        sourceLabel: 'example.com',
        lastOpenedAt: 1000,
        createdAt: 500,
        cachedDocument: doc1,
      };

      const item2: ArchiveItem = {
        id: 'item-2',
        type: 'web',
        title: 'Item 2',
        sourceLabel: 'example.com',
        lastOpenedAt: 2000,
        createdAt: 600,
        cachedDocument: doc2,
      };

      const merged = mergeFullArchiveItems(item1, item2);
      expect(merged.cachedDocument).toBe(doc1);
    });
  });
});
