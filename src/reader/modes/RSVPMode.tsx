import { useEffect, useState, useRef, useCallback } from 'react';
import { tokenizeForRSVP, calculateTokenDuration, findORP, getWordCount } from '@/lib/tokenizer';
import { useReaderStore } from '../store';
import { useSpeedRamp } from '../hooks/useSpeedRamp';

interface RSVPModeProps {
  text: string;
  wpm: number;
  isPlaying: boolean;
}

export default function RSVPMode({ text, wpm, isPlaying }: RSVPModeProps) {
  const { settings, adjustWPM, showCompletion } = useReaderStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWarning, setShowWarning] = useState(true);
  const timerRef = useRef<number | null>(null);

  const tokens = tokenizeForRSVP(text, settings.rsvpChunkSize);
  const totalWords = getWordCount(text);
  const currentToken = tokens[currentIndex];

  // Speed ramp-up effect (shared hook)
  useSpeedRamp({
    isPlaying,
    wpm,
    targetWPM: settings.targetWPM,
    rampEnabled: settings.rampEnabled,
    rampStep: settings.rampStep,
    rampInterval: settings.rampInterval,
    onAdjustWPM: adjustWPM,
  });

  // Advance to next token
  const advance = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev >= tokens.length - 1) {
        // Show completion overlay when reaching the end
        showCompletion();
        return prev;
      }
      return prev + 1;
    });
  }, [tokens.length, showCompletion]);

  // Timer for auto-advance
  useEffect(() => {
    if (!isPlaying || !currentToken) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      return;
    }

    const duration = calculateTokenDuration(
      currentToken,
      wpm,
      settings.rsvpPauseOnPunctuation
    );

    timerRef.current = window.setTimeout(advance, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentIndex, currentToken, wpm, settings.rsvpPauseOnPunctuation, advance]);

  // Keyboard controls for RSVP
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'j':
          e.preventDefault();
          advance();
          break;
        case 'ArrowLeft':
        case 'k':
          e.preventDefault();
          setCurrentIndex((prev) => Math.max(0, prev - 1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advance]);

  // Dismiss warning
  const dismissWarning = () => setShowWarning(false);

  if (!currentToken) {
    return (
      <div className="rsvp-container">
        <p className="opacity-60">No content to display</p>
      </div>
    );
  }

  // Render the word with ORP highlight
  const renderWord = (word: string) => {
    const orpIndex = findORP(word);
    const before = word.slice(0, orpIndex);
    const orp = word[orpIndex] || '';
    const after = word.slice(orpIndex + 1);

    return (
      <>
        <span>{before}</span>
        <span className="rsvp-orp">{orp}</span>
        <span>{after}</span>
      </>
    );
  };

  const progress = ((currentIndex + 1) / tokens.length) * 100;
  const wordsRead = Math.round((currentIndex / tokens.length) * totalWords);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center pt-16 pb-8 px-4">
      {/* Warning modal */}
      {showWarning && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 z-50" />

          {/* Modal */}
          <div
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md rounded-xl shadow-2xl z-50 overflow-hidden"
            style={{
              backgroundColor: 'var(--reader-bg)',
              color: 'var(--reader-text)',
              border: '1px solid rgba(128, 128, 128, 0.3)',
            }}
          >
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-3">RSVP Mode</h2>
              <p className="text-sm opacity-80 mb-4">
                Rapid Serial Visual Presentation shows one word at a time at high speed.
                While this can help train reading speed, research suggests it may reduce
                comprehension for long-form reading. Use this mode for training exercises
                rather than important content.
              </p>
              <button
                onClick={dismissWarning}
                className="w-full py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--reader-link)',
                  color: '#ffffff',
                }}
              >
                I understand, continue
              </button>
            </div>
          </div>
        </>
      )}

      {/* RSVP display */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {/* Focus guides */}
          <div className="relative inline-block">
            <div className="absolute left-1/2 -translate-x-1/2 -top-4 w-0.5 h-3 bg-current opacity-30" />
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 w-0.5 h-3 bg-current opacity-30" />

            {/* Word display */}
            <div className="rsvp-word font-reader min-w-[200px]">
              {renderWord(currentToken.text)}
            </div>
          </div>
        </div>
      </div>

      {/* Progress and controls */}
      <div className="w-full max-w-md space-y-4">
        {/* Progress bar */}
        <div className="h-1 bg-current/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-current/40 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats */}
        <div className="flex justify-between text-sm opacity-60">
          <span>{wordsRead} / {totalWords} words</span>
          <span>{wpm} WPM</span>
        </div>

        {/* Scrub slider */}
        <input
          type="range"
          min="0"
          max={tokens.length - 1}
          value={currentIndex}
          onChange={(e) => setCurrentIndex(Number(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}
