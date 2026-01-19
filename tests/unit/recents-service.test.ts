import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addRecent,
  updateLastOpened,
  removeRecent,
  clearRecents,
  queryRecents,
  getRecent,
  mapSourceToType,
  getSourceLabel,
  shouldCacheDocument,
  calculateProgress,
  formatRelativeTime,
  getTypeBadgeLabel,
  MAX_ARCHIVE_ITEMS,
  MAX_PASTE_CONTENT_SIZE,
} from '@/lib/recents-service';
import type { ArchiveItem, DocumentMetadata } from '@/types';

// Helper to set up chrome.storage.local mock data
function setMockStorage(data: Record<string, unknown>) {
  vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
    (callback as (result: Record<string, unknown>) => void)(data);
  });
}

describe('Recents Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Default mock implementations
    vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
      (callback as (result: Record<string, unknown>) => void)({
        archiveItems: [],
        version: 2,
      });
    });
    vi.mocked(chrome.storage.local.set).mockImplementation((_data, callback) => {
      if (callback) callback();
    });
    vi.mocked(chrome.storage.local.clear).mockImplementation((callback) => {
      if (callback) callback();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('addRecent', () => {
    it('adds a new item to the archive', async () => {
      vi.useRealTimers(); // Use real timers for async debounce
      
      const item = await addRecent({
        type: 'web',
        title: 'Test Article',
        sourceLabel: 'example.com',
        url: 'https://example.com/article',
      });
      
      expect(item.title).toBe('Test Article');
      expect(item.type).toBe('web');
      expect(item.sourceLabel).toBe('example.com');
      expect(item.url).toBe('https://example.com/article');
      expect(item.id).toBeDefined();
      expect(item.createdAt).toBeDefined();
      expect(item.lastOpenedAt).toBeDefined();
    });

    it('updates existing item with same URL', async () => {
      vi.useRealTimers();
      
      const existingItem: ArchiveItem = {
        id: 'existing-id',
        type: 'web',
        title: 'Old Title',
        sourceLabel: 'example.com',
        url: 'https://example.com/article',
        createdAt: 1000,
        lastOpenedAt: 1000,
      };
      
      setMockStorage({
        archiveItems: [existingItem],
        version: 2,
      });
      
      const item = await addRecent({
        type: 'web',
        title: 'New Title',
        sourceLabel: 'example.com',
        url: 'https://example.com/article',
      });
      
      expect(item.id).toBe('existing-id'); // Same ID
      expect(item.title).toBe('New Title'); // Updated title
      expect(item.createdAt).toBe(1000); // Original createdAt preserved
    });

    it('updates existing item with same fileHash', async () => {
      vi.useRealTimers();
      
      const existingItem: ArchiveItem = {
        id: 'existing-id',
        type: 'pdf',
        title: 'Old PDF',
        sourceLabel: 'document.pdf',
        fileHash: 'abc123',
        createdAt: 1000,
        lastOpenedAt: 1000,
      };
      
      setMockStorage({
        archiveItems: [existingItem],
        version: 2,
      });
      
      const item = await addRecent({
        type: 'pdf',
        title: 'Updated PDF',
        sourceLabel: 'document.pdf',
        fileHash: 'abc123',
      });
      
      expect(item.id).toBe('existing-id');
      expect(item.title).toBe('Updated PDF');
    });

    it('truncates paste content that exceeds max size', async () => {
      vi.useRealTimers();
      
      const longContent = 'x'.repeat(MAX_PASTE_CONTENT_SIZE + 1000);
      
      const item = await addRecent({
        type: 'paste',
        title: 'Pasted Text',
        sourceLabel: 'Clipboard',
        pasteContent: longContent,
      });
      
      expect(item.pasteContent?.length).toBe(MAX_PASTE_CONTENT_SIZE);
    });

    it('evicts oldest items when over limit', async () => {
      vi.useRealTimers();
      
      // Create items at the limit
      const existingItems: ArchiveItem[] = Array.from({ length: MAX_ARCHIVE_ITEMS }, (_, i) => ({
        id: `item-${i}`,
        type: 'web',
        title: `Item ${i}`,
        sourceLabel: `site${i}.com`,
        createdAt: i,
        lastOpenedAt: i,
      }));
      
      setMockStorage({
        archiveItems: existingItems,
        version: 2,
      });
      
      await addRecent({
        type: 'web',
        title: 'New Item',
        sourceLabel: 'new.com',
        url: 'https://new.com',
      });
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Verify storage was called with correct number of items
      expect(chrome.storage.local.set).toHaveBeenCalled();
      const calls = vi.mocked(chrome.storage.local.set).mock.calls;
      const lastCall = calls[calls.length - 1];
      const savedItems = (lastCall[0] as { archiveItems: ArchiveItem[] }).archiveItems;
      expect(savedItems.length).toBeLessThanOrEqual(MAX_ARCHIVE_ITEMS);
    });
  });

  describe('updateLastOpened', () => {
    it('updates lastOpenedAt and moves item to top', async () => {
      vi.useRealTimers();
      
      const items: ArchiveItem[] = [
        { id: 'item-1', type: 'web', title: 'First', sourceLabel: 'a.com', createdAt: 1000, lastOpenedAt: 1000 },
        { id: 'item-2', type: 'web', title: 'Second', sourceLabel: 'b.com', createdAt: 2000, lastOpenedAt: 2000 },
      ];
      
      setMockStorage({ archiveItems: items, version: 2 });
      
      await updateLastOpened('item-2');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(chrome.storage.local.set).toHaveBeenCalled();
      const calls = vi.mocked(chrome.storage.local.set).mock.calls;
      const lastCall = calls[calls.length - 1];
      const savedItems = (lastCall[0] as { archiveItems: ArchiveItem[] }).archiveItems;
      expect(savedItems[0].id).toBe('item-2'); // Moved to top
    });

    it('updates position and progress when provided', async () => {
      vi.useRealTimers();
      
      const items: ArchiveItem[] = [
        { id: 'item-1', type: 'web', title: 'Article', sourceLabel: 'a.com', createdAt: 1000, lastOpenedAt: 1000 },
      ];
      
      setMockStorage({ archiveItems: items, version: 2 });
      
      const position = { blockIndex: 10, charOffset: 0, timestamp: Date.now() };
      const progress = { percent: 50, label: '50%' };
      
      await updateLastOpened('item-1', position, progress);
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(chrome.storage.local.set).toHaveBeenCalled();
      const calls = vi.mocked(chrome.storage.local.set).mock.calls;
      const lastCall = calls[calls.length - 1];
      const savedItems = (lastCall[0] as { archiveItems: ArchiveItem[] }).archiveItems;
      expect(savedItems[0].lastPosition).toEqual(position);
      expect(savedItems[0].progress).toEqual(progress);
    });

    it('does nothing for non-existent item', async () => {
      setMockStorage({ archiveItems: [], version: 2 });
      
      await updateLastOpened('non-existent');
      
      // Should not throw and should not save
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('removeRecent', () => {
    it('removes item by id', async () => {
      const items: ArchiveItem[] = [
        { id: 'item-1', type: 'web', title: 'First', sourceLabel: 'a.com', createdAt: 1000, lastOpenedAt: 1000 },
        { id: 'item-2', type: 'web', title: 'Second', sourceLabel: 'b.com', createdAt: 2000, lastOpenedAt: 2000 },
      ];
      
      setMockStorage({ archiveItems: items, version: 2 });
      
      await removeRecent('item-1');
      
      expect(chrome.storage.local.set).toHaveBeenCalled();
      const calls = vi.mocked(chrome.storage.local.set).mock.calls;
      // Find the call that contains archiveItems (there may be other calls for tombstones)
      const archiveCall = calls.find(call => 'archiveItems' in (call[0] as object));
      expect(archiveCall).toBeDefined();
      const savedItems = (archiveCall![0] as { archiveItems: ArchiveItem[] }).archiveItems;
      expect(savedItems.length).toBe(1);
      expect(savedItems[0].id).toBe('item-2');
    });

    it('does nothing for non-existent item', async () => {
      const items: ArchiveItem[] = [
        { id: 'item-1', type: 'web', title: 'First', sourceLabel: 'a.com', createdAt: 1000, lastOpenedAt: 1000 },
      ];
      
      setMockStorage({ archiveItems: items, version: 2 });
      
      await removeRecent('non-existent');
      
      // Should not save since nothing changed
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('clearRecents', () => {
    it('clears all items', async () => {
      const items: ArchiveItem[] = [
        { id: 'item-1', type: 'web', title: 'First', sourceLabel: 'a.com', createdAt: 1000, lastOpenedAt: 1000 },
        { id: 'item-2', type: 'web', title: 'Second', sourceLabel: 'b.com', createdAt: 2000, lastOpenedAt: 2000 },
      ];
      
      setMockStorage({ archiveItems: items, version: 2 });
      
      await clearRecents();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ archiveItems: [] }),
        expect.any(Function)
      );
    });
  });

  describe('queryRecents', () => {
    const testItems: ArchiveItem[] = [
      { id: 'web-1', type: 'web', title: 'Web Article', sourceLabel: 'example.com', author: 'John Doe', createdAt: 1000, lastOpenedAt: 5000 },
      { id: 'pdf-1', type: 'pdf', title: 'PDF Document', sourceLabel: 'report.pdf', createdAt: 2000, lastOpenedAt: 4000 },
      { id: 'epub-1', type: 'epub', title: 'eBook Novel', sourceLabel: 'novel.epub', author: 'Jane Smith', createdAt: 3000, lastOpenedAt: 3000 },
    ];

    beforeEach(() => {
      setMockStorage({ archiveItems: testItems, version: 2 });
    });

    it('returns all items by default', async () => {
      const items = await queryRecents();
      expect(items.length).toBe(3);
    });

    it('filters by type', async () => {
      const items = await queryRecents({ types: ['pdf'] });
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('pdf');
    });

    it('filters by multiple types', async () => {
      const items = await queryRecents({ types: ['web', 'epub'] });
      expect(items.length).toBe(2);
    });

    it('searches by title', async () => {
      const items = await queryRecents({ search: 'Novel' });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('epub-1');
    });

    it('searches by author', async () => {
      const items = await queryRecents({ search: 'John' });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('web-1');
    });

    it('searches by sourceLabel', async () => {
      const items = await queryRecents({ search: 'example' });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('web-1');
    });

    it('search is case-insensitive', async () => {
      const items = await queryRecents({ search: 'EBOOK' });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('epub-1');
    });

    it('sorts by lastOpenedAt descending by default', async () => {
      const items = await queryRecents();
      expect(items[0].id).toBe('web-1'); // lastOpenedAt: 5000
      expect(items[1].id).toBe('pdf-1'); // lastOpenedAt: 4000
      expect(items[2].id).toBe('epub-1'); // lastOpenedAt: 3000
    });

    it('sorts by title ascending', async () => {
      const items = await queryRecents({ sortBy: 'title', sortOrder: 'asc' });
      expect(items[0].title).toBe('eBook Novel');
      expect(items[1].title).toBe('PDF Document');
      expect(items[2].title).toBe('Web Article');
    });

    it('applies limit', async () => {
      const items = await queryRecents({ limit: 2 });
      expect(items.length).toBe(2);
    });

    it('applies offset', async () => {
      const items = await queryRecents({ offset: 1 });
      expect(items.length).toBe(2);
      expect(items[0].id).toBe('pdf-1');
    });

    it('applies offset and limit together', async () => {
      const items = await queryRecents({ offset: 1, limit: 1 });
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('pdf-1');
    });
  });

  describe('getRecent', () => {
    it('returns item by id', async () => {
      const items: ArchiveItem[] = [
        { id: 'item-1', type: 'web', title: 'First', sourceLabel: 'a.com', createdAt: 1000, lastOpenedAt: 1000 },
      ];
      
      setMockStorage({ archiveItems: items, version: 2 });
      
      const item = await getRecent('item-1');
      
      expect(item).not.toBeNull();
      expect(item?.title).toBe('First');
    });

    it('returns null for non-existent id', async () => {
      setMockStorage({ archiveItems: [], version: 2 });
      
      const item = await getRecent('non-existent');
      
      expect(item).toBeNull();
    });
  });

  describe('mapSourceToType', () => {
    it('maps web source', () => {
      expect(mapSourceToType('web')).toBe('web');
    });

    it('maps selection to web', () => {
      expect(mapSourceToType('selection')).toBe('web');
    });

    it('maps pdf source', () => {
      expect(mapSourceToType('pdf')).toBe('pdf');
    });

    it('maps docx source', () => {
      expect(mapSourceToType('docx')).toBe('docx');
    });

    it('maps epub source', () => {
      expect(mapSourceToType('epub')).toBe('epub');
    });

    it('maps mobi source', () => {
      expect(mapSourceToType('mobi')).toBe('mobi');
    });

    it('maps paste source', () => {
      expect(mapSourceToType('paste')).toBe('paste');
    });

    it('maps unknown source to web', () => {
      expect(mapSourceToType('unknown')).toBe('web');
    });
  });

  describe('getSourceLabel', () => {
    it('extracts domain from URL', () => {
      const metadata = { url: 'https://www.example.com/article' } as DocumentMetadata;
      expect(getSourceLabel(metadata)).toBe('example.com');
    });

    it('returns filename for file sources', () => {
      const metadata = { fileName: 'document.pdf', source: 'pdf' } as DocumentMetadata;
      expect(getSourceLabel(metadata)).toBe('document.pdf');
    });

    it('falls back to source type', () => {
      const metadata = { source: 'paste' } as DocumentMetadata;
      expect(getSourceLabel(metadata)).toBe('paste');
    });
  });

  describe('shouldCacheDocument', () => {
    it('returns true for file sources', () => {
      expect(shouldCacheDocument('pdf')).toBe(true);
      expect(shouldCacheDocument('docx')).toBe(true);
      expect(shouldCacheDocument('epub')).toBe(true);
      expect(shouldCacheDocument('mobi')).toBe(true);
    });

    it('returns false for web sources', () => {
      expect(shouldCacheDocument('web')).toBe(false);
      expect(shouldCacheDocument('selection')).toBe(false);
    });
  });

  describe('calculateProgress', () => {
    it('calculates percentage based on blocks completed', () => {
      // Block 50 of 100 means 51 blocks read (0-50), so 51%
      const progress = calculateProgress(50, 100);
      expect(progress.percent).toBe(51);
      expect(progress.label).toBe('51%');
    });

    it('returns 100% when on the last block', () => {
      // Block 99 of 100 means all 100 blocks read, so 100%
      const progress = calculateProgress(99, 100);
      expect(progress.percent).toBe(100);
      expect(progress.label).toBe('100%');
    });

    it('returns 1% when on the first block', () => {
      // Block 0 of 100 means 1 block read, so 1%
      const progress = calculateProgress(0, 100);
      expect(progress.percent).toBe(1);
      expect(progress.label).toBe('1%');
    });

    it('handles zero blocks', () => {
      const progress = calculateProgress(0, 0);
      expect(progress.percent).toBe(0);
      expect(progress.label).toBe('0%');
    });

    it('includes chapter info for books', () => {
      // Book with 10 chapters, each with 1000 words = 10000 total words
      // Currently on chapter 2 (0-indexed), block 25 of 100 in that chapter
      // Words in prev chapters: 2 * 1000 = 2000
      // Words in current chapter: 1000 * (26/100) = 260
      // Total progress: (2000 + 260) / 10000 = 22.6% -> 23%
      const chapterWordCounts = Array(10).fill(1000);
      const progress = calculateProgress(25, 100, { 
        currentChapter: 2, 
        totalChapters: 10,
        chapterWordCounts,
      });
      expect(progress.percent).toBe(23);
      expect(progress.label).toBe('Ch 3 of 10 (23%)');
    });

    it('handles first chapter at first block', () => {
      // Book with 5 chapters, each with 1000 words = 5000 total words
      // Currently on chapter 0, block 0 of 100
      // Words in prev chapters: 0
      // Words in current chapter: 1000 * (1/100) = 10
      // Total progress: 10 / 5000 = 0.2% -> 0%
      const chapterWordCounts = Array(5).fill(1000);
      const progress = calculateProgress(0, 100, { 
        currentChapter: 0, 
        totalChapters: 5,
        chapterWordCounts,
      });
      expect(progress.percent).toBe(0);
      expect(progress.label).toBe('Ch 1 of 5 (0%)');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    });

    it('returns "Just now" for recent times', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 30000)).toBe('Just now');
    });

    it('returns minutes for times under an hour', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 5 * 60 * 1000)).toBe('5 minutes ago');
      expect(formatRelativeTime(now - 1 * 60 * 1000)).toBe('1 minute ago');
    });

    it('returns hours for times under a day', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 3 * 60 * 60 * 1000)).toBe('3 hours ago');
      expect(formatRelativeTime(now - 1 * 60 * 60 * 1000)).toBe('1 hour ago');
    });

    it('returns "Yesterday" for times 1 day ago', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 24 * 60 * 60 * 1000)).toBe('Yesterday');
    });

    it('returns days for times under a week', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000)).toBe('3 days ago');
    });

    it('returns formatted date for older times', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 10 * 24 * 60 * 60 * 1000);
      expect(result).toMatch(/Jan 5/);
    });
  });

  describe('getTypeBadgeLabel', () => {
    it('returns correct labels', () => {
      expect(getTypeBadgeLabel('web')).toBe('Web');
      expect(getTypeBadgeLabel('pdf')).toBe('PDF');
      expect(getTypeBadgeLabel('docx')).toBe('Word');
      expect(getTypeBadgeLabel('epub')).toBe('EPUB');
      expect(getTypeBadgeLabel('mobi')).toBe('MOBI');
      expect(getTypeBadgeLabel('paste')).toBe('Paste');
    });
  });

  describe('migration', () => {
    it('returns empty array when no archiveItems exist (migration happens in migrations.ts)', async () => {
      // Note: Migration from recentDocuments to archiveItems is handled by 
      // migrations.ts during extension install/update, not at query time.
      // This test verifies that recents-service correctly returns empty
      // when no archiveItems are present (before migration runs).
      vi.useRealTimers();
      
      setMockStorage({
        recentDocuments: [
          {
            id: 'doc-1',
            title: 'Old Document',
            source: 'web',
            timestamp: 1000,
            preview: 'Preview text',
            url: 'https://example.com/article',
          },
        ],
        version: 1,
        archiveItems: [], // No archiveItems - migration hasn't run yet
      });
      
      const items = await queryRecents();
      
      // Since archiveItems is empty and migration is handled elsewhere,
      // we expect an empty array
      expect(items.length).toBe(0);
    });
  });
});
