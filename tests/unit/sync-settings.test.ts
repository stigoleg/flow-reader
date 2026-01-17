/**
 * Sync Settings Integration Tests
 * 
 * Tests that sync operations properly update the reader store and UI components.
 * This ensures end-to-end sync functionality for settings, themes, and presets.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_SETTINGS } from '@/types';

// Mock chrome.storage before importing modules that use it
vi.mock('@/lib/storage', () => ({
  getSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  savePosition: vi.fn().mockResolvedValue(undefined),
  getPosition: vi.fn().mockResolvedValue(null),
  isExitConfirmationDismissed: vi.fn().mockResolvedValue(false),
  dismissExitConfirmation: vi.fn().mockResolvedValue(undefined),
  saveCurrentDocument: vi.fn().mockResolvedValue(undefined),
  getCustomThemes: vi.fn().mockResolvedValue([]),
  getPresets: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/recents-service', () => ({
  addRecent: vi.fn().mockResolvedValue(undefined),
  mapSourceToType: vi.fn().mockReturnValue('web'),
  getSourceLabel: vi.fn().mockReturnValue('Test'),
  shouldCacheDocument: vi.fn().mockReturnValue(false),
  calculateProgress: vi.fn().mockReturnValue({ percent: 0, label: '0%' }),
  updateLastOpened: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
import { useReaderStore } from '@/reader/store';
import { SYNC_EVENTS } from '@/reader/hooks/useStorageSync';

describe('Sync Settings Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset store state
    useReaderStore.setState({
      document: null,
      isLoading: true,
      error: null,
      currentBlockIndex: 0,
      currentCharOffset: 0,
      currentSentenceIndex: 0,
      currentWordIndex: 0,
      isPlaying: false,
      currentWPM: DEFAULT_SETTINGS.baseWPM,
      settings: DEFAULT_SETTINGS,
      settingsLoaded: false,
      isSettingsOpen: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateSettingsFromSync', () => {
    it('updates settings without triggering storage save', async () => {
      const { saveSettings } = await import('@/lib/storage');
      
      const newSettings = { 
        ...DEFAULT_SETTINGS, 
        baseWPM: 500,
        fontSize: 24,
      };
      
      useReaderStore.getState().updateSettingsFromSync(newSettings);
      
      const state = useReaderStore.getState();
      expect(state.settings.baseWPM).toBe(500);
      expect(state.settings.fontSize).toBe(24);
      expect(state.currentWPM).toBe(500); // WPM should also update
      
      // Crucially, saveSettings should NOT have been called
      expect(saveSettings).not.toHaveBeenCalled();
    });

    it('updates currentWPM when baseWPM changes via sync', () => {
      const newSettings = { 
        ...DEFAULT_SETTINGS, 
        baseWPM: 350,
      };
      
      useReaderStore.getState().updateSettingsFromSync(newSettings);
      
      expect(useReaderStore.getState().currentWPM).toBe(350);
    });

    it('preserves other state when settings sync', () => {
      // Set some initial state
      useReaderStore.setState({ 
        currentBlockIndex: 5,
        isPlaying: true,
        isSettingsOpen: true,
      });
      
      const newSettings = { 
        ...DEFAULT_SETTINGS, 
        baseWPM: 400,
      };
      
      useReaderStore.getState().updateSettingsFromSync(newSettings);
      
      const state = useReaderStore.getState();
      expect(state.currentBlockIndex).toBe(5);
      expect(state.isPlaying).toBe(true);
      expect(state.isSettingsOpen).toBe(true);
      expect(state.settings.baseWPM).toBe(400);
    });
  });

  describe('updateSettings (normal flow)', () => {
    it('updates settings and triggers storage save', async () => {
      const { saveSettings } = await import('@/lib/storage');
      
      useReaderStore.getState().updateSettings({ baseWPM: 300 });
      
      const state = useReaderStore.getState();
      expect(state.settings.baseWPM).toBe(300);
      
      // Normal updateSettings SHOULD call saveSettings
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ baseWPM: 300 })
      );
    });
  });

  describe('SYNC_EVENTS', () => {
    it('defines all required sync events', () => {
      expect(SYNC_EVENTS.THEMES_UPDATED).toBe('flowreader:themes-updated');
      expect(SYNC_EVENTS.PRESETS_UPDATED).toBe('flowreader:presets-updated');
      expect(SYNC_EVENTS.SETTINGS_UPDATED).toBe('flowreader:settings-updated');
    });
  });

  describe('sync event dispatching', () => {
    it('themes-updated event can be dispatched and received', () => {
      const handler = vi.fn();
      window.addEventListener(SYNC_EVENTS.THEMES_UPDATED, handler);
      
      window.dispatchEvent(new CustomEvent(SYNC_EVENTS.THEMES_UPDATED));
      
      expect(handler).toHaveBeenCalled();
      
      window.removeEventListener(SYNC_EVENTS.THEMES_UPDATED, handler);
    });

    it('presets-updated event can be dispatched and received', () => {
      const handler = vi.fn();
      window.addEventListener(SYNC_EVENTS.PRESETS_UPDATED, handler);
      
      window.dispatchEvent(new CustomEvent(SYNC_EVENTS.PRESETS_UPDATED));
      
      expect(handler).toHaveBeenCalled();
      
      window.removeEventListener(SYNC_EVENTS.PRESETS_UPDATED, handler);
    });

    it('settings-updated event can be dispatched and received', () => {
      const handler = vi.fn();
      window.addEventListener(SYNC_EVENTS.SETTINGS_UPDATED, handler);
      
      window.dispatchEvent(new CustomEvent(SYNC_EVENTS.SETTINGS_UPDATED));
      
      expect(handler).toHaveBeenCalled();
      
      window.removeEventListener(SYNC_EVENTS.SETTINGS_UPDATED, handler);
    });
  });

  describe('settings sync data flow', () => {
    it('syncs all typography settings', () => {
      const newSettings = { 
        ...DEFAULT_SETTINGS, 
        fontFamily: 'Helvetica',
        fontSize: 22,
        lineHeight: 2.0,
        paragraphSpacing: 30,
      };
      
      useReaderStore.getState().updateSettingsFromSync(newSettings);
      
      const state = useReaderStore.getState();
      expect(state.settings.fontFamily).toBe('Helvetica');
      expect(state.settings.fontSize).toBe(22);
      expect(state.settings.lineHeight).toBe(2.0);
      expect(state.settings.paragraphSpacing).toBe(30);
    });

    it('syncs all theme/color settings', () => {
      const newSettings = { 
        ...DEFAULT_SETTINGS, 
        backgroundColor: '#1a1a2e',
        textColor: '#eee',
        linkColor: '#4fc3f7',
        selectionColor: '#8e24aa',
        highlightColor: '#ffd54f',
      };
      
      useReaderStore.getState().updateSettingsFromSync(newSettings);
      
      const state = useReaderStore.getState();
      expect(state.settings.backgroundColor).toBe('#1a1a2e');
      expect(state.settings.textColor).toBe('#eee');
      expect(state.settings.linkColor).toBe('#4fc3f7');
      expect(state.settings.selectionColor).toBe('#8e24aa');
      expect(state.settings.highlightColor).toBe('#ffd54f');
    });

    it('syncs all speed/pacing settings', () => {
      const newSettings = { 
        ...DEFAULT_SETTINGS, 
        baseWPM: 450,
        targetWPM: 500,
        rampEnabled: true,
        rampStep: 20,
        rampInterval: 120,
        activeMode: 'rsvp' as const,
      };
      
      useReaderStore.getState().updateSettingsFromSync(newSettings);
      
      const state = useReaderStore.getState();
      expect(state.settings.baseWPM).toBe(450);
      expect(state.settings.targetWPM).toBe(500);
      expect(state.settings.rampEnabled).toBe(true);
      expect(state.settings.rampStep).toBe(20);
      expect(state.settings.rampInterval).toBe(120);
      expect(state.settings.activeMode).toBe('rsvp');
    });

    it('syncs all pacing mode settings', () => {
      const newSettings = { 
        ...DEFAULT_SETTINGS, 
        pacingGranularity: 'sentence' as const,
        pacingHighlightStyle: 'underline' as const,
        pacingDimContext: true,
        pacingShowGuide: false,
        pacingPauseOnPunctuation: false,
        pacingBoldFocusLetter: true,
        pacingAdaptiveSpeed: false,
        pacingReadabilitySpeed: false,
      };
      
      useReaderStore.getState().updateSettingsFromSync(newSettings);
      
      const state = useReaderStore.getState();
      expect(state.settings.pacingGranularity).toBe('sentence');
      expect(state.settings.pacingHighlightStyle).toBe('underline');
      expect(state.settings.pacingDimContext).toBe(true);
      expect(state.settings.pacingShowGuide).toBe(false);
      expect(state.settings.pacingPauseOnPunctuation).toBe(false);
      expect(state.settings.pacingBoldFocusLetter).toBe(true);
      expect(state.settings.pacingAdaptiveSpeed).toBe(false);
      expect(state.settings.pacingReadabilitySpeed).toBe(false);
    });

    it('syncs bionic reading settings', () => {
      const newSettings = { 
        ...DEFAULT_SETTINGS, 
        bionicIntensity: 0.9,
        bionicProportion: 0.6,
      };
      
      useReaderStore.getState().updateSettingsFromSync(newSettings);
      
      const state = useReaderStore.getState();
      expect(state.settings.bionicIntensity).toBe(0.9);
      expect(state.settings.bionicProportion).toBe(0.6);
    });
  });
});
