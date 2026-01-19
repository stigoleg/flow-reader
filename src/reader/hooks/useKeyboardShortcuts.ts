import { useEffect, useCallback } from 'react';
import type { ReadingMode, PacingGranularity, ReaderSettings } from '@/types';

interface KeyboardShortcutsOptions {
  settings: ReaderSettings;
  togglePlay: () => void;
  nextBlock: () => void;
  prevBlock: () => void;
  nextWord: () => void;
  prevWord: () => void;
  nextSentence: () => void;
  prevSentence: () => void;
  adjustWPM: (delta: number) => void;
  setMode: (mode: ReadingMode) => void;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  // RSVP navigation
  rsvpAdvance?: () => void;
  rsvpRetreat?: () => void;
  // Chapter navigation (for books)
  nextChapter?: () => void;
  prevChapter?: () => void;
  toggleToc?: () => void;
  // Notes panel
  toggleNotesPanel?: () => void;
  // Search
  toggleSearch?: () => void;
  // Overlay state for Escape key handling
  overlays?: {
    isSettingsOpen: boolean;
    closeSettings: () => void;
    isImportOpen: boolean;
    closeImport: () => void;
    isHelpOpen: boolean;
    openHelp: () => void;
    closeHelp: () => void;
    isTocOpen?: boolean;
    closeToc?: () => void;
    isNotesPanelOpen?: boolean;
    closeNotesPanel?: () => void;
    isSearchOpen?: boolean;
    closeSearch?: () => void;
    closeReader: () => void;
  };
}

const MODES: ReadingMode[] = ['pacing', 'bionic', 'rsvp'];
const GRANULARITIES: PacingGranularity[] = ['block', 'sentence', 'word'];

type ActionHandler = (e: KeyboardEvent, options: KeyboardShortcutsOptions) => void;

function getNextNavigation(options: KeyboardShortcutsOptions): () => void {
  const { settings, nextWord, nextSentence, nextBlock, rsvpAdvance } = options;
  if (settings.activeMode === 'rsvp') return rsvpAdvance || nextBlock;
  if (settings.activeMode !== 'pacing') return nextBlock;
  if (settings.pacingGranularity === 'word') return nextWord;
  if (settings.pacingGranularity === 'sentence') return nextSentence;
  return nextBlock;
}

function getPrevNavigation(options: KeyboardShortcutsOptions): () => void {
  const { settings, prevWord, prevSentence, prevBlock, rsvpRetreat } = options;
  if (settings.activeMode === 'rsvp') return rsvpRetreat || prevBlock;
  if (settings.activeMode !== 'pacing') return prevBlock;
  if (settings.pacingGranularity === 'word') return prevWord;
  if (settings.pacingGranularity === 'sentence') return prevSentence;
  return prevBlock;
}

const ACTIONS: Record<string, ActionHandler> = {
  ' ': (_, { togglePlay }) => togglePlay(),
  'ArrowRight': (_, options) => getNextNavigation(options)(),
  'j': (_, options) => getNextNavigation(options)(),
  'ArrowLeft': (_, options) => getPrevNavigation(options)(),
  'k': (_, options) => getPrevNavigation(options)(),
  'ArrowUp': (e, { adjustWPM }) => adjustWPM(e.shiftKey ? 50 : 10),
  'ArrowDown': (e, { adjustWPM }) => adjustWPM(e.shiftKey ? -50 : -10),
  'm': (_, { settings, setMode }) => {
    const idx = MODES.indexOf(settings.activeMode);
    setMode(MODES[(idx + 1) % MODES.length]);
  },
  'M': (_, { settings, setMode }) => {
    const idx = MODES.indexOf(settings.activeMode);
    setMode(MODES[(idx + 1) % MODES.length]);
  },
  'b': (_, { settings, setMode }) => {
    setMode(settings.activeMode === 'bionic' ? 'pacing' : 'bionic');
  },
  'B': (_, { settings, setMode }) => {
    setMode(settings.activeMode === 'bionic' ? 'pacing' : 'bionic');
  },
  'g': (_, { settings, updateSettings }) => {
    if (settings.activeMode === 'pacing') {
      const idx = GRANULARITIES.indexOf(settings.pacingGranularity);
      updateSettings({ pacingGranularity: GRANULARITIES[(idx + 1) % GRANULARITIES.length] });
    }
  },
  'G': (_, { settings, updateSettings }) => {
    if (settings.activeMode === 'pacing') {
      const idx = GRANULARITIES.indexOf(settings.pacingGranularity);
      updateSettings({ pacingGranularity: GRANULARITIES[(idx + 1) % GRANULARITIES.length] });
    }
  },
  'Escape': (_, { overlays }) => {
    // Close overlays in priority order: search > help > import > settings > notes > toc
    // Only close reader if no overlays are open
    if (overlays?.isSearchOpen) {
      overlays.closeSearch?.();
    } else if (overlays?.isHelpOpen) {
      overlays.closeHelp();
    } else if (overlays?.isImportOpen) {
      overlays.closeImport();
    } else if (overlays?.isSettingsOpen) {
      overlays.closeSettings();
    } else if (overlays?.isNotesPanelOpen) {
      overlays.closeNotesPanel?.();
    } else if (overlays?.isTocOpen) {
      overlays.closeToc?.();
    } else {
      overlays?.closeReader();
    }
  },
  '?': (_, { overlays }) => {
    // Toggle help overlay
    if (overlays?.isHelpOpen) {
      overlays.closeHelp();
    } else {
      overlays?.openHelp();
    }
  },
  // Chapter navigation
  '[': (_, { prevChapter }) => prevChapter?.(),
  ']': (_, { nextChapter }) => nextChapter?.(),
  't': (_, { toggleToc }) => toggleToc?.(),
  'T': (_, { toggleToc }) => toggleToc?.(),
  // Notes panel
  'n': (_, { toggleNotesPanel }) => toggleNotesPanel?.(),
  'N': (_, { toggleNotesPanel }) => toggleNotesPanel?.(),
};

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Allow keyboard input in search bar, but handle Escape specially
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      // Only handle Escape in text inputs - let it close search
      if (e.key === 'Escape') {
        const action = ACTIONS[e.key];
        if (action) {
          e.preventDefault();
          action(e, options);
        }
      }
      return;
    }

    // Handle Ctrl/Cmd+F to open search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      options.toggleSearch?.();
      return;
    }

    // Handle F3 for next search result (also Ctrl+G)
    if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key === 'g')) {
      if (options.overlays?.isSearchOpen) {
        e.preventDefault();
        // F3/Ctrl+G navigates to next result
        // Shift+F3/Ctrl+Shift+G navigates to previous result
        // This is handled by the SearchBar component itself via store actions
        // The store's nextSearchResult/prevSearchResult are called from SearchBar
        return;
      }
    }

    const action = ACTIONS[e.key];
    if (action) {
      e.preventDefault();
      action(e, options);
    }
  }, [options]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
