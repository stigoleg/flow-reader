/**
 * Sync Flow Integration Tests
 * 
 * Tests that all storage operations properly write to chrome.storage,
 * which triggers the onChange mechanism used by the sync scheduler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storageFacade } from '@/lib/storage-facade';
import { saveSettings, savePosition, resetSettings, completeOnboarding, dismissExitConfirmation } from '@/lib/storage';
import { DEFAULT_SETTINGS } from '@/types';

// Helper to set up chrome.storage.local mock data
function setMockStorage(data: Record<string, unknown>) {
  vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
    (callback as (result: Record<string, unknown>) => void)(data);
  });
}

describe('Sync Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
      (callback as (result: Record<string, unknown>) => void)({
        version: 3,
        settings: DEFAULT_SETTINGS,
        presets: {},
        positions: {},
        archiveItems: [],
        customThemes: [],
      });
    });
    vi.mocked(chrome.storage.local.set).mockImplementation((_data, callback) => {
      if (callback) callback();
    });
    vi.mocked(chrome.storage.local.clear).mockImplementation((callback) => {
      if (callback) callback();
    });
  });

  describe('storageFacade methods write to chrome.storage', () => {
    it('updateSettings writes settings to chrome.storage', async () => {
      await storageFacade.updateSettings({ baseWPM: 400 });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ baseWPM: 400 }),
        }),
        expect.any(Function)
      );
    });

    it('updatePositions writes positions to chrome.storage', async () => {
      const position = { blockIndex: 10, charOffset: 0, timestamp: Date.now() };
      await storageFacade.updatePositions({ 'test-key': position });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          positions: expect.objectContaining({ 'test-key': position }),
        }),
        expect.any(Function)
      );
    });

    it('updateCustomThemes writes themes to chrome.storage', async () => {
      const theme = {
        name: 'Test Theme',
        backgroundColor: '#000',
        textColor: '#fff',
        linkColor: '#0ff',
        selectionColor: '#00f',
        highlightColor: '#ff0',
      };
      await storageFacade.updateCustomThemes([theme]);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          customThemes: expect.arrayContaining([
            expect.objectContaining({ name: 'Test Theme' }),
          ]),
        }),
        expect.any(Function)
      );
    });

    it('updatePresets writes presets to chrome.storage', async () => {
      await storageFacade.updatePresets({ 'Fast Reading': { baseWPM: 500 } });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          presets: expect.objectContaining({
            'Fast Reading': expect.objectContaining({ baseWPM: 500 }),
          }),
        }),
        expect.any(Function)
      );
    });

    it('updateArchiveItems writes items to chrome.storage', async () => {
      const item = {
        id: 'test-1',
        type: 'web' as const,
        title: 'Test Article',
        sourceLabel: 'example.com',
        createdAt: Date.now(),
        lastOpenedAt: Date.now(),
      };
      await storageFacade.updateArchiveItems([item]);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          archiveItems: expect.arrayContaining([
            expect.objectContaining({ id: 'test-1' }),
          ]),
        }),
        expect.any(Function)
      );
    });

    it('updateFlags writes flags to chrome.storage', async () => {
      await storageFacade.updateFlags({ onboardingCompleted: true });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardingCompleted: true,
        }),
        expect.any(Function)
      );
    });
  });

  describe('storage.ts functions write to chrome.storage', () => {
    it('saveSettings writes to chrome.storage', async () => {
      await saveSettings({ baseWPM: 350 });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ baseWPM: 350 }),
        }),
        expect.any(Function)
      );
    });

    it('resetSettings writes default settings to chrome.storage', async () => {
      await resetSettings();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ baseWPM: DEFAULT_SETTINGS.baseWPM }),
        }),
        expect.any(Function)
      );
    });

    it('savePosition writes to chrome.storage', async () => {
      await savePosition('https://example.com/article', {
        blockIndex: 5,
        charOffset: 10,
        timestamp: Date.now(),
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          positions: expect.any(Object),
        }),
        expect.any(Function)
      );
    });

    it('completeOnboarding writes to chrome.storage', async () => {
      await completeOnboarding();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardingCompleted: true,
        }),
        expect.any(Function)
      );
    });

    it('dismissExitConfirmation writes to chrome.storage', async () => {
      await dismissExitConfirmation();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          exitConfirmationDismissed: true,
        }),
        expect.any(Function)
      );
    });
  });

  describe('sync state preparation', () => {
    it('getStateForSync returns all syncable data', async () => {
      setMockStorage({
        version: 3,
        dataUpdatedAt: 1700000000000,
        settings: { ...DEFAULT_SETTINGS, baseWPM: 300 },
        presets: { 'Fast': { baseWPM: 500 } },
        positions: { 'pos_test': { blockIndex: 10, charOffset: 0, timestamp: 1000 } },
        archiveItems: [{
          id: 'item-1',
          type: 'web',
          title: 'Test',
          sourceLabel: 'example.com',
          createdAt: 1000,
          lastOpenedAt: 2000,
        }],
        customThemes: [{
          name: 'Dark',
          backgroundColor: '#000',
          textColor: '#fff',
          linkColor: '#0ff',
          selectionColor: '#00f',
          highlightColor: '#ff0',
        }],
        onboardingCompleted: true,
        exitConfirmationDismissed: false,
      });

      const syncState = await storageFacade.getStateForSync();

      expect(syncState.settings.baseWPM).toBe(300);
      expect(syncState.presets['Fast']).toBeDefined();
      expect(Object.keys(syncState.positions)).toHaveLength(1);
      expect(syncState.archiveItems).toHaveLength(1);
      expect(syncState.customThemes).toHaveLength(1);
      expect(syncState.onboardingCompleted).toBe(true);
      expect(syncState.deviceId).toBeDefined();
      expect(syncState.schemaVersion).toBe(3);
      expect(syncState.updatedAt).toBeGreaterThan(0);
    });

    it('getStateForSync excludes cachedDocument from archive items', async () => {
      setMockStorage({
        version: 3,
        settings: DEFAULT_SETTINGS,
        archiveItems: [{
          id: 'item-1',
          type: 'web',
          title: 'Test',
          sourceLabel: 'example.com',
          createdAt: 1000,
          lastOpenedAt: 2000,
          cachedDocument: {
            metadata: { title: 'Test', source: 'web', createdAt: 1000 },
            content: { blocks: [{ id: '1', type: 'paragraph', content: 'Hello' }] },
          },
        }],
      });

      const syncState = await storageFacade.getStateForSync();

      expect(syncState.archiveItems[0]).not.toHaveProperty('cachedDocument');
      expect(syncState.archiveItems[0].title).toBe('Test');
    });

    it('getStateForSync includes chapterIndex in positions', async () => {
      setMockStorage({
        version: 3,
        settings: DEFAULT_SETTINGS,
        positions: {
          'book_epub_abc123': {
            blockIndex: 25,
            charOffset: 0,
            timestamp: 1000,
            chapterIndex: 3,
            wordIndex: 10,
          },
        },
        archiveItems: [],
      });

      const syncState = await storageFacade.getStateForSync();

      expect(syncState.positions['book_epub_abc123'].chapterIndex).toBe(3);
      expect(syncState.positions['book_epub_abc123'].blockIndex).toBe(25);
      expect(syncState.positions['book_epub_abc123'].wordIndex).toBe(10);
    });

    it('getStateForSync includes lastPosition with chapterIndex in archive items', async () => {
      setMockStorage({
        version: 3,
        settings: DEFAULT_SETTINGS,
        archiveItems: [{
          id: 'book-1',
          type: 'epub',
          title: 'Test Book',
          sourceLabel: 'book.epub',
          createdAt: 1000,
          lastOpenedAt: 2000,
          lastPosition: {
            blockIndex: 15,
            charOffset: 0,
            timestamp: 2000,
            chapterIndex: 5,
          },
          progress: {
            percent: 50,
            label: 'Ch 6 of 12',
          },
        }],
      });

      const syncState = await storageFacade.getStateForSync();

      expect(syncState.archiveItems[0].lastPosition?.chapterIndex).toBe(5);
      expect(syncState.archiveItems[0].lastPosition?.blockIndex).toBe(15);
      expect(syncState.archiveItems[0].progress?.label).toBe('Ch 6 of 12');
    });
  });

  describe('applyRemoteState', () => {
    it('applies remote settings to local storage', async () => {
      setMockStorage({
        version: 3,
        settings: { ...DEFAULT_SETTINGS, baseWPM: 200 },
        archiveItems: [],
      });

      const remoteState = {
        schemaVersion: 3,
        updatedAt: Date.now(),
        deviceId: 'remote-device',
        settings: { ...DEFAULT_SETTINGS, baseWPM: 400 },
        presets: { 'Remote Preset': { baseWPM: 500 } },
        customThemes: [],
        archiveItems: [],
        positions: {},
        onboardingCompleted: true,
        exitConfirmationDismissed: false,
      };

      await storageFacade.applyRemoteState(remoteState);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ baseWPM: 400 }),
          presets: expect.objectContaining({
            'Remote Preset': expect.objectContaining({ baseWPM: 500 }),
          }),
        }),
        expect.any(Function)
      );
    });

    it('preserves local cachedDocument when applying remote state', async () => {
      const cachedDoc = {
        metadata: { title: 'Local Doc', source: 'web', createdAt: 1000 },
        content: { blocks: [{ id: '1', type: 'paragraph', content: 'Hello' }] },
      };

      setMockStorage({
        version: 3,
        settings: DEFAULT_SETTINGS,
        archiveItems: [{
          id: 'item-1',
          type: 'web',
          title: 'Local Title',
          sourceLabel: 'example.com',
          createdAt: 1000,
          lastOpenedAt: 2000,
          cachedDocument: cachedDoc,
        }],
      });

      const remoteState = {
        schemaVersion: 3,
        updatedAt: Date.now(),
        deviceId: 'remote-device',
        settings: DEFAULT_SETTINGS,
        presets: {},
        customThemes: [],
        archiveItems: [{
          id: 'item-1',
          type: 'web' as const,
          title: 'Remote Title',
          sourceLabel: 'example.com',
          createdAt: 1000,
          lastOpenedAt: 3000, // Newer
          // Note: no cachedDocument in remote (sync excludes it)
        }],
        positions: {},
        onboardingCompleted: true,
        exitConfirmationDismissed: false,
      };

      await storageFacade.applyRemoteState(remoteState);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          archiveItems: expect.arrayContaining([
            expect.objectContaining({
              id: 'item-1',
              title: 'Remote Title', // Updated from remote
              cachedDocument: cachedDoc, // Preserved from local
            }),
          ]),
        }),
        expect.any(Function)
      );
    });
  });
});
