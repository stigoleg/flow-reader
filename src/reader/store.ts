import { create } from 'zustand';
import type { FlowDocument, ReaderSettings, ReadingMode } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { getSettings, saveSettings, savePosition, getPosition, addRecentDocument, isExitConfirmationDismissed, dismissExitConfirmation } from '@/lib/storage';

interface ReaderState {
  // Document
  document: FlowDocument | null;
  isLoading: boolean;
  error: string | null;

  // Reading position
  currentBlockIndex: number;
  currentCharOffset: number;
  
  // Sub-block position tracking for sentence/word pacing
  currentSentenceIndex: number;
  currentWordIndex: number;
  
  // RSVP mode position tracking
  currentRsvpIndex: number;
  rsvpTokenCount: number;

  // Playback
  isPlaying: boolean;
  currentWPM: number;

  // Settings
  settings: ReaderSettings;
  settingsLoaded: boolean;

  // UI state
  isSettingsOpen: boolean;
  isImportOpen: boolean;
  isHelpOpen: boolean;
  isCompletionOpen: boolean;
  isExitConfirmOpen: boolean;
  exitConfirmationDismissed: boolean;
  readingStartTime: number | null;

  // Actions
  setDocument: (doc: FlowDocument | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPosition: (blockIndex: number, charOffset?: number) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setWPM: (wpm: number) => void;
  adjustWPM: (delta: number) => void;
  setMode: (mode: ReadingMode) => void;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  loadSettings: () => Promise<void>;
  toggleSettings: () => void;
  setImportOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setCompletionOpen: (open: boolean) => void;
  setExitConfirmOpen: (open: boolean) => void;
  closeReader: () => void;
  confirmCloseReader: (dontShowAgain: boolean) => void;
  startReading: () => void;
  showCompletion: () => void;
  
  // Position persistence
  saveCurrentPosition: () => Promise<void>;
  restorePosition: () => Promise<void>;
  
  // Block navigation
  nextBlock: () => void;
  prevBlock: () => void;
  
  // Sentence navigation
  setSentenceIndex: (index: number) => void;
  nextSentence: () => void;
  prevSentence: () => void;
  resetSentenceIndex: () => void;
  
  // Word navigation
  setWordIndex: (index: number) => void;
  nextWord: () => void;
  prevWord: () => void;
  resetWordIndex: () => void;
  
  // RSVP navigation
  setRsvpIndex: (index: number) => void;
  setRsvpTokenCount: (count: number) => void;
  rsvpAdvance: () => void;
  rsvpRetreat: () => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  // Initial state
  document: null,
  isLoading: true,
  error: null,
  currentBlockIndex: 0,
  currentCharOffset: 0,
  currentSentenceIndex: 0,
  currentWordIndex: 0,
  currentRsvpIndex: 0,
  rsvpTokenCount: 0,
  isPlaying: false,
  currentWPM: DEFAULT_SETTINGS.baseWPM,
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  isSettingsOpen: false,
  isImportOpen: false,
  isHelpOpen: false,
  isCompletionOpen: false,
  isExitConfirmOpen: false,
  exitConfirmationDismissed: false,
  readingStartTime: null,

  // Actions
  setDocument: (doc) => {
    set({ 
      document: doc, 
      isLoading: false,
      currentBlockIndex: 0,
      currentSentenceIndex: 0,
      currentWordIndex: 0,
      currentRsvpIndex: 0,
    });
    
    // Add to recent documents
    if (doc) {
      const preview = doc.plainText.slice(0, 150).trim() + (doc.plainText.length > 150 ? '...' : '');
      // For non-web sources, cache the full document so it can be reopened
      // Web sources can be re-extracted from their URL
      const shouldCache = doc.metadata.source !== 'web' && doc.metadata.source !== 'selection';
      addRecentDocument({
        id: doc.metadata.url || `doc_${doc.metadata.createdAt}`,
        title: doc.metadata.title,
        source: doc.metadata.source,
        timestamp: Date.now(),
        preview,
        url: doc.metadata.url,
        cachedDocument: shouldCache ? doc : undefined,
      });
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  setPosition: (blockIndex, charOffset = 0) =>
    set({ 
      currentBlockIndex: blockIndex, 
      currentCharOffset: charOffset,
      currentSentenceIndex: 0,
      currentWordIndex: 0,
    }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setPlaying: (playing) => set({ isPlaying: playing }),

  setWPM: (wpm) => set({ currentWPM: Math.max(50, Math.min(1000, wpm)) }),

  adjustWPM: (delta) =>
    set((state) => ({
      currentWPM: Math.max(50, Math.min(1000, state.currentWPM + delta)),
    })),

  setMode: (mode) => {
    const newSettings = { ...get().settings, activeMode: mode };
    set({
      settings: newSettings,
      // Reset sub-block positions when changing mode
      currentSentenceIndex: 0,
      currentWordIndex: 0,
    });
    // Persist to storage
    saveSettings(newSettings);
  },

  updateSettings: (newSettings) => {
    const merged = { ...get().settings, ...newSettings };
    set({ settings: merged });
    // Persist to storage
    saveSettings(merged);
  },

  loadSettings: async () => {
    try {
      const storedSettings = await getSettings();
      set({ 
        settings: storedSettings, 
        currentWPM: storedSettings.baseWPM,
        settingsLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ settingsLoaded: true });
    }
  },

  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  setImportOpen: (open) => set({ isImportOpen: open }),

  setHelpOpen: (open) => set({ isHelpOpen: open }),

  setCompletionOpen: (open) => set({ isCompletionOpen: open }),

  setExitConfirmOpen: (open) => set({ isExitConfirmOpen: open }),

  closeReader: async () => {
    // Check if user has dismissed the exit confirmation
    const dismissed = await isExitConfirmationDismissed();
    if (dismissed) {
      window.close();
    } else {
      set({ isExitConfirmOpen: true });
    }
  },

  confirmCloseReader: async (dontShowAgain) => {
    if (dontShowAgain) {
      await dismissExitConfirmation();
    }
    window.close();
  },

  startReading: () => set({ readingStartTime: Date.now() }),

  showCompletion: () => set({ isCompletionOpen: true, isPlaying: false }),

  // Position persistence
  saveCurrentPosition: async () => {
    const { document, currentBlockIndex, currentCharOffset } = get();
    if (!document?.metadata.url) return;
    
    await savePosition(document.metadata.url, {
      blockIndex: currentBlockIndex,
      charOffset: currentCharOffset,
      timestamp: Date.now(),
    });
  },

  restorePosition: async () => {
    const { document } = get();
    if (!document?.metadata.url) return;
    
    const position = await getPosition(document.metadata.url);
    if (position && position.blockIndex < document.blocks.length) {
      set({
        currentBlockIndex: position.blockIndex,
        currentCharOffset: position.charOffset,
        currentSentenceIndex: 0,
        currentWordIndex: 0,
      });
    }
  },

  // Block navigation
  nextBlock: () => {
    const { document, currentBlockIndex } = get();
    if (document && currentBlockIndex < document.blocks.length - 1) {
      set({ 
        currentBlockIndex: currentBlockIndex + 1, 
        currentCharOffset: 0,
        currentSentenceIndex: 0,
        currentWordIndex: 0,
      });
    }
  },

  prevBlock: () => {
    const { currentBlockIndex } = get();
    if (currentBlockIndex > 0) {
      set({ 
        currentBlockIndex: currentBlockIndex - 1, 
        currentCharOffset: 0,
        currentSentenceIndex: 0,
        currentWordIndex: 0,
      });
    }
  },

  // Sentence navigation
  setSentenceIndex: (index) => set({ currentSentenceIndex: index }),
  
  nextSentence: () => {
    set((state) => ({ currentSentenceIndex: state.currentSentenceIndex + 1 }));
  },
  
  prevSentence: () => {
    const { currentSentenceIndex } = get();
    if (currentSentenceIndex > 0) {
      set({ currentSentenceIndex: currentSentenceIndex - 1 });
    }
  },
  
  resetSentenceIndex: () => set({ currentSentenceIndex: 0 }),

  // Word navigation
  setWordIndex: (index) => set({ currentWordIndex: index }),
  
  nextWord: () => {
    set((state) => ({ currentWordIndex: state.currentWordIndex + 1 }));
  },
  
  prevWord: () => {
    const { currentWordIndex } = get();
    if (currentWordIndex > 0) {
      set({ currentWordIndex: currentWordIndex - 1 });
    }
  },
  
  resetWordIndex: () => set({ currentWordIndex: 0 }),

  // RSVP navigation
  setRsvpIndex: (index) => set({ currentRsvpIndex: index }),
  
  setRsvpTokenCount: (count) => set({ rsvpTokenCount: count }),
  
  rsvpAdvance: () => {
    const { currentRsvpIndex, rsvpTokenCount, showCompletion } = get();
    if (currentRsvpIndex >= rsvpTokenCount - 1) {
      showCompletion();
    } else {
      set({ currentRsvpIndex: currentRsvpIndex + 1 });
    }
  },
  
  rsvpRetreat: () => {
    const { currentRsvpIndex } = get();
    if (currentRsvpIndex > 0) {
      set({ currentRsvpIndex: currentRsvpIndex - 1 });
    }
  },
}));

// =============================================================================
// SELECTORS
// =============================================================================
// Use these selectors with useReaderStore(selector) to minimize re-renders.
// Components will only re-render when the selected values change.

/** Select document and loading state */
export const selectDocument = (state: ReaderState) => state.document;
export const selectIsLoading = (state: ReaderState) => state.isLoading;
export const selectError = (state: ReaderState) => state.error;

/** Select settings */
export const selectSettings = (state: ReaderState) => state.settings;
export const selectSettingsLoaded = (state: ReaderState) => state.settingsLoaded;

/** Select individual UI panel states (for components that only care about one) */
export const selectIsSettingsOpen = (state: ReaderState) => state.isSettingsOpen;
export const selectIsImportOpen = (state: ReaderState) => state.isImportOpen;
export const selectIsHelpOpen = (state: ReaderState) => state.isHelpOpen;
export const selectIsCompletionOpen = (state: ReaderState) => state.isCompletionOpen;
export const selectIsExitConfirmOpen = (state: ReaderState) => state.isExitConfirmOpen;
