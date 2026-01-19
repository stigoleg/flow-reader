import { useEffect, useRef } from 'react';
import { tokenizeForRSVP, calculateTokenDuration, findORP, getWordCount } from '@/lib/tokenizer';
import { useReaderStore } from '../store';
import { useSpeedRamp } from '../hooks/useSpeedRamp';

interface RSVPModeProps {
  text: string;
  wpm: number;
  isPlaying: boolean;
  // Note: Heading pause (pacingHeadingPause) is not applied in RSVP mode
  // because RSVP uses flattened plainText without block structure.
  // This could be added in future by passing blocks instead of text.
}

export default function RSVPMode({ text, wpm, isPlaying }: RSVPModeProps) {
  const { 
    settings, 
    adjustWPM, 
    currentRsvpIndex, 
    setRsvpIndex,
    setRsvpTokenCount,
    rsvpAdvance,
  } = useReaderStore();
  const timerRef = useRef<number | null>(null);

  const tokens = tokenizeForRSVP(text, settings.rsvpChunkSize);
  const totalWords = getWordCount(text);
  const currentToken = tokens[currentRsvpIndex];

  // Update token count in store when tokens change
  useEffect(() => {
    setRsvpTokenCount(tokens.length);
  }, [tokens.length, setRsvpTokenCount]);

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

    timerRef.current = window.setTimeout(rsvpAdvance, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentRsvpIndex, currentToken, wpm, settings.rsvpPauseOnPunctuation, rsvpAdvance]);

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

  const progress = ((currentRsvpIndex + 1) / tokens.length) * 100;
  const wordsRead = Math.round((currentRsvpIndex / tokens.length) * totalWords);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center pt-16 pb-8 px-4">
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
          value={currentRsvpIndex}
          onChange={(e) => setRsvpIndex(Number(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}
