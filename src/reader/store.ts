import { create } from 'zustand';
import type { FlowDocument, ReaderSettings, ReadingMode, Annotation, AnnotationAnchor } from '@/types';
import { DEFAULT_SETTINGS, HIGHLIGHT_COLORS } from '@/types';
import { getSettings, saveSettings, savePosition, getPosition, isExitConfirmationDismissed, dismissExitConfirmation, saveCurrentDocument } from '@/lib/storage';
import { addRecent, mapSourceToType, getSourceLabel, shouldCacheDocument, calculateProgress, updateLastOpened, updateArchiveItem } from '@/lib/recents-service';
import { pacingToWordCount, wordCountToRsvpIndex, rsvpIndexToWordCount, wordCountToPacing } from '@/lib/position-utils';
import { 
  getAnnotations, 
  saveAnnotation, 
  updateAnnotation, 
  deleteAnnotation, 
  createAnnotation,
  getDocumentAnnotationKey,
} from '@/lib/annotations-service';
import { recordReadingSession } from '@/lib/stats-service';
import { countWords } from '@/lib/file-utils';
import { searchDocument, getNextMatchIndex, getPrevMatchIndex, type SearchMatch } from '@/lib/search-utils';


const POSITION_SAVE_DEBOUNCE_MS = 1000;
const SETTINGS_SAVE_DEBOUNCE_MS = 500;

let positionSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSavePosition: (() => Promise<void>) | null = null;

let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettings: ReaderSettings | null = null;

/**
 * Debounced settings save to prevent storage thrashing when rapidly adjusting WPM.
 * Coalesces multiple saves into one after the debounce period.
 */
function debouncedSaveSettings(settings: ReaderSettings): void {
  pendingSettings = settings;
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer);
  }
  settingsSaveTimer = setTimeout(() => {
    if (pendingSettings) {
      saveSettings(pendingSettings).catch((err) => {
        console.error('[ReaderStore] Failed to save settings:', err);
      });
      pendingSettings = null;
    }
    settingsSaveTimer = null;
  }, SETTINGS_SAVE_DEBOUNCE_MS);
}

/**
 * Record a reading session for statistics.
 * Called when playback stops (pause, completion, or document close).
 * Fire-and-forget - errors are logged but don't affect the reader.
 */
function recordSessionStats(params: {
  sessionTimeMs: number;
  wpm: number;
  archiveItemId: string | null;
  progress: number; // 0-100
}): void {
  const { sessionTimeMs, wpm, archiveItemId, progress } = params;
  
  // Skip very short sessions
  if (sessionTimeMs < 5000 || !archiveItemId) {
    return;
  }
  
  // Estimate words read based on time and WPM
  const wordsRead = Math.round((sessionTimeMs / 60000) * wpm);
  const completed = progress >= 100;
  
  // Fire and forget - don't await
  recordReadingSession({
    durationMs: sessionTimeMs,
    wordsRead,
    documentId: archiveItemId,
    completed,
    wpm,
  }).catch(err => {
    console.error('[ReaderStore] Failed to record session stats:', err);
  });
}

interface ReaderState {
  document: FlowDocument | null;
  archiveItemId: string | null;
  isLoading: boolean;
  error: string | null;

  currentBlockIndex: number;
  currentCharOffset: number;
  
  currentSentenceIndex: number;
  currentWordIndex: number;
  
  currentRsvpIndex: number;
  rsvpTokenCount: number;
  
  currentChapterIndex: number;
  isTocOpen: boolean;

  isPlaying: boolean;
  currentWPM: number;

  settings: ReaderSettings;
  settingsLoaded: boolean;

  isSettingsOpen: boolean;
  isImportOpen: boolean;
  isHelpOpen: boolean;
  isCompletionOpen: boolean;
  isExitConfirmOpen: boolean;
  exitConfirmationDismissed: boolean;
  
  accumulatedReadingTime: number;
  playStartTime: number | null;

  // Annotations state
  annotations: Annotation[];
  annotationsLoaded: boolean;
  documentKey: string | null;
  activeHighlightColor: string;
  editingAnnotationId: string | null;
  isNoteEditorOpen: boolean;
  isNotesPanelOpen: boolean;
  
