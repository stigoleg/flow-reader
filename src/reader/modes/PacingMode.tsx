import { useEffect, useRef, useCallback, useMemo } from 'react';
import type { Block, ReaderSettings } from '@/types';
import { getBlockText } from '@/lib/block-utils';
import { 
  tokenizeIntoSentences, 
  tokenizeIntoWords,
  calculateSentenceDuration,
  calculateWordDuration,
  getWordCount,
  type SentenceToken,
  type WordToken,
} from '@/lib/tokenizer';
import { calculateReadability } from '@/lib/readability';
import { useSpeedRamp } from '../hooks/useSpeedRamp';

interface PacingModeProps {
  blocks: Block[];
  currentBlockIndex: number;
  wpm: number;
  isPlaying: boolean;
  settings: ReaderSettings;
  // Block-level navigation
  onNextBlock: () => void;
  // Sub-block navigation  
  currentSentenceIndex: number;
  currentWordIndex: number;
  onNextSentence: () => void;
  onNextWord: () => void;
  onResetSentenceIndex: () => void;
  onResetWordIndex: () => void;
  // Speed ramp-up
  onAdjustWPM: (delta: number) => void;
  // Completion callback
  onComplete?: () => void;
}

function getBlockWordCount(block: Block): number {
  return getWordCount(getBlockText(block));
}

export default function PacingMode({
  blocks,
  currentBlockIndex,
  wpm,
  isPlaying,
  settings,
  onNextBlock,
  currentSentenceIndex,
  currentWordIndex,
  onNextSentence,
  onNextWord,
  onResetSentenceIndex,
  onResetWordIndex,
  onAdjustWPM,
  onComplete,
}: PacingModeProps) {
  const timerRef = useRef<number | null>(null);
  const { pacingGranularity, pacingPauseOnPunctuation, pacingAdaptiveSpeed, pacingReadabilitySpeed } = settings;
  const { rampEnabled, rampStep, rampInterval, targetWPM } = settings;

  // Speed ramp-up effect (shared hook)
  useSpeedRamp({
    isPlaying,
    wpm,
    targetWPM,
    rampEnabled,
    rampStep,
    rampInterval,
    onAdjustWPM,
  });

  // Get current block
  const currentBlock = blocks[currentBlockIndex];
  const blockText = currentBlock ? getBlockText(currentBlock) : '';

  // Calculate readability-adjusted WPM for the current block
  const effectiveWPM = useMemo(() => {
    if (!pacingReadabilitySpeed || !blockText) {
      return wpm;
    }
    const readability = calculateReadability(blockText);
    return Math.round(wpm * readability.wpmMultiplier);
  }, [wpm, blockText, pacingReadabilitySpeed]);

  // Tokenize based on granularity
  const sentences = useMemo(() => {
    if (pacingGranularity !== 'sentence') return [];
    return tokenizeIntoSentences(blockText);
  }, [blockText, pacingGranularity]);

  const words = useMemo(() => {
    if (pacingGranularity !== 'word') return [];
    return tokenizeIntoWords(blockText);
  }, [blockText, pacingGranularity]);

  // Get current token based on granularity
  const currentSentence: SentenceToken | undefined = sentences[currentSentenceIndex];
  const currentWord: WordToken | undefined = words[currentWordIndex];

  // Check if we're at the end of the document
  const isLastBlock = currentBlockIndex >= blocks.length - 1;
  const isAtEndOfBlock = useMemo(() => {
    switch (pacingGranularity) {
      case 'sentence':
        return currentSentenceIndex >= sentences.length - 1;
      case 'word':
        return currentWordIndex >= words.length - 1;
      default:
        return true; // Block mode - always at "end" of current unit
    }
  }, [pacingGranularity, currentSentenceIndex, sentences.length, currentWordIndex, words.length]);

  // Advance to next unit (word, sentence, or block)
  const advance = useCallback(() => {
    switch (pacingGranularity) {
      case 'word':
        if (currentWordIndex < words.length - 1) {
          onNextWord();
        } else if (!isLastBlock) {
          // Move to next block and reset word index
          onResetWordIndex();
          onNextBlock();
        }
        break;
      case 'sentence':
        if (currentSentenceIndex < sentences.length - 1) {
          onNextSentence();
        } else if (!isLastBlock) {
          // Move to next block and reset sentence index
          onResetSentenceIndex();
          onNextBlock();
        }
        break;
      default: // block
        if (!isLastBlock) {
          onNextBlock();
        }
        break;
    }
  }, [
    pacingGranularity,
    currentWordIndex,
    words.length,
    currentSentenceIndex,
    sentences.length,
    isLastBlock,
    onNextWord,
    onNextSentence,
    onNextBlock,
    onResetWordIndex,
    onResetSentenceIndex,
  ]);

  // Calculate duration for current unit
  const getDuration = useCallback((): number => {
    switch (pacingGranularity) {
      case 'word':
        if (currentWord) {
          return calculateWordDuration(currentWord, effectiveWPM, pacingPauseOnPunctuation, pacingAdaptiveSpeed);
        }
        return 60000 / effectiveWPM; // Fallback: 1 word duration
      case 'sentence':
        if (currentSentence) {
          return calculateSentenceDuration(currentSentence, effectiveWPM, pacingPauseOnPunctuation);
        }
        return 1000; // Fallback: 1 second
      default: { // block
        const wordCount = currentBlock ? getBlockWordCount(currentBlock) : 1;
        const duration = (wordCount / effectiveWPM) * 60 * 1000;
        return Math.max(500, duration); // Minimum 500ms per block
      }
    }
  }, [pacingGranularity, currentWord, currentSentence, currentBlock, effectiveWPM, pacingPauseOnPunctuation, pacingAdaptiveSpeed]);

  // Auto-advance timer
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Don't start timer if not playing or no blocks
    if (!isPlaying || blocks.length === 0 || !currentBlock) {
      return;
    }

    // Check if we're at the end of the document
    if (isLastBlock && isAtEndOfBlock) {
      // Trigger completion callback when reading ends
      if (isPlaying) {
        onComplete?.();
      }
      return;
    }

    const duration = getDuration();
    timerRef.current = window.setTimeout(advance, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    isPlaying,
    blocks.length,
    currentBlock,
    isLastBlock,
    isAtEndOfBlock,
    getDuration,
    advance,
    // Include position indices to restart timer on position change
    currentBlockIndex,
    currentSentenceIndex,
    currentWordIndex,
  ]);

  // Don't render anything - the BlockRenderer handles the visual highlighting
  // This component just manages the timing/auto-advance logic
  return null;
}
