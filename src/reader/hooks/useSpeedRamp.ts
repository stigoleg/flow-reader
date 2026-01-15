import { useEffect, useRef } from 'react';

export interface UseSpeedRampOptions {
  /** Whether playback is active */
  isPlaying: boolean;
  /** Current words per minute */
  wpm: number;
  /** Target WPM to ramp up to */
  targetWPM: number;
  /** Whether speed ramp-up is enabled */
  rampEnabled: boolean;
  /** WPM increment per interval */
  rampStep: number;
  /** Interval in seconds between WPM increases */
  rampInterval: number;
  /** Callback to adjust the WPM by a delta */
  onAdjustWPM: (delta: number) => void;
}

/**
 * Hook for managing speed ramp-up during reading.
 * Gradually increases WPM from current speed to target speed while playing.
 * 
 * Used by both PacingMode and RSVPMode.
 */
export function useSpeedRamp({
  isPlaying,
  wpm,
  targetWPM,
  rampEnabled,
  rampStep,
  rampInterval,
  onAdjustWPM,
}: UseSpeedRampOptions): void {
  const rampTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing ramp timer
    if (rampTimerRef.current) {
      clearInterval(rampTimerRef.current);
      rampTimerRef.current = null;
    }

    // Only start ramp timer if playing and ramp is enabled
    if (!isPlaying || !rampEnabled || wpm >= targetWPM) {
      return;
    }

    // Ramp interval is in seconds, convert to ms
    const intervalMs = rampInterval * 1000;

    rampTimerRef.current = window.setInterval(() => {
      // Calculate the increment, but don't exceed target
      const increment = Math.min(rampStep, targetWPM - wpm);
      if (increment > 0) {
        onAdjustWPM(increment);
      } else {
        // Reached target, stop the timer
        if (rampTimerRef.current) {
          clearInterval(rampTimerRef.current);
          rampTimerRef.current = null;
        }
      }
    }, intervalMs);

    return () => {
      if (rampTimerRef.current) {
        clearInterval(rampTimerRef.current);
        rampTimerRef.current = null;
      }
    };
  }, [isPlaying, rampEnabled, rampStep, rampInterval, targetWPM, wpm, onAdjustWPM]);
}
