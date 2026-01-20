import { useEffect, useCallback, useState, useRef } from 'react';
import { ttsService, type TTSState, type TTSBoundaryEvent } from '@/lib/tts-service';
import type { Block, ReaderSettings } from '@/types';

interface UseTTSOptions {
  settings: ReaderSettings;
  blocks: Block[];
  currentBlockIndex: number;
  onBlockComplete?: () => void;
  onPositionUpdate?: (charIndex: number) => void;
}

interface UseTTSReturn {
  isAvailable: boolean;
  state: TTSState;
  isSpeaking: boolean;
  isPaused: boolean;
  speak: () => void;
  speakBlock: (blockIndex: number) => void;
  speakFromCurrent: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  toggle: () => void;
  currentCharIndex: number;
}

/**
 * Hook for text-to-speech functionality in the reader
 */
export function useTTS({
  settings,
  blocks,
  currentBlockIndex,
  onBlockComplete,
  onPositionUpdate,
}: UseTTSOptions): UseTTSReturn {
  const [state, setState] = useState<TTSState>('idle');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const speakingBlockRef = useRef<number>(-1);
  const autoAdvanceRef = useRef(false);

  const isAvailable = ttsService.isAvailable();

  // Sync TTS service settings with reader settings
  useEffect(() => {
    ttsService.updateSettings({
      enabled: settings.ttsEnabled,
      voiceId: settings.ttsVoiceId,
      rate: settings.ttsRate,
      pitch: settings.ttsPitch,
      volume: settings.ttsVolume,
      highlightMode: settings.ttsHighlightMode,
    });
  }, [
    settings.ttsEnabled,
    settings.ttsVoiceId,
    settings.ttsRate,
    settings.ttsPitch,
    settings.ttsVolume,
    settings.ttsHighlightMode,
  ]);

  // Subscribe to TTS state changes
  useEffect(() => {
    const unsubState = ttsService.onStateChange((newState) => {
      setState(newState);
    });

    const unsubBoundary = ttsService.onBoundary((event: TTSBoundaryEvent) => {
      setCurrentCharIndex(event.charIndex);
      onPositionUpdate?.(event.charIndex);
    });

    const unsubEnd = ttsService.onEnd(() => {
      setCurrentCharIndex(0);
      
      // Auto-advance to next block if enabled
      if (autoAdvanceRef.current && speakingBlockRef.current >= 0) {
        onBlockComplete?.();
      }
    });

    return () => {
      unsubState();
      unsubBoundary();
      unsubEnd();
    };
  }, [onBlockComplete, onPositionUpdate]);

  // Stop TTS when component unmounts or blocks change
  useEffect(() => {
    return () => {
      ttsService.stop();
    };
  }, []);

  // Get text content from a block
  const getBlockText = useCallback((block: Block): string => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'quote':
      case 'code':
        return block.content;
      case 'list':
        return block.items.join('. ');
      default:
        return '';
    }
  }, []);

  // Speak a specific block
  const speakBlock = useCallback((blockIndex: number) => {
    if (!isAvailable || blockIndex < 0 || blockIndex >= blocks.length) return;
    
    const block = blocks[blockIndex];
    const text = getBlockText(block);
    
    if (!text.trim()) return;
    
    speakingBlockRef.current = blockIndex;
    autoAdvanceRef.current = true;
    ttsService.speak(text);
  }, [isAvailable, blocks, getBlockText]);

  // Speak from current block
  const speakFromCurrent = useCallback(() => {
    speakBlock(currentBlockIndex);
  }, [speakBlock, currentBlockIndex]);

  // Speak all remaining text from current position
  const speak = useCallback(() => {
    speakFromCurrent();
  }, [speakFromCurrent]);

  const pause = useCallback(() => {
    ttsService.pause();
  }, []);

  const resume = useCallback(() => {
    ttsService.resume();
  }, []);

  const stop = useCallback(() => {
    autoAdvanceRef.current = false;
    speakingBlockRef.current = -1;
    ttsService.stop();
  }, []);

  const toggle = useCallback(() => {
    if (state === 'idle') {
      speakFromCurrent();
    } else if (state === 'speaking') {
      pause();
    } else if (state === 'paused') {
      resume();
    }
  }, [state, speakFromCurrent, pause, resume]);

  return {
    isAvailable,
    state,
    isSpeaking: state === 'speaking',
    isPaused: state === 'paused',
    speak,
    speakBlock,
    speakFromCurrent,
    pause,
    resume,
    stop,
    toggle,
    currentCharIndex,
  };
}
