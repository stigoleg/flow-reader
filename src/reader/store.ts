import { create } from 'zustand';
import type { FlowDocument, ReaderSettings, ReadingMode } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { getSettings, saveSettings, savePosition, getPosition, isExitConfirmationDismissed, dismissExitConfirmation, saveCurrentDocument } from '@/lib/storage';
import { addRecent, mapSourceToType, getSourceLabel, shouldCacheDocument, calculateProgress, updateLastOpened } from '@/lib/recents-service';

// =============================================================================
// DEBOUNCE CONFIG FOR POSITION SAVING
// =============================================================================

/** Debounce delay for position saves (1 second) */
const POSITION_SAVE_DEBOUNCE_MS = 1000;

/** Module-level debounce timer for position saving */
let positionSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** The actual position save function that will be called after debounce */
let pendingSavePosition: (() => Promise<void>) | null = null;

interface ReaderState {
  // Document
  document: FlowDocument | null;
  archiveItemId: string | null;  // ID of the archive item for progress updates
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
  
  // Chapter navigation (for books)
  currentChapterIndex: number;
  isTocOpen: boolean;

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
  
  // Reading time tracking
  accumulatedReadingTime: number;  // Total ms spent reading (persisted)
  playStartTime: number | null;     // When current play session started

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
  updateSettingsFromSync: (settings: ReaderSettings) => void;
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
  
