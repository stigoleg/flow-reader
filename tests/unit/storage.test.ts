import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStorage,
  saveSettings,
  getSettings,
  savePosition,
  getPosition,
  addRecentDocument,
  getRecentDocuments,
  savePreset,
  getPresets,
  deletePreset,
  isOnboardingCompleted,
  completeOnboarding,
  resetSettings,
  clearStorage,
} from '@/lib/storage';
import { DEFAULT_SETTINGS } from '@/types';

// Helper to set up chrome.storage.local mock data
function setMockStorage(data: Record<string, unknown>) {
  vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
    (callback as (result: Record<string, unknown>) => void)(data);
  });
}

describe('Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
      (callback as (result: Record<string, unknown>) => void)({});
    });
    vi.mocked(chrome.storage.local.set).mockImplementation((_data, callback) => {
      if (callback) callback();
    });
    vi.mocked(chrome.storage.local.clear).mockImplementation((callback) => {
      if (callback) callback();
    });
  });

  describe('getStorage', () => {
    it('returns default storage when empty', async () => {
      setMockStorage({});
      
      const storage = await getStorage();
      
      expect(storage.version).toBe(3);
      expect(storage.settings).toEqual(DEFAULT_SETTINGS);
      expect(storage.presets).toEqual({});
      expect(storage.positions).toEqual({});
      expect(storage.recentDocuments).toEqual([]);
      expect(storage.archiveItems).toEqual([]);
      expect(storage.onboardingCompleted).toBe(false);
    });

    it('initializes storage when empty', async () => {
      setMockStorage({});
      
      await getStorage();
      
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('returns stored data when available', async () => {
      const storedSettings = { ...DEFAULT_SETTINGS, baseWPM: 300 };
      setMockStorage({
        version: 1,
        settings: storedSettings,
        presets: { fast: { baseWPM: 400 } },
        positions: {},
        recentDocuments: [],
        onboardingCompleted: true,
      });
      
      const storage = await getStorage();
      
      expect(storage.settings.baseWPM).toBe(300);
      expect(storage.presets).toEqual({ fast: { baseWPM: 400 } });
      expect(storage.onboardingCompleted).toBe(true);
    });

    it('merges stored settings with defaults (handles new settings added in updates)', async () => {
      // Simulate stored settings missing a new field
      const partialSettings = { baseWPM: 250, fontFamily: 'Arial' };
      setMockStorage({
        version: 1,
        settings: partialSettings,
      });
      
      const storage = await getStorage();
      
      // Should have the stored value
      expect(storage.settings.baseWPM).toBe(250);
      expect(storage.settings.fontFamily).toBe('Arial');
      // Should also have defaults for missing fields
      expect(storage.settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
      expect(storage.settings.lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
    });
  });

  describe('saveSettings', () => {
    it('merges new settings with existing', async () => {
      setMockStorage({
        version: 1,
        settings: DEFAULT_SETTINGS,
      });
      
      await saveSettings({ baseWPM: 350 });
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ baseWPM: 350 }),
        }),
        expect.any(Function)
      );
    });

    it('preserves unmodified settings', async () => {
      setMockStorage({
        version: 1,
        settings: { ...DEFAULT_SETTINGS, fontFamily: 'Helvetica' },
      });
      
      await saveSettings({ baseWPM: 350 });
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ 
            baseWPM: 350,
            fontFamily: 'Helvetica',
          }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('getSettings', () => {
    it('returns settings from storage', async () => {
      const customSettings = { ...DEFAULT_SETTINGS, baseWPM: 400 };
      setMockStorage({
        version: 1,
        settings: customSettings,
      });
      
      const settings = await getSettings();
      
      expect(settings.baseWPM).toBe(400);
    });
  });

  describe('savePosition and getPosition', () => {
    it('saves position for URL', async () => {
      setMockStorage({ version: 1, settings: DEFAULT_SETTINGS, positions: {} });
      
      await savePosition('https://example.com/article', {
        blockIndex: 5,
        charOffset: 100,
        timestamp: 1234567890,
      });
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          positions: expect.any(Object),
        }),
        expect.any(Function)
      );
    });

    it('returns null for unknown URL', async () => {
      setMockStorage({ version: 1, settings: DEFAULT_SETTINGS, positions: {} });
      
      const position = await getPosition('https://unknown.com');
      
      expect(position).toBeNull();
    });
  });

  describe('addRecentDocument and getRecentDocuments', () => {
    it('adds document to recent list', async () => {
      setMockStorage({ version: 1, settings: DEFAULT_SETTINGS, recentDocuments: [] });
      
      await addRecentDocument({
        id: 'doc1',
        title: 'Test Article',
        source: 'web',
        timestamp: Date.now(),
        preview: 'Article preview...',
        url: 'https://example.com',
      });
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          recentDocuments: expect.arrayContaining([
            expect.objectContaining({ id: 'doc1' }),
          ]),
        }),
        expect.any(Function)
      );
    });

    it('limits recent documents to 20', async () => {
      // Create 21 existing documents
      const existingDocs = Array.from({ length: 21 }, (_, i) => ({
        id: `doc${i}`,
        title: `Doc ${i}`,
        source: 'web',
        timestamp: Date.now() - i * 1000,
        preview: 'Preview',
      }));
      
      setMockStorage({ version: 1, settings: DEFAULT_SETTINGS, recentDocuments: existingDocs });
      
      await addRecentDocument({
        id: 'new-doc',
        title: 'New Document',
        source: 'web',
        timestamp: Date.now(),
        preview: 'New preview',
      });
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          recentDocuments: expect.any(Array),
        }),
        expect.any(Function)
      );
      
      // Verify the call had at most 20 documents
      const call = vi.mocked(chrome.storage.local.set).mock.calls[0];
      const docs = (call[0] as { recentDocuments: unknown[] }).recentDocuments;
      expect(docs.length).toBeLessThanOrEqual(20);
    });

    it('moves existing document to top on re-add', async () => {
      setMockStorage({
        version: 1,
        settings: DEFAULT_SETTINGS,
        recentDocuments: [
          { id: 'doc1', title: 'First', source: 'web', timestamp: 1000, preview: '' },
          { id: 'doc2', title: 'Second', source: 'web', timestamp: 2000, preview: '' },
        ],
      });
      
      await addRecentDocument({
        id: 'doc2',
        title: 'Second Updated',
        source: 'web',
        timestamp: 3000,
        preview: 'Updated preview',
      });
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          recentDocuments: expect.arrayContaining([
            expect.objectContaining({ id: 'doc2', title: 'Second Updated' }),
          ]),
        }),
        expect.any(Function)
      );
    });

    it('returns empty array when no documents', async () => {
      setMockStorage({ version: 1, settings: DEFAULT_SETTINGS, recentDocuments: [] });
      
      const docs = await getRecentDocuments();
      
      expect(docs).toEqual([]);
    });
  });

  describe('presets', () => {
    it('saves preset', async () => {
      setMockStorage({ version: 1, settings: DEFAULT_SETTINGS, presets: {} });
      
      await savePreset('reading', { baseWPM: 250 });
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          presets: { reading: { baseWPM: 250 } },
        }),
        expect.any(Function)
      );
    });

    it('gets all presets', async () => {
      setMockStorage({
        version: 1,
        settings: DEFAULT_SETTINGS,
        presets: {
          slow: { baseWPM: 150 },
          fast: { baseWPM: 400 },
        },
      });
      
      const presets = await getPresets();
      
      expect(presets).toEqual({
        slow: { baseWPM: 150 },
        fast: { baseWPM: 400 },
      });
    });

    it('deletes preset', async () => {
      setMockStorage({
        version: 1,
        settings: DEFAULT_SETTINGS,
        presets: {
          slow: { baseWPM: 150 },
          fast: { baseWPM: 400 },
        },
      });
      
      await deletePreset('slow');
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          presets: { fast: { baseWPM: 400 } },
        }),
        expect.any(Function)
      );
    });
  });

  describe('onboarding', () => {
    it('returns false when not completed', async () => {
      setMockStorage({ version: 1, settings: DEFAULT_SETTINGS, onboardingCompleted: false });
      
      const completed = await isOnboardingCompleted();
      
      expect(completed).toBe(false);
    });

    it('returns true when completed', async () => {
      setMockStorage({ version: 1, settings: DEFAULT_SETTINGS, onboardingCompleted: true });
      
      const completed = await isOnboardingCompleted();
      
      expect(completed).toBe(true);
    });

    it('completeOnboarding sets flag to true', async () => {
      await completeOnboarding();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ onboardingCompleted: true }),
        expect.any(Function)
      );
    });
  });

  describe('resetSettings', () => {
    it('resets to default settings', async () => {
      setMockStorage({ version: 1, settings: { ...DEFAULT_SETTINGS, baseWPM: 500 } });
      
      await resetSettings();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining(DEFAULT_SETTINGS),
        }),
        expect.any(Function)
      );
    });
  });

  describe('clearStorage', () => {
    it('clears all storage', async () => {
      await clearStorage();
      
      expect(chrome.storage.local.clear).toHaveBeenCalled();
    });
  });
});
