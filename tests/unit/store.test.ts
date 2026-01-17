import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/types';
import type { FlowDocument, ReadingPosition } from '@/types';

// Mock the storage module - must be defined before importing the store
vi.mock('@/lib/storage', () => ({
  getSettings: vi.fn().mockResolvedValue(null),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  savePosition: vi.fn().mockResolvedValue(undefined),
  getPosition: vi.fn().mockResolvedValue(null),
  isExitConfirmationDismissed: vi.fn().mockResolvedValue(false),
  dismissExitConfirmation: vi.fn().mockResolvedValue(undefined),
  saveCurrentDocument: vi.fn().mockResolvedValue(undefined),
}));

// Mock recents-service
vi.mock('@/lib/recents-service', () => ({
  addRecent: vi.fn().mockResolvedValue(undefined),
  mapSourceToType: vi.fn().mockReturnValue('web'),
  getSourceLabel: vi.fn().mockReturnValue('Test'),
  shouldCacheDocument: vi.fn().mockReturnValue(false),
  calculateProgress: vi.fn().mockReturnValue({ percent: 0, label: '0%' }),
  updateLastOpened: vi.fn().mockResolvedValue(undefined),
}));

// Import store after mocks are set up
import { useReaderStore } from '@/reader/store';

describe('Reader Store', () => {
  // Reset store state before each test
  beforeEach(() => {
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

  const createTestDocument = (): FlowDocument => ({
    metadata: {
      title: 'Test Document',
      source: 'paste',
      createdAt: Date.now(),
    },
    blocks: [
      { type: 'paragraph', content: 'First paragraph.', id: 'p1' },
      { type: 'paragraph', content: 'Second paragraph.', id: 'p2' },
      { type: 'paragraph', content: 'Third paragraph.', id: 'p3' },
    ],
    plainText: 'First paragraph. Second paragraph. Third paragraph.',
  });

  describe('initial state', () => {
    it('has correct default values', () => {
      const state = useReaderStore.getState();
      
      expect(state.document).toBeNull();
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.currentBlockIndex).toBe(0);
      expect(state.currentWPM).toBe(DEFAULT_SETTINGS.baseWPM);
      expect(state.isPlaying).toBe(false);
      expect(state.isSettingsOpen).toBe(false);
    });
  });

  describe('setDocument', () => {
    it('sets document and resets position', () => {
      const doc = createTestDocument();
      
      // First set some position
      useReaderStore.setState({ currentBlockIndex: 5, currentSentenceIndex: 3 });
      
      // Then set document
      useReaderStore.getState().setDocument(doc);
      
      const state = useReaderStore.getState();
      expect(state.document).toBe(doc);
      expect(state.isLoading).toBe(false);
      expect(state.currentBlockIndex).toBe(0);
      expect(state.currentSentenceIndex).toBe(0);
      expect(state.currentWordIndex).toBe(0);
    });

    it('handles null document', () => {
      useReaderStore.getState().setDocument(null);
      
      expect(useReaderStore.getState().document).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('sets loading state', () => {
      useReaderStore.getState().setLoading(false);
      expect(useReaderStore.getState().isLoading).toBe(false);
      
      useReaderStore.getState().setLoading(true);
      expect(useReaderStore.getState().isLoading).toBe(true);
    });
  });

  describe('setError', () => {
    it('sets error and stops loading', () => {
      useReaderStore.setState({ isLoading: true });
      
      useReaderStore.getState().setError('Something went wrong');
      
      const state = useReaderStore.getState();
      expect(state.error).toBe('Something went wrong');
      expect(state.isLoading).toBe(false);
    });

    it('clears error when set to null', () => {
      useReaderStore.setState({ error: 'Previous error' });
      
      useReaderStore.getState().setError(null);
      
      expect(useReaderStore.getState().error).toBeNull();
    });
  });

  describe('setPosition', () => {
    it('sets block index and char offset', () => {
      useReaderStore.getState().setPosition(5, 100);
      
      const state = useReaderStore.getState();
      expect(state.currentBlockIndex).toBe(5);
      expect(state.currentCharOffset).toBe(100);
    });

    it('resets sub-block positions', () => {
      useReaderStore.setState({ currentSentenceIndex: 3, currentWordIndex: 10 });
      
      useReaderStore.getState().setPosition(2);
      
      const state = useReaderStore.getState();
      expect(state.currentSentenceIndex).toBe(0);
      expect(state.currentWordIndex).toBe(0);
    });

    it('defaults charOffset to 0', () => {
      useReaderStore.getState().setPosition(3);
      
      expect(useReaderStore.getState().currentCharOffset).toBe(0);
    });
  });

  describe('togglePlay and setPlaying', () => {
    it('toggles playing state', () => {
      expect(useReaderStore.getState().isPlaying).toBe(false);
      
      useReaderStore.getState().togglePlay();
      expect(useReaderStore.getState().isPlaying).toBe(true);
      
      useReaderStore.getState().togglePlay();
      expect(useReaderStore.getState().isPlaying).toBe(false);
    });

    it('sets playing state directly', () => {
      useReaderStore.getState().setPlaying(true);
      expect(useReaderStore.getState().isPlaying).toBe(true);
      
      useReaderStore.getState().setPlaying(false);
      expect(useReaderStore.getState().isPlaying).toBe(false);
    });
  });

  describe('WPM controls', () => {
    describe('setWPM', () => {
      it('sets WPM value', () => {
        useReaderStore.getState().setWPM(300);
        expect(useReaderStore.getState().currentWPM).toBe(300);
      });

      it('clamps WPM to minimum of 50', () => {
        useReaderStore.getState().setWPM(10);
        expect(useReaderStore.getState().currentWPM).toBe(50);
        
        useReaderStore.getState().setWPM(-100);
        expect(useReaderStore.getState().currentWPM).toBe(50);
      });

      it('clamps WPM to maximum of 1000', () => {
        useReaderStore.getState().setWPM(1500);
        expect(useReaderStore.getState().currentWPM).toBe(1000);
      });

      it('accepts boundary values', () => {
        useReaderStore.getState().setWPM(50);
        expect(useReaderStore.getState().currentWPM).toBe(50);
        
        useReaderStore.getState().setWPM(1000);
        expect(useReaderStore.getState().currentWPM).toBe(1000);
      });
    });

    describe('adjustWPM', () => {
      it('increases WPM by delta', () => {
        useReaderStore.setState({ currentWPM: 200 });
        
        useReaderStore.getState().adjustWPM(50);
        
        expect(useReaderStore.getState().currentWPM).toBe(250);
      });

      it('decreases WPM by negative delta', () => {
        useReaderStore.setState({ currentWPM: 200 });
        
        useReaderStore.getState().adjustWPM(-50);
        
        expect(useReaderStore.getState().currentWPM).toBe(150);
      });

      it('clamps result to valid range', () => {
        useReaderStore.setState({ currentWPM: 100 });
        useReaderStore.getState().adjustWPM(-100);
        expect(useReaderStore.getState().currentWPM).toBe(50);
        
        useReaderStore.setState({ currentWPM: 950 });
        useReaderStore.getState().adjustWPM(100);
        expect(useReaderStore.getState().currentWPM).toBe(1000);
      });
    });
  });

  describe('block navigation', () => {
    beforeEach(() => {
      useReaderStore.setState({ document: createTestDocument() });
    });

    describe('nextBlock', () => {
      it('advances to next block', () => {
        useReaderStore.getState().nextBlock();
        expect(useReaderStore.getState().currentBlockIndex).toBe(1);
      });

      it('resets sub-block positions', () => {
        useReaderStore.setState({ currentSentenceIndex: 5, currentWordIndex: 10 });
        
        useReaderStore.getState().nextBlock();
        
        const state = useReaderStore.getState();
        expect(state.currentSentenceIndex).toBe(0);
        expect(state.currentWordIndex).toBe(0);
      });

      it('does not go past last block', () => {
        useReaderStore.setState({ currentBlockIndex: 2 }); // Last block (index 2)
        
        useReaderStore.getState().nextBlock();
        
        expect(useReaderStore.getState().currentBlockIndex).toBe(2);
      });
    });

    describe('prevBlock', () => {
      it('goes to previous block', () => {
        useReaderStore.setState({ currentBlockIndex: 2 });
        
        useReaderStore.getState().prevBlock();
        
        expect(useReaderStore.getState().currentBlockIndex).toBe(1);
      });

      it('does not go before first block', () => {
        useReaderStore.setState({ currentBlockIndex: 0 });
        
        useReaderStore.getState().prevBlock();
        
        expect(useReaderStore.getState().currentBlockIndex).toBe(0);
      });

      it('resets sub-block positions', () => {
        useReaderStore.setState({ 
          currentBlockIndex: 2,
          currentSentenceIndex: 5, 
          currentWordIndex: 10 
        });
        
        useReaderStore.getState().prevBlock();
        
        const state = useReaderStore.getState();
        expect(state.currentSentenceIndex).toBe(0);
        expect(state.currentWordIndex).toBe(0);
      });
    });
  });

  describe('sentence navigation', () => {
    describe('setSentenceIndex', () => {
      it('sets sentence index', () => {
        useReaderStore.getState().setSentenceIndex(5);
        expect(useReaderStore.getState().currentSentenceIndex).toBe(5);
      });
    });

    describe('nextSentence', () => {
      it('increments sentence index', () => {
        useReaderStore.setState({ currentSentenceIndex: 2 });
        
        useReaderStore.getState().nextSentence();
        
        expect(useReaderStore.getState().currentSentenceIndex).toBe(3);
      });
    });

    describe('prevSentence', () => {
      it('decrements sentence index', () => {
        useReaderStore.setState({ currentSentenceIndex: 2 });
        
        useReaderStore.getState().prevSentence();
        
        expect(useReaderStore.getState().currentSentenceIndex).toBe(1);
      });

      it('does not go below 0', () => {
        useReaderStore.setState({ currentSentenceIndex: 0 });
        
        useReaderStore.getState().prevSentence();
        
        expect(useReaderStore.getState().currentSentenceIndex).toBe(0);
      });
    });

    describe('resetSentenceIndex', () => {
      it('resets sentence index to 0', () => {
        useReaderStore.setState({ currentSentenceIndex: 10 });
        
        useReaderStore.getState().resetSentenceIndex();
        
        expect(useReaderStore.getState().currentSentenceIndex).toBe(0);
      });
    });
  });

  describe('word navigation', () => {
    describe('setWordIndex', () => {
      it('sets word index', () => {
        useReaderStore.getState().setWordIndex(15);
        expect(useReaderStore.getState().currentWordIndex).toBe(15);
      });
    });

    describe('nextWord', () => {
      it('increments word index', () => {
        useReaderStore.setState({ currentWordIndex: 5 });
        
        useReaderStore.getState().nextWord();
        
        expect(useReaderStore.getState().currentWordIndex).toBe(6);
      });
    });

    describe('prevWord', () => {
      it('decrements word index', () => {
        useReaderStore.setState({ currentWordIndex: 5 });
        
        useReaderStore.getState().prevWord();
        
        expect(useReaderStore.getState().currentWordIndex).toBe(4);
      });

      it('does not go below 0', () => {
        useReaderStore.setState({ currentWordIndex: 0 });
        
        useReaderStore.getState().prevWord();
        
        expect(useReaderStore.getState().currentWordIndex).toBe(0);
      });
    });

    describe('resetWordIndex', () => {
      it('resets word index to 0', () => {
        useReaderStore.setState({ currentWordIndex: 20 });
        
        useReaderStore.getState().resetWordIndex();
        
        expect(useReaderStore.getState().currentWordIndex).toBe(0);
      });
    });
  });

  describe('settings', () => {
    describe('toggleSettings', () => {
      it('toggles settings panel open state', () => {
        expect(useReaderStore.getState().isSettingsOpen).toBe(false);
        
        useReaderStore.getState().toggleSettings();
        expect(useReaderStore.getState().isSettingsOpen).toBe(true);
        
        useReaderStore.getState().toggleSettings();
        expect(useReaderStore.getState().isSettingsOpen).toBe(false);
      });
    });

    describe('updateSettings', () => {
      it('merges new settings with existing', () => {
        useReaderStore.getState().updateSettings({ baseWPM: 350 });
        
        const settings = useReaderStore.getState().settings;
        expect(settings.baseWPM).toBe(350);
        // Other settings should remain
        expect(settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
      });

      it('updates multiple settings at once', () => {
        useReaderStore.getState().updateSettings({ 
          baseWPM: 300, 
          fontSize: 18,
          fontFamily: 'Arial',
        });
        
        const settings = useReaderStore.getState().settings;
        expect(settings.baseWPM).toBe(300);
        expect(settings.fontSize).toBe(18);
        expect(settings.fontFamily).toBe('Arial');
      });
    });

    describe('setMode', () => {
      it('changes active reading mode', () => {
        useReaderStore.getState().setMode('rsvp');
        expect(useReaderStore.getState().settings.activeMode).toBe('rsvp');
        
        useReaderStore.getState().setMode('bionic');
        expect(useReaderStore.getState().settings.activeMode).toBe('bionic');
        
        useReaderStore.getState().setMode('pacing');
        expect(useReaderStore.getState().settings.activeMode).toBe('pacing');
      });

      it('resets sub-block positions when changing mode', () => {
        useReaderStore.setState({ 
          currentSentenceIndex: 5, 
          currentWordIndex: 10 
        });
        
        useReaderStore.getState().setMode('rsvp');
        
        const state = useReaderStore.getState();
        expect(state.currentSentenceIndex).toBe(0);
        expect(state.currentWordIndex).toBe(0);
      });
    });
  });

  describe('restorePosition', () => {
    // Helper to create a book document with multiple chapters
    const createBookDocument = (): FlowDocument => ({
      metadata: {
        title: 'Test Book',
        source: 'epub',
        createdAt: Date.now(),
      },
      blocks: [
        { type: 'paragraph', content: 'Chapter 1 Block 1', id: 'c1b1' },
        { type: 'paragraph', content: 'Chapter 1 Block 2', id: 'c1b2' },
        { type: 'paragraph', content: 'Chapter 1 Block 3', id: 'c1b3' },
      ],
      plainText: 'Chapter 1 content',
      book: {
        title: 'Test Book',
        chapters: [
          {
            title: 'Chapter 1',
            blocks: [
              { type: 'paragraph', content: 'Chapter 1 Block 1', id: 'c1b1' },
              { type: 'paragraph', content: 'Chapter 1 Block 2', id: 'c1b2' },
              { type: 'paragraph', content: 'Chapter 1 Block 3', id: 'c1b3' },
            ],
            plainText: 'Chapter 1 content',
          },
          {
            title: 'Chapter 2',
            blocks: [
              { type: 'paragraph', content: 'Chapter 2 Block 1', id: 'c2b1' },
              { type: 'paragraph', content: 'Chapter 2 Block 2', id: 'c2b2' },
            ],
            plainText: 'Chapter 2 content',
          },
          {
            title: 'Chapter 3',
            blocks: [
              { type: 'paragraph', content: 'Chapter 3 Block 1', id: 'c3b1' },
              { type: 'paragraph', content: 'Chapter 3 Block 2', id: 'c3b2' },
              { type: 'paragraph', content: 'Chapter 3 Block 3', id: 'c3b3' },
              { type: 'paragraph', content: 'Chapter 3 Block 4', id: 'c3b4' },
              { type: 'paragraph', content: 'Chapter 3 Block 5', id: 'c3b5' },
            ],
            plainText: 'Chapter 3 content',
          },
        ],
      },
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('restores position within a chapter for books', async () => {
      const { getPosition } = await import('@/lib/storage');
      
      // Mock saved position: chapter 2, block 1, with word/sentence positions
      const savedPosition: ReadingPosition = {
        blockIndex: 1,
        charOffset: 50,
        timestamp: Date.now(),
        chapterIndex: 2,
        sentenceIndex: 3,
        wordIndex: 15,
      };
      vi.mocked(getPosition).mockResolvedValueOnce(savedPosition);

      // Set up a book document (starts at chapter 0)
      const bookDoc = createBookDocument();
      useReaderStore.getState().setDocument(bookDoc);
      
      // Verify initial state
      expect(useReaderStore.getState().currentChapterIndex).toBe(0);
      expect(useReaderStore.getState().currentBlockIndex).toBe(0);

      // Restore position
      await useReaderStore.getState().restorePosition();

      // Verify chapter was restored
      const state = useReaderStore.getState();
      expect(state.currentChapterIndex).toBe(2);
      
      // Verify block position within chapter was restored (not reset to 0)
      expect(state.currentBlockIndex).toBe(1);
      expect(state.currentCharOffset).toBe(50);
      expect(state.currentSentenceIndex).toBe(3);
      expect(state.currentWordIndex).toBe(15);
    });

    it('restores position when saved blockIndex exceeds first chapter length', async () => {
      const { getPosition } = await import('@/lib/storage');
      
      // Saved position: chapter 2, block 4
      // First chapter only has 3 blocks, so this would fail with the old bug
      const savedPosition: ReadingPosition = {
        blockIndex: 4,
        charOffset: 100,
        timestamp: Date.now(),
        chapterIndex: 2,
        sentenceIndex: 2,
        wordIndex: 20,
      };
      vi.mocked(getPosition).mockResolvedValueOnce(savedPosition);

      const bookDoc = createBookDocument();
      useReaderStore.getState().setDocument(bookDoc);

      await useReaderStore.getState().restorePosition();

      const state = useReaderStore.getState();
      // Chapter 2 has 5 blocks, so block 4 is valid
      expect(state.currentChapterIndex).toBe(2);
      expect(state.currentBlockIndex).toBe(4);
      expect(state.currentCharOffset).toBe(100);
      expect(state.currentSentenceIndex).toBe(2);
      expect(state.currentWordIndex).toBe(20);
    });

    it('handles chapter 0 position restoration', async () => {
      const { getPosition } = await import('@/lib/storage');
      
      // Saved position in chapter 0 (no chapter switch needed)
      const savedPosition: ReadingPosition = {
        blockIndex: 2,
        charOffset: 25,
        timestamp: Date.now(),
        chapterIndex: 0,
      };
      vi.mocked(getPosition).mockResolvedValueOnce(savedPosition);

      const bookDoc = createBookDocument();
      useReaderStore.getState().setDocument(bookDoc);

      await useReaderStore.getState().restorePosition();

      const state = useReaderStore.getState();
      expect(state.currentChapterIndex).toBe(0);
      expect(state.currentBlockIndex).toBe(2);
      expect(state.currentCharOffset).toBe(25);
    });

    it('restores position for non-book documents', async () => {
      const { getPosition } = await import('@/lib/storage');
      
      const savedPosition: ReadingPosition = {
        blockIndex: 5,
        charOffset: 100,
        timestamp: Date.now(),
      };
      vi.mocked(getPosition).mockResolvedValueOnce(savedPosition);

      // Regular document (not a book)
      const doc: FlowDocument = {
        metadata: { title: 'Article', source: 'web', createdAt: Date.now() },
        blocks: Array.from({ length: 10 }, (_, i) => ({
          type: 'paragraph' as const,
          content: `Block ${i}`,
          id: `b${i}`,
        })),
        plainText: 'Article content',
      };
      useReaderStore.getState().setDocument(doc);

      await useReaderStore.getState().restorePosition();

      const state = useReaderStore.getState();
      expect(state.currentBlockIndex).toBe(5);
      expect(state.currentCharOffset).toBe(100);
    });
  });
});