  // Chapter navigation (for books)
  setChapter: (chapterIndex: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  setTocOpen: (open: boolean) => void;
  toggleToc: () => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  // Initial state
  document: null,
  archiveItemId: null,
  isLoading: true,
  error: null,
  currentBlockIndex: 0,
  currentCharOffset: 0,
  currentSentenceIndex: 0,
  currentWordIndex: 0,
  currentRsvpIndex: 0,
  rsvpTokenCount: 0,
  currentChapterIndex: 0,
  isTocOpen: false,
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
  accumulatedReadingTime: 0,
  playStartTime: null,

  // Actions
  setDocument: (doc) => {
    // For books, ensure blocks point to the first chapter
    let finalDoc = doc;
    if (doc?.book && doc.book.chapters.length > 0) {
      const firstChapter = doc.book.chapters[0];
      finalDoc = {
        ...doc,
        blocks: firstChapter.blocks,
        plainText: firstChapter.plainText,
      };
    }
    
    set({ 
      document: finalDoc, 
      isLoading: false,
      currentBlockIndex: 0,
      currentChapterIndex: 0,
      currentSentenceIndex: 0,
      currentWordIndex: 0,
      currentRsvpIndex: 0,
    });
    
    // Add to recent documents and save as current document for refresh persistence
    if (doc) {
      // For non-web sources, cache the full document so it can be reopened
      // Web sources can be re-extracted from their URL
      const cache = shouldCacheDocument(doc.metadata.source);
      
      addRecent({
        type: mapSourceToType(doc.metadata.source),
        title: doc.metadata.title,
        sourceLabel: getSourceLabel(doc.metadata),
        url: doc.metadata.url,
        author: doc.metadata.author,
        cachedDocument: cache ? doc : undefined,
        fileHash: doc.metadata.fileHash,
      }).then((item) => {
        // Store the archive item ID for progress updates
        set({ archiveItemId: item.id });
      }).catch((err) => {
        console.error('Failed to add to archive:', err);
      });
      
      // Save current document to storage so it survives page refresh
      saveCurrentDocument(doc);
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
      currentRsvpIndex: 0,
      // Reset reading time when position is explicitly set (e.g., "Read Again")
      accumulatedReadingTime: 0,
      playStartTime: null,
    }),

  togglePlay: () => set((state) => {
    if (state.isPlaying) {
      // Pausing: accumulate the time from this session
      const sessionTime = state.playStartTime ? Date.now() - state.playStartTime : 0;
      return {
        isPlaying: false,
        playStartTime: null,
        accumulatedReadingTime: state.accumulatedReadingTime + sessionTime,
      };
    } else {
      // Starting: record when this play session started
      return {
        isPlaying: true,
        playStartTime: Date.now(),
      };
    }
  }),

  setPlaying: (playing) => set((state) => {
    if (playing && !state.isPlaying) {
      // Starting playback
      return { isPlaying: true, playStartTime: Date.now() };
    } else if (!playing && state.isPlaying) {
      // Stopping playback - accumulate time
      const sessionTime = state.playStartTime ? Date.now() - state.playStartTime : 0;
      return {
        isPlaying: false,
        playStartTime: null,
        accumulatedReadingTime: state.accumulatedReadingTime + sessionTime,
      };
    }
    return { isPlaying: playing };
  }),

  setWPM: (wpm) => {
    const clampedWPM = Math.max(50, Math.min(1000, wpm));
    const newSettings = { ...get().settings, baseWPM: clampedWPM };
    set({ currentWPM: clampedWPM, settings: newSettings });
    // Persist to storage so WPM is remembered across sessions
    saveSettings(newSettings);
  },

  adjustWPM: (delta) => {
    const { currentWPM, settings } = get();
    const clampedWPM = Math.max(50, Math.min(1000, currentWPM + delta));
    const newSettings = { ...settings, baseWPM: clampedWPM };
    set({ currentWPM: clampedWPM, settings: newSettings });
    // Persist to storage so WPM is remembered across sessions
    saveSettings(newSettings);
  },

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

  /**
   * Update settings from sync without re-saving to storage.
   * This prevents infinite loops when sync applies remote settings.
   */
  updateSettingsFromSync: (newSettings) => {
    set({ 
      settings: newSettings,
      currentWPM: newSettings.baseWPM,
    });
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

  startReading: () => {
    // Start tracking time if not already playing
    const { playStartTime } = get();
    if (!playStartTime) {
      set({ playStartTime: Date.now() });
    }
  },

  showCompletion: () => {
    // Accumulate any remaining time and show completion
    const { playStartTime, accumulatedReadingTime } = get();
    const sessionTime = playStartTime ? Date.now() - playStartTime : 0;
    set({
      isCompletionOpen: true,
      isPlaying: false,
      playStartTime: null,
      accumulatedReadingTime: accumulatedReadingTime + sessionTime,
    });
  },

  // Position persistence (debounced to prevent excessive writes during reading)
  saveCurrentPosition: async () => {
    const { document } = get();
    if (!document) return;
    
    // Create the save function with current state captured
    const doSave = async () => {
      // Re-get fresh state at save time for most accurate reading time
      const freshState = get();
      const freshSessionTime = freshState.playStartTime ? Date.now() - freshState.playStartTime : 0;
      const freshTotalReadingTime = freshState.accumulatedReadingTime + freshSessionTime;
      
      const position = {
        blockIndex: freshState.currentBlockIndex,
        charOffset: freshState.currentCharOffset,
        timestamp: Date.now(),
        // Extended position for precise restoration
        wordIndex: freshState.currentWordIndex,
        sentenceIndex: freshState.currentSentenceIndex,
        rsvpIndex: freshState.currentRsvpIndex,
        chapterIndex: freshState.currentChapterIndex,
        activeMode: freshState.settings.activeMode,
        accumulatedReadingTime: freshTotalReadingTime,
      };
      
      if (freshState.document) {
        await savePosition(freshState.document.metadata, position);
        
        // Also update the archive item with progress
        if (freshState.archiveItemId) {
          const chapterInfo = freshState.document.book ? {
            currentChapter: freshState.currentChapterIndex,
            totalChapters: freshState.document.book.chapters.length,
          } : undefined;
          
          const progress = calculateProgress(
            freshState.currentBlockIndex,
            freshState.document.blocks.length,
            chapterInfo
          );
          
          updateLastOpened(freshState.archiveItemId, position, progress).catch((err) => {
            console.error('Failed to update archive progress:', err);
          });
        }
      }
    };
    
    // Clear any pending save timer
    if (positionSaveTimer) {
      clearTimeout(positionSaveTimer);
    }
    
    // Store the pending save function
    pendingSavePosition = doSave;
    
    // Schedule the debounced save
    positionSaveTimer = setTimeout(async () => {
      if (pendingSavePosition) {
        await pendingSavePosition();
        pendingSavePosition = null;
      }
      positionSaveTimer = null;
    }, POSITION_SAVE_DEBOUNCE_MS);
  },

  restorePosition: async () => {
    const { document, setChapter } = get();
    if (!document) return;
    
    const position = await getPosition(document.metadata);
    if (position) {
      // Restore chapter first if this is a book
      if (document.book && position.chapterIndex !== undefined && position.chapterIndex > 0) {
        setChapter(position.chapterIndex);
      }
      
      // Re-get document after setChapter to get updated blocks
      const { document: updatedDoc } = get();
      
      // Then restore block position within the chapter
      if (updatedDoc && position.blockIndex < updatedDoc.blocks.length) {
        set({
          currentBlockIndex: position.blockIndex,
          currentCharOffset: position.charOffset,
          // Restore extended position fields (defaults for backwards compatibility)
          currentSentenceIndex: position.sentenceIndex ?? 0,
          currentWordIndex: position.wordIndex ?? 0,
          currentRsvpIndex: position.rsvpIndex ?? 0,
          accumulatedReadingTime: position.accumulatedReadingTime ?? 0,
        });
      }
    }
  },

  // Block navigation
  nextBlock: () => {
    const { document, currentBlockIndex, saveCurrentPosition } = get();
    if (document && currentBlockIndex < document.blocks.length - 1) {
      set({ 
        currentBlockIndex: currentBlockIndex + 1, 
        currentCharOffset: 0,
        currentSentenceIndex: 0,
        currentWordIndex: 0,
      });
      // Save position for sync (will be debounced)
      saveCurrentPosition();
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

  // Chapter navigation (for books)
  setChapter: (chapterIndex: number) => {
    const { document, saveCurrentPosition } = get();
    if (!document?.book) return;
    
    const chapters = document.book.chapters;
    if (chapterIndex < 0 || chapterIndex >= chapters.length) return;
    
    // Save position before switching
    saveCurrentPosition();
    
    // Update document blocks to show the new chapter's content
    const chapter = chapters[chapterIndex];
    set({
      currentChapterIndex: chapterIndex,
      currentBlockIndex: 0,
      currentCharOffset: 0,
      currentSentenceIndex: 0,
      currentWordIndex: 0,
      currentRsvpIndex: 0,
      // Update the document's blocks to the current chapter
      document: {
        ...document,
        blocks: chapter.blocks,
        plainText: chapter.plainText,
      },
    });
  },

  nextChapter: () => {
    const { document, currentChapterIndex, setChapter } = get();
    if (!document?.book) return;
    
    if (currentChapterIndex < document.book.chapters.length - 1) {
      setChapter(currentChapterIndex + 1);
    }
  },

  prevChapter: () => {
    const { currentChapterIndex, setChapter } = get();
    if (currentChapterIndex > 0) {
      setChapter(currentChapterIndex - 1);
    }
  },

  setTocOpen: (open: boolean) => set({ isTocOpen: open }),
  
  toggleToc: () => set((state) => ({ isTocOpen: !state.isTocOpen })),
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

/** Select chapter navigation state (for book documents) */
export const selectCurrentChapterIndex = (state: ReaderState) => state.currentChapterIndex;
export const selectIsTocOpen = (state: ReaderState) => state.isTocOpen;