  // Scroll-only navigation (doesn't change reading position)
  scrollToBlockIndex: number | null;

  // Search state
  isSearchOpen: boolean;
  searchQuery: string;
  searchResults: SearchMatch[];
  currentSearchIndex: number;
  /** Chapter to scroll to for cross-chapter search results (doesn't change reading chapter) */
  searchScrollChapterIndex: number | null;

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
  
  saveCurrentPosition: () => Promise<void>;
  restorePosition: () => Promise<void>;
  
  nextBlock: () => void;
  prevBlock: () => void;
  
  setSentenceIndex: (index: number) => void;
  nextSentence: () => void;
  prevSentence: () => void;
  resetSentenceIndex: () => void;
  
  setWordIndex: (index: number) => void;
  nextWord: () => void;
  prevWord: () => void;
  resetWordIndex: () => void;
  
  setRsvpIndex: (index: number) => void;
  setRsvpTokenCount: (count: number) => void;
  rsvpAdvance: () => void;
  rsvpRetreat: () => void;
  
  setChapter: (chapterIndex: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  setTocOpen: (open: boolean) => void;
  toggleToc: () => void;
  renameDocument: (newTitle: string) => Promise<void>;
  
  // Annotation actions
  loadAnnotations: () => Promise<void>;
  addAnnotation: (anchor: AnnotationAnchor, color: string, note?: string) => Promise<Annotation>;
  updateAnnotationNote: (id: string, note: string) => Promise<void>;
  changeAnnotationColor: (id: string, color: string) => Promise<void>;
  removeAnnotation: (id: string) => Promise<void>;
  setActiveHighlightColor: (color: string) => void;
  setEditingAnnotation: (id: string | null) => void;
  setNoteEditorOpen: (open: boolean) => void;
  setNotesPanelOpen: (open: boolean) => void;
  toggleNotesPanel: () => void;
  navigateToAnnotation: (annotation: Annotation) => void;
  scrollToAnnotation: (annotation: Annotation) => void;
  clearScrollToBlock: () => void;

  // Search actions
  toggleSearch: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  nextSearchResult: () => void;
  prevSearchResult: () => void;
  clearSearch: () => void;
  goToSearchResult: (index: number) => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
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
  
  // Annotations initial state
  annotations: [],
  annotationsLoaded: false,
  documentKey: null,
  activeHighlightColor: HIGHLIGHT_COLORS[0].color,
  editingAnnotationId: null,
  isNoteEditorOpen: false,
  isNotesPanelOpen: false,
  scrollToBlockIndex: null,

  // Search initial state
  isSearchOpen: false,
  searchQuery: '',
  searchResults: [],
  currentSearchIndex: -1,
  searchScrollChapterIndex: null,

  setDocument: (doc) => {
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
    
    if (doc) {
      const cache = shouldCacheDocument(doc.metadata.source);
      const wordCount = countWords(doc.plainText);
      
      addRecent({
        type: mapSourceToType(doc.metadata.source),
        title: doc.metadata.title,
        sourceLabel: getSourceLabel(doc.metadata),
        url: doc.metadata.url,
        author: doc.metadata.author,
        cachedDocument: cache ? doc : undefined,
        fileHash: doc.metadata.fileHash,
        wordCount,
      }).then((item) => {
        set({ archiveItemId: item.id });
      }).catch((err) => {
        console.error('Failed to add to archive:', err);
      });
      
      // Save current document for refresh persistence
      saveCurrentDocument(doc).catch((err) => {
        console.error('Failed to save current document for refresh persistence:', err);
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
      currentRsvpIndex: 0,
      accumulatedReadingTime: 0,
      playStartTime: null,
    }),

  togglePlay: () => {
    const state = get();
    if (state.isPlaying) {
      const sessionTime = state.playStartTime ? Date.now() - state.playStartTime : 0;
      
      // Record session stats
      const progress = state.document 
        ? calculateProgress(state.currentBlockIndex, state.document.blocks.length).percent
        : 0;
      recordSessionStats({
        sessionTimeMs: sessionTime,
        wpm: state.currentWPM,
        archiveItemId: state.archiveItemId,
        progress,
      });
      
      set({
        isPlaying: false,
        playStartTime: null,
        accumulatedReadingTime: state.accumulatedReadingTime + sessionTime,
      });
    } else {
      set({
        isPlaying: true,
        playStartTime: Date.now(),
      });
    }
  },

  setPlaying: (playing) => {
    const state = get();
    if (playing && !state.isPlaying) {
      set({ isPlaying: true, playStartTime: Date.now() });
    } else if (!playing && state.isPlaying) {
      const sessionTime = state.playStartTime ? Date.now() - state.playStartTime : 0;
      
      // Record session stats
      const progress = state.document 
        ? calculateProgress(state.currentBlockIndex, state.document.blocks.length).percent
        : 0;
      recordSessionStats({
        sessionTimeMs: sessionTime,
        wpm: state.currentWPM,
        archiveItemId: state.archiveItemId,
        progress,
      });
      
      set({
        isPlaying: false,
        playStartTime: null,
        accumulatedReadingTime: state.accumulatedReadingTime + sessionTime,
      });
    } else {
      set({ isPlaying: playing });
    }
  },

  setWPM: (wpm) => {
    const clampedWPM = Math.max(50, Math.min(1000, wpm));
    const newSettings = { ...get().settings, baseWPM: clampedWPM };
    set({ currentWPM: clampedWPM, settings: newSettings });
    debouncedSaveSettings(newSettings);
  },

  adjustWPM: (delta) => {
    const { currentWPM, settings } = get();
    const clampedWPM = Math.max(50, Math.min(1000, currentWPM + delta));
    const newSettings = { ...settings, baseWPM: clampedWPM };
    set({ currentWPM: clampedWPM, settings: newSettings });
    debouncedSaveSettings(newSettings);
  },

  setMode: (mode) => {
    const { 
      settings, 
      document, 
      currentBlockIndex, 
      currentWordIndex, 
      currentRsvpIndex,
      currentChapterIndex,
    } = get();
    
    const newSettings = { ...settings, activeMode: mode };
    
    // If no document or same mode, just update settings
    if (!document || settings.activeMode === mode) {
      set({ settings: newSettings });
      saveSettings(newSettings);
      return;
    }
    
    // Get the blocks for the current chapter (or document if no chapters)
    const blocks = document.book?.chapters?.[currentChapterIndex]?.blocks ?? document.blocks;
    
    // Convert current position to cumulative word count
    let wordCount: number;
    if (settings.activeMode === 'rsvp') {
      // Converting FROM RSVP: use rsvpIndex to calculate word position
      wordCount = rsvpIndexToWordCount(currentRsvpIndex, settings.rsvpChunkSize);
    } else {
      // Converting FROM pacing/bionic: use block + word position
      wordCount = pacingToWordCount(blocks, currentBlockIndex, currentWordIndex);
    }
    
    // Convert word count to the new mode's position system
    if (mode === 'rsvp') {
      // Converting TO RSVP
      const rsvpIndex = wordCountToRsvpIndex(wordCount, newSettings.rsvpChunkSize);
      set({ 
        settings: newSettings,
        currentRsvpIndex: rsvpIndex,
      });
    } else {
      // Converting TO pacing/bionic
      const { blockIndex, wordIndex } = wordCountToPacing(blocks, wordCount);
      set({
        settings: newSettings,
        currentBlockIndex: blockIndex,
        currentWordIndex: wordIndex,
        currentSentenceIndex: 0, // Sentence granularity resets (could be enhanced)
      });
    }
    
    saveSettings(newSettings);
  },

  updateSettings: (newSettings) => {
    const merged = { ...get().settings, ...newSettings };
    set({ settings: merged });
    saveSettings(merged);
  },

  /** Update settings from sync without re-saving (prevents infinite loops) */
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
    const { playStartTime } = get();
    if (!playStartTime) {
      set({ playStartTime: Date.now() });
    }
  },

  showCompletion: () => {
    const state = get();
    const sessionTime = state.playStartTime ? Date.now() - state.playStartTime : 0;
    
    // Record session stats with completion flag
    recordSessionStats({
      sessionTimeMs: sessionTime,
      wpm: state.currentWPM,
      archiveItemId: state.archiveItemId,
      progress: 100, // Completed
    });
    
    // Update archive item with 100% progress
    // This ensures the archive shows 100% when reading is complete
    if (state.archiveItemId) {
      updateLastOpened(state.archiveItemId, undefined, { 
        percent: 100, 
        label: '100%' 
      }).catch((err) => {
        console.error('Failed to update archive completion progress:', err);
      });
    }
    
    // Stop playback immediately
    set({
      isPlaying: false,
      playStartTime: null,
      accumulatedReadingTime: state.accumulatedReadingTime + sessionTime,
    });
    
    // Show completion overlay after 1 second delay
    // This ensures the reader has finished processing the last content
    setTimeout(() => {
      set({ isCompletionOpen: true });
    }, 1000);
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

  renameDocument: async (newTitle: string) => {
    const { document, archiveItemId } = get();
    if (!document || !newTitle.trim()) return;
    
    const trimmedTitle = newTitle.trim();
    
    // Update the document in state
    const updatedDoc: FlowDocument = {
      ...document,
      metadata: {
        ...document.metadata,
        title: trimmedTitle,
      },
    };
    set({ document: updatedDoc });
    
    try {
      // Update the current document in storage
      await saveCurrentDocument(updatedDoc);
      
      // Update the archive item if we have one
      if (archiveItemId) {
        await updateArchiveItem(archiveItemId, { title: trimmedTitle });
      }
    } catch (err) {
      console.error('[ReaderStore] Failed to save renamed document:', err);
      // Note: State is already updated, storage will eventually sync on next save
    }
  },

  // Annotation actions
  loadAnnotations: async () => {
    const { document } = get();
    if (!document) {
      set({ annotations: [], annotationsLoaded: true, documentKey: null });
      return;
    }
    
    try {
      const docKey = getDocumentAnnotationKey(document.metadata);
      const annotations = await getAnnotations(docKey);
      set({ 
        annotations, 
        annotationsLoaded: true, 
        documentKey: docKey,
      });
    } catch (err) {
      console.error('[ReaderStore] Failed to load annotations:', err);
      set({ annotations: [], annotationsLoaded: true });
    }
  },

  addAnnotation: async (anchor, color, note) => {
    const { documentKey, annotations } = get();
    if (!documentKey) {
      throw new Error('No document loaded');
    }
    
    const annotation = createAnnotation(anchor, color, note);
    await saveAnnotation(documentKey, annotation);
    
    set({ annotations: [...annotations, annotation] });
    return annotation;
  },

  updateAnnotationNote: async (id, note) => {
    const { documentKey, annotations } = get();
    if (!documentKey) return;
    
    const updated = await updateAnnotation(documentKey, id, { note });
    if (updated) {
      set({
        annotations: annotations.map(a => a.id === id ? updated : a),
      });
    }
  },

  changeAnnotationColor: async (id, color) => {
    const { documentKey, annotations } = get();
    if (!documentKey) return;
    
    const updated = await updateAnnotation(documentKey, id, { color });
    if (updated) {
      set({
        annotations: annotations.map(a => a.id === id ? updated : a),
      });
    }
  },

  removeAnnotation: async (id) => {
    const { documentKey, annotations } = get();
    if (!documentKey) return;
    
    const success = await deleteAnnotation(documentKey, id);
    if (success) {
      set({
        annotations: annotations.filter(a => a.id !== id),
        editingAnnotationId: null,
        isNoteEditorOpen: false,
      });
    }
  },

  setActiveHighlightColor: (color) => set({ activeHighlightColor: color }),

  setEditingAnnotation: (id) => set({ 
    editingAnnotationId: id,
    isNoteEditorOpen: id !== null,
  }),

  setNoteEditorOpen: (open) => set({ 
    isNoteEditorOpen: open,
    editingAnnotationId: open ? get().editingAnnotationId : null,
  }),

  setNotesPanelOpen: (open) => set({ isNotesPanelOpen: open }),

  toggleNotesPanel: () => set((state) => ({ isNotesPanelOpen: !state.isNotesPanelOpen })),

  navigateToAnnotation: (annotation) => {
    const { document } = get();
    if (!document) return;

    // Parse block index from annotation anchor
    const blockIndex = parseInt(annotation.anchor.blockId, 10);
    if (isNaN(blockIndex) || blockIndex < 0 || blockIndex >= document.blocks.length) {
      return;
    }

    // Set position to the block and word
    set({
      currentBlockIndex: blockIndex,
      currentWordIndex: annotation.anchor.startWordIndex,
      currentSentenceIndex: 0,
      isNotesPanelOpen: false, // Close panel after navigation
    });
  },

  scrollToAnnotation: (annotation) => {
    const { document } = get();
    if (!document) return;

    // Parse block index from annotation anchor
    const blockIndex = parseInt(annotation.anchor.blockId, 10);
    if (isNaN(blockIndex) || blockIndex < 0 || blockIndex >= document.blocks.length) {
      return;
    }

    // Only set scroll target - does NOT change reading position
    set({ scrollToBlockIndex: blockIndex });
  },

  clearScrollToBlock: () => set({ scrollToBlockIndex: null }),

  // Search actions
  toggleSearch: () => {
    const { isSearchOpen } = get();
    if (isSearchOpen) {
      // Close and clear search
      set({
        isSearchOpen: false,
        searchQuery: '',
        searchResults: [],
        currentSearchIndex: -1,
        searchScrollChapterIndex: null,
      });
    } else {
      // Open search, pause playback
      set({
        isSearchOpen: true,
        isPlaying: false,
      });
    }
  },

  openSearch: () => {
    set({
      isSearchOpen: true,
      isPlaying: false, // Pause when opening search
    });
  },

  closeSearch: () => {
    set({
      isSearchOpen: false,
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1,
      searchScrollChapterIndex: null,
    });
  },

  setSearchQuery: (query) => {
    const { document, currentChapterIndex } = get();
    if (!document) {
      set({ searchQuery: query, searchResults: [], currentSearchIndex: -1, searchScrollChapterIndex: null });
      return;
    }

    const results = searchDocument(document, query, currentChapterIndex);
    
    if (results.length > 0) {
      const firstMatch = results[0];
      const matchChapter = firstMatch.chapterIndex ?? currentChapterIndex;
      
      // If match is in current chapter, just scroll to it
      // If match is in different chapter, switch to that chapter first
      if (document.book && matchChapter !== currentChapterIndex) {
        const chapter = document.book.chapters[matchChapter];
        set({
          searchQuery: query,
          searchResults: results,
          currentSearchIndex: 0,
          searchScrollChapterIndex: matchChapter,
          // Update display blocks to show the search result's chapter
          document: {
            ...document,
            blocks: chapter.blocks,
            plainText: chapter.plainText,
          },
          currentChapterIndex: matchChapter,
          scrollToBlockIndex: firstMatch.blockIndex,
        });
      } else {
        set({
          searchQuery: query,
          searchResults: results,
          currentSearchIndex: 0,
          searchScrollChapterIndex: matchChapter,
          scrollToBlockIndex: firstMatch.blockIndex,
        });
      }
    } else {
      set({
        searchQuery: query,
        searchResults: results,
        currentSearchIndex: -1,
        searchScrollChapterIndex: null,
      });
    }
  },

  nextSearchResult: () => {
    const { document, searchResults, currentSearchIndex, currentChapterIndex } = get();
    if (searchResults.length === 0 || !document) return;

    const nextIndex = getNextMatchIndex(currentSearchIndex, searchResults.length);
    const match = searchResults[nextIndex];
    const matchChapter = match.chapterIndex ?? currentChapterIndex;
    
    // If match is in different chapter, switch to that chapter
    if (document.book && matchChapter !== currentChapterIndex) {
      const chapter = document.book.chapters[matchChapter];
      set({
        currentSearchIndex: nextIndex,
        searchScrollChapterIndex: matchChapter,
        document: {
          ...document,
          blocks: chapter.blocks,
          plainText: chapter.plainText,
        },
        currentChapterIndex: matchChapter,
        scrollToBlockIndex: match.blockIndex,
      });
    } else {
      set({
        currentSearchIndex: nextIndex,
        scrollToBlockIndex: match.blockIndex,
        searchScrollChapterIndex: matchChapter,
      });
    }
  },

  prevSearchResult: () => {
    const { document, searchResults, currentSearchIndex, currentChapterIndex } = get();
    if (searchResults.length === 0 || !document) return;

    const prevIndex = getPrevMatchIndex(currentSearchIndex, searchResults.length);
    const match = searchResults[prevIndex];
    const matchChapter = match.chapterIndex ?? currentChapterIndex;
    
    // If match is in different chapter, switch to that chapter
    if (document.book && matchChapter !== currentChapterIndex) {
      const chapter = document.book.chapters[matchChapter];
      set({
        currentSearchIndex: prevIndex,
        searchScrollChapterIndex: matchChapter,
        document: {
          ...document,
          blocks: chapter.blocks,
          plainText: chapter.plainText,
        },
        currentChapterIndex: matchChapter,
        scrollToBlockIndex: match.blockIndex,
      });
    } else {
      set({
        currentSearchIndex: prevIndex,
        scrollToBlockIndex: match.blockIndex,
        searchScrollChapterIndex: matchChapter,
      });
    }
  },

  clearSearch: () => {
    set({
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1,
      searchScrollChapterIndex: null,
    });
  },

  goToSearchResult: (index) => {
    const { document, searchResults, currentChapterIndex } = get();
    if (index < 0 || index >= searchResults.length || !document) return;

    const match = searchResults[index];
    const matchChapter = match.chapterIndex ?? currentChapterIndex;
    
    // If match is in different chapter, switch to that chapter
    if (document.book && matchChapter !== currentChapterIndex) {
      const chapter = document.book.chapters[matchChapter];
      set({
        currentSearchIndex: index,
        searchScrollChapterIndex: matchChapter,
        document: {
          ...document,
          blocks: chapter.blocks,
          plainText: chapter.plainText,
        },
        currentChapterIndex: matchChapter,
        scrollToBlockIndex: match.blockIndex,
      });
    } else {
      set({
        currentSearchIndex: index,
        scrollToBlockIndex: match.blockIndex,
        searchScrollChapterIndex: matchChapter,
      });
    }
  },
}));

// Use these selectors with useReaderStore(selector) to minimize re-renders.
// Components will only re-render when the selected values change.

/** Select document and loading state */
export const selectDocument = (state: ReaderState) => state.document;
export const selectIsLoading = (state: ReaderState) => state.isLoading;
export const selectError = (state: ReaderState) => state.error;

/** Select settings */
export const selectSettings = (state: ReaderState) => state.settings;
export const selectSettingsLoaded = (state: ReaderState) => state.settingsLoaded;

/** Select annotations */
export const selectAnnotations = (state: ReaderState) => state.annotations;
export const selectAnnotationsLoaded = (state: ReaderState) => state.annotationsLoaded;
export const selectActiveHighlightColor = (state: ReaderState) => state.activeHighlightColor;
export const selectEditingAnnotationId = (state: ReaderState) => state.editingAnnotationId;
export const selectIsNoteEditorOpen = (state: ReaderState) => state.isNoteEditorOpen;
export const selectIsNotesPanelOpen = (state: ReaderState) => state.isNotesPanelOpen;

/** Select search state */
export const selectIsSearchOpen = (state: ReaderState) => state.isSearchOpen;
export const selectSearchQuery = (state: ReaderState) => state.searchQuery;
export const selectSearchResults = (state: ReaderState) => state.searchResults;
export const selectCurrentSearchIndex = (state: ReaderState) => state.currentSearchIndex;
export const selectSearchScrollChapterIndex = (state: ReaderState) => state.searchScrollChapterIndex;


