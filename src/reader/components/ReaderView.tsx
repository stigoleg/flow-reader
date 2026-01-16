import { useRef, useEffect, useMemo } from 'react';
import { useReaderStore } from '../store';
import PacingMode from '../modes/PacingMode';
import RSVPMode from '../modes/RSVPMode';
import BlockRenderer from './BlockRenderer';
import ExitConfirmDialog from './ExitConfirmDialog';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSwipeGestures } from '../hooks/useSwipeGestures';
import type { ModeConfig, BionicConfig, PacingConfig, PositionState, BlockHandlers } from './types';

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
  } = useReaderStore();

  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (containerRef.current && document) {
      const blockElement = containerRef.current.querySelector(`[data-block-index="${currentBlockIndex}"]`);
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentBlockIndex, document]);

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
    </>
  );
}
