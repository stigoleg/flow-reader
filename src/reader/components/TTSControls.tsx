import { useMemo } from 'react';

interface TTSControlsProps {
  isAvailable: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  onToggle: () => void;
  onStop: () => void;
}

/**
 * Floating TTS controls that appear when TTS is enabled
 */
export default function TTSControls({
  isAvailable,
  isSpeaking,
  isPaused,
  onToggle,
  onStop,
}: TTSControlsProps) {
  if (!isAvailable) return null;

  const isActive = isSpeaking || isPaused;

  const buttonIcon = useMemo(() => {
    if (isSpeaking) {
      // Pause icon
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
        </svg>
      );
    }
    // Play/speak icon
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7L8 5z" />
      </svg>
    );
  }, [isSpeaking]);

  return (
    <div 
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 p-2 rounded-full shadow-lg"
      style={{
        backgroundColor: 'var(--reader-bg)',
        border: '1px solid rgba(128, 128, 128, 0.3)',
      }}
    >
      {/* Play/Pause button */}
      <button
        onClick={onToggle}
        className="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
        style={{
          backgroundColor: isActive ? 'var(--reader-highlight)' : 'transparent',
        }}
        title={isSpeaking ? 'Pause' : isPaused ? 'Resume' : 'Speak'}
        aria-label={isSpeaking ? 'Pause speech' : isPaused ? 'Resume speech' : 'Start speaking'}
      >
        {buttonIcon}
      </button>

      {/* Stop button - only show when active */}
      {isActive && (
        <button
          onClick={onStop}
          className="w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:opacity-70"
          title="Stop"
          aria-label="Stop speaking"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h12v12H6V6z" />
          </svg>
        </button>
      )}

      {/* TTS indicator */}
      {isSpeaking && (
        <div className="flex items-center gap-1 px-2">
          <div className="w-1.5 h-3 rounded-full bg-current animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-4 rounded-full bg-current animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-3 rounded-full bg-current animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
}
