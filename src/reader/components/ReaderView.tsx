import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useReaderStore } from '../store';
import PacingMode from '../modes/PacingMode';
import RSVPMode from '../modes/RSVPMode';
import BlockRenderer from './BlockRenderer';
import ExitConfirmDialog from './ExitConfirmDialog';
import AnnotationToolbar from './AnnotationToolbar';
import NoteEditorModal from './NoteEditorModal';
import NotesPanel from './NotesPanel';
import SearchBar from './SearchBar';
import TTSControls from './TTSControls';
import { useToast } from './Toast';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import { useTextSelection } from '../hooks/useTextSelection';
import { useTTS } from '../hooks/useTTS';
import type { ModeConfig, BionicConfig, PacingConfig, PositionState, BlockHandlers } from './types';
import type { Annotation, AnnotationAnchor } from '@/types';

export default function ReaderView() {
  const {
    document,
    currentBlockIndex,
    settings,
    setPosition,
    isPlaying,
    currentWPM,
    nextBlock,
    prevBlock,
    togglePlay,
    adjustWPM,
    setMode,
    updateSettings,
    currentSentenceIndex,
    currentWordIndex,
    nextSentence,
    nextWord,
    prevSentence,
    prevWord,
    resetSentenceIndex,
    resetWordIndex,
    setWordIndex,
    setSentenceIndex,
    // Overlay states for Escape key handling
    isSettingsOpen,
    toggleSettings,
    isImportOpen,
    setImportOpen,
    isHelpOpen,
    setHelpOpen,
    // Completion
    showCompletion,
    // RSVP navigation
    rsvpAdvance,
    rsvpRetreat,
    // Chapter navigation (for books)
    nextChapter,
    prevChapter,
    isTocOpen,
    setTocOpen,
    toggleToc,
    // Exit confirmation
    isExitConfirmOpen,
    setExitConfirmOpen,
    closeReader,
    confirmCloseReader,
    // Annotations
    annotations,
    loadAnnotations,
    addAnnotation,
    updateAnnotationNote,
    changeAnnotationColor,
    removeAnnotation,
    editingAnnotationId,
    setEditingAnnotation,
    activeHighlightColor,
    // Notes panel
    isNotesPanelOpen,
    setNotesPanelOpen,
    toggleNotesPanel,
    navigateToAnnotation,
    // Scroll-only navigation
    scrollToBlockIndex,
    clearScrollToBlock,
    // Search
    isSearchOpen,
    searchResults,
    currentSearchIndex,
    toggleSearch,
    closeSearch,
    // Jump navigation
    jumpToStart,
    jumpToEnd,
    jumpToPercent,
    skipBlocks,
    // Goal notifications
    consumeGoalNotifications,
  } = useReaderStore();

  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  // Check for and display goal completion notifications
  useEffect(() => {
    const goals = consumeGoalNotifications();
    for (const goal of goals) {
      const emoji = goal.type === 'daily' ? '🎯' : goal.type === 'weekly' ? '🏆' : '🌟';
      const message = `${emoji} ${goal.type.charAt(0).toUpperCase() + goal.type.slice(1)} goal reached! (${goal.target} ${goal.unit})`;
      showToast(message, 'success', 5000);
    }
  });

  useKeyboardShortcuts({
    settings,
    togglePlay,
    nextBlock,
    prevBlock,
    nextWord,
    prevWord,
    nextSentence,
    prevSentence,
    adjustWPM,
    setMode,
    updateSettings,
    rsvpAdvance,
    rsvpRetreat,
    nextChapter,
    prevChapter,
    toggleToc,
    toggleNotesPanel,
    toggleSearch,
    jumpToStart,
    jumpToEnd,
    jumpToPercent,
    skipBlocks,
    overlays: {
      isSettingsOpen,
      closeSettings: toggleSettings,
      isImportOpen,
      closeImport: () => setImportOpen(false),
      isHelpOpen,
      openHelp: () => setHelpOpen(true),
      closeHelp: () => setHelpOpen(false),
      isTocOpen,
      closeToc: () => setTocOpen(false),
      isNotesPanelOpen,
      closeNotesPanel: () => setNotesPanelOpen(false),
      isSearchOpen,
      closeSearch,
      closeReader,
    },
  });

  const swipeHandlers = useMemo(() => ({
    onSwipeLeft: () => {
      if (settings.pacingGranularity === 'word') nextWord();
      else if (settings.pacingGranularity === 'sentence') nextSentence();
      else nextBlock();
    },
    onSwipeRight: () => {
      if (settings.pacingGranularity === 'word') prevWord();
      else if (settings.pacingGranularity === 'sentence') prevSentence();
      else prevBlock();
    },
    onSwipeUp: () => adjustWPM(20),
    onSwipeDown: () => adjustWPM(-20),
  }), [settings.pacingGranularity, nextWord, nextSentence, nextBlock, prevWord, prevSentence, prevBlock, adjustWPM]);

  useSwipeGestures(containerRef, swipeHandlers);

  // Text-to-speech functionality
  const tts = useTTS({
    settings,
    blocks: document?.blocks || [],
    currentBlockIndex,
    onBlockComplete: nextBlock,
  });

  // Load annotations when document loads
  useEffect(() => {
    if (document) {
      loadAnnotations();
    }
  }, [document, loadAnnotations]);

  // Text selection for annotation creation
  // Only enable when not playing (to avoid interference with reading)
  const { selection, clearSelection } = useTextSelection(containerRef, {
    enabled: !isPlaying && settings.activeMode !== 'rsvp',
  });

  // Track pending annotation for "Add Note" flow (selection -> note editor)
  const [pendingAnnotation, setPendingAnnotation] = useState<Annotation | null>(null);

  useEffect(() => {
    if (containerRef.current && document) {
      const blockElement = containerRef.current.querySelector(`[data-block-index="${currentBlockIndex}"]`);
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentBlockIndex, document]);

  // Scroll-only navigation for annotations (doesn't change reading position)
  // Used when opening a document from Archive to view a specific annotation
  useEffect(() => {
    if (containerRef.current && document && scrollToBlockIndex !== null) {
      const blockElement = containerRef.current.querySelector(
        `[data-block-index="${scrollToBlockIndex}"]`
      );
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      clearScrollToBlock();
    }
  }, [scrollToBlockIndex, document, clearScrollToBlock]);

  // Viewport-aware scroll for word/sentence granularity in pacing mode
  // This handles long blocks that are taller than the viewport by scrolling
  // when the active word/sentence approaches the top or bottom of the screen
  useEffect(() => {
    if (!containerRef.current || !document) return;
    if (settings.activeMode !== 'pacing') return;

    // Determine which element to check based on granularity
    let activeElement: Element | null = null;

    if (settings.pacingGranularity === 'word') {
      activeElement = containerRef.current.querySelector('.pacing-word-active');
    } else if (settings.pacingGranularity === 'sentence') {
      activeElement = containerRef.current.querySelector('.pacing-sentence-active');
    }

    if (!activeElement) return;

    const rect = activeElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Define thresholds - scroll if element is in top/bottom 15% of viewport
    const bottomThreshold = viewportHeight * 0.85;
    const topThreshold = viewportHeight * 0.15;

    if (rect.bottom > bottomThreshold || rect.top < topThreshold) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentWordIndex, currentSentenceIndex, settings.pacingGranularity, settings.activeMode, document]);

  if (!document) return null;

  const handleBlockClick = (index: number) => setPosition(index, 0);

  const handleWordClick = (blockIndex: number, wordIndex: number) => {
    if (blockIndex !== currentBlockIndex) setPosition(blockIndex, 0);
    setWordIndex(wordIndex);
  };

  const handleSentenceClick = (blockIndex: number, sentenceIndex: number) => {
    if (blockIndex !== currentBlockIndex) setPosition(blockIndex, 0);
    setSentenceIndex(sentenceIndex);
  };

  // Create anchor from selection range
  const createAnchorFromSelection = useCallback((): AnnotationAnchor | null => {
    if (!selection) return null;
    return {
      blockId: String(selection.startBlockIndex),
      startWordIndex: selection.startWordIndex,
      endBlockId: String(selection.endBlockIndex),
      endWordIndex: selection.endWordIndex,
      textContent: selection.textContent,
    };
  }, [selection]);

  // Handle highlight creation from toolbar
  const handleHighlight = useCallback(async (color: string) => {
    const anchor = createAnchorFromSelection();
    if (!anchor) return;
    
    await addAnnotation(anchor, color);
    clearSelection();
  }, [createAnchorFromSelection, addAnnotation, clearSelection]);

  // Handle "Add Note" from toolbar - creates annotation and opens editor
  const handleAddNote = useCallback(async () => {
    const anchor = createAnchorFromSelection();
    if (!anchor) return;
    
    // Create annotation with default color
    const annotation = await addAnnotation(anchor, activeHighlightColor);
    clearSelection();
    
    // Open the note editor for the new annotation
    setPendingAnnotation(annotation);
    setEditingAnnotation(annotation.id);
  }, [createAnchorFromSelection, addAnnotation, activeHighlightColor, clearSelection, setEditingAnnotation]);

  // Handle clicking on an existing annotation
  const handleAnnotationClick = useCallback((annotation: Annotation) => {
    setEditingAnnotation(annotation.id);
  }, [setEditingAnnotation]);

  // Get the annotation being edited
  const editingAnnotation = editingAnnotationId 
    ? annotations.find(a => a.id === editingAnnotationId) 
    : pendingAnnotation;

  // Handle note save
  const handleNoteSave = useCallback(async (note: string) => {
    if (editingAnnotationId) {
      await updateAnnotationNote(editingAnnotationId, note);
    }
    setPendingAnnotation(null);
    setEditingAnnotation(null);
  }, [editingAnnotationId, updateAnnotationNote, setEditingAnnotation]);

  // Handle color change in note editor
  const handleColorChange = useCallback(async (color: string) => {
    if (editingAnnotationId) {
      await changeAnnotationColor(editingAnnotationId, color);
    }
  }, [editingAnnotationId, changeAnnotationColor]);

  // Handle annotation delete
  const handleAnnotationDelete = useCallback(async () => {
    if (editingAnnotationId) {
      await removeAnnotation(editingAnnotationId);
    }
    setPendingAnnotation(null);
  }, [editingAnnotationId, removeAnnotation]);

  // Handle closing the toolbar
  const handleToolbarClose = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Handle closing the note editor
  const handleNoteEditorClose = useCallback(() => {
    setPendingAnnotation(null);
    setEditingAnnotation(null);
  }, [setEditingAnnotation]);

  if (settings.activeMode === 'rsvp') {
    return (
      <>
        <RSVPMode text={document.plainText} wpm={currentWPM} isPlaying={isPlaying} />
        <ExitConfirmDialog
          isOpen={isExitConfirmOpen}
          onCancel={() => setExitConfirmOpen(false)}
          onConfirm={confirmCloseReader}
        />
      </>
    );
  }

  const isPacingMode = settings.activeMode === 'pacing';

  // Grouped configs for BlockRenderer
  const mode: ModeConfig = {
    isPacing: isPacingMode,
    isBionic: settings.activeMode === 'bionic',
  };

  const bionicConfig: BionicConfig = {
    intensity: settings.bionicIntensity,
    proportion: settings.bionicProportion,
    adaptive: settings.bionicAdaptive,
  };

  const pacingConfig: PacingConfig = {
    granularity: settings.pacingGranularity,
    highlightStyle: settings.pacingHighlightStyle,
    pacingHighlightStyle: settings.pacingHighlightStyle,
    pacingDimContext: settings.pacingDimContext,
    pacingShowGuide: settings.pacingShowGuide,
    pacingBoldFocusLetter: settings.pacingBoldFocusLetter,
  };

  const position: PositionState = {
    sentenceIndex: currentSentenceIndex,
    wordIndex: currentWordIndex,
  };

  return (
    <>
      {/* Search Bar - fixed at top when search is open */}
      <SearchBar />
      
      <main
        ref={containerRef}
        className="reader-content pt-20 pb-16 px-4"
        style={{
          maxWidth: settings.columnWidth,
          margin: '0 auto',
          textAlign: settings.textAlign,
          hyphens: settings.hyphenation ? 'auto' : 'none',
        }}
      >
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{document.metadata.title}</h1>
          {document.metadata.author && <p className="opacity-60">{document.metadata.author}</p>}
          {document.metadata.publishedAt && <p className="text-sm opacity-50">{document.metadata.publishedAt}</p>}
        </header>

        {isPacingMode && (
          <PacingMode
            blocks={document.blocks}
            currentBlockIndex={currentBlockIndex}
            wpm={currentWPM}
            isPlaying={isPlaying}
            settings={settings}
            onNextBlock={nextBlock}
            currentSentenceIndex={currentSentenceIndex}
            currentWordIndex={currentWordIndex}
            onNextSentence={nextSentence}
            onNextWord={nextWord}
            onResetSentenceIndex={resetSentenceIndex}
            onResetWordIndex={resetWordIndex}
            onAdjustWPM={adjustWPM}
            onComplete={showCompletion}
          />
        )}

        <div className="relative">
          {document.blocks.map((block, index) => {
            const handlers: BlockHandlers = {
              onClick: () => handleBlockClick(index),
              onWordClick: (wordIndex: number) => handleWordClick(index, wordIndex),
              onSentenceClick: (sentenceIndex: number) => handleSentenceClick(index, sentenceIndex),
            };

            return (
              <BlockRenderer
                key={block.id}
                block={block}
                index={index}
                isActive={index === currentBlockIndex}
                mode={mode}
                bionicConfig={bionicConfig}
                pacingConfig={pacingConfig}
                position={position}
                handlers={handlers}
                annotations={annotations}
                onAnnotationClick={handleAnnotationClick}
                searchResults={searchResults}
                currentSearchIndex={currentSearchIndex}
              />
            );
          })}
        </div>
      </main>

      <ExitConfirmDialog
        isOpen={isExitConfirmOpen}
        onCancel={() => setExitConfirmOpen(false)}
        onConfirm={confirmCloseReader}
      />

      {/* Annotation Toolbar - appears when text is selected */}
      {selection && (
        <AnnotationToolbar
          selection={selection}
          containerRef={containerRef}
          onHighlight={handleHighlight}
          onAddNote={handleAddNote}
          onClose={handleToolbarClose}
        />
      )}

      {/* Note Editor Modal - appears when editing an annotation */}
      {editingAnnotation && (
        <NoteEditorModal
          annotation={editingAnnotation}
          onSave={handleNoteSave}
          onChangeColor={handleColorChange}
          onDelete={handleAnnotationDelete}
          onClose={handleNoteEditorClose}
        />
      )}

      {/* Notes Panel - slide-in panel showing all annotations */}
      <NotesPanel
        isOpen={isNotesPanelOpen}
        onClose={() => setNotesPanelOpen(false)}
        annotations={annotations}
        documentTitle={document?.metadata.title}
        onNavigateToAnnotation={navigateToAnnotation}
        onEditAnnotation={(annotation) => setEditingAnnotation(annotation.id)}
        onDeleteAnnotation={removeAnnotation}
      />

      {/* TTS Controls - floating controls when TTS is enabled */}
      {settings.ttsEnabled && (
        <TTSControls
          isAvailable={tts.isAvailable}
          isSpeaking={tts.isSpeaking}
          isPaused={tts.isPaused}
          onToggle={tts.toggle}
          onStop={tts.stop}
        />
      )}
    </>
  );
}
