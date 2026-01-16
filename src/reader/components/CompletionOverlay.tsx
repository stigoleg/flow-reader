import { useReaderStore } from '../store';

interface CompletionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onReadAgain: () => void;
  onImportNew: () => void;
}

export default function CompletionOverlay({ 
  isOpen, 
  onClose, 
  onReadAgain,
  onImportNew,
}: CompletionOverlayProps) {
  const { document, accumulatedReadingTime, currentWPM } = useReaderStore();

  if (!isOpen || !document) return null;

  // Calculate reading statistics
  const elapsedMs = accumulatedReadingTime;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
  
  const wordCount = document.plainText.split(/\s+/).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md rounded-xl shadow-2xl z-[201] overflow-hidden fade-in"
        style={{
          backgroundColor: 'var(--reader-bg)',
          color: 'var(--reader-text)',
          border: '1px solid rgba(128, 128, 128, 0.3)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-title"
      >
        <div className="p-8 text-center">
          {/* Checkmark icon */}
          <div 
            className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
            aria-hidden="true"
          >
            <svg 
              className="w-8 h-8" 
              fill="none" 
              stroke="rgb(34, 197, 94)" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2.5} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>

          {/* Title */}
          <h2 id="completion-title" className="text-2xl font-bold mb-2">Reading Complete!</h2>
          <p className="opacity-60 mb-6">You've finished "{document.metadata.title}"</p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8 py-4 border-y border-current/10" role="group" aria-label="Reading statistics">
            <div>
              <p className="text-2xl font-bold" aria-label={`${wordCount.toLocaleString()} words`}>{wordCount.toLocaleString()}</p>
              <p className="text-xs opacity-50 uppercase tracking-wide" aria-hidden="true">Words</p>
            </div>
            <div>
              <p className="text-2xl font-bold" aria-label={`${elapsedMinutes} minutes ${elapsedSeconds} seconds`}>
                {elapsedMinutes > 0 ? `${elapsedMinutes}m ${elapsedSeconds}s` : `${elapsedSeconds}s`}
              </p>
              <p className="text-xs opacity-50 uppercase tracking-wide" aria-hidden="true">Time</p>
            </div>
            <div>
              <p className="text-2xl font-bold" aria-label={`${currentWPM} words per minute`}>{currentWPM}</p>
              <p className="text-xs opacity-50 uppercase tracking-wide" aria-hidden="true">WPM</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={onReadAgain}
              className="w-full py-3 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--reader-link)',
                color: '#ffffff',
              }}
            >
              Read Again
            </button>
            <button
              onClick={onImportNew}
              className="w-full py-3 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(128, 128, 128, 0.15)',
              }}
            >
              Import New Content
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm opacity-60 hover:opacity-100 transition-opacity"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
