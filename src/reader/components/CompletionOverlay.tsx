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
  const { 
    document, 
    accumulatedReadingTime, 
    currentWPM, 
    currentChapterIndex 
  } = useReaderStore();
  const nextChapter = useReaderStore(state => state.nextChapter);

  if (!isOpen || !document) return null;

  // Book/chapter detection
  const isBook = !!document.book;
  const chapters = document.book?.chapters;
  const hasNextChapter = isBook && chapters && currentChapterIndex < chapters.length - 1;
  const isBookComplete = isBook && chapters && currentChapterIndex === chapters.length - 1;
  const currentChapterData = chapters?.[currentChapterIndex];
  const currentChapterTitle = currentChapterData?.title;

  // Calculate reading statistics
  const elapsedMs = accumulatedReadingTime;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
  
  // For books, show chapter word count; for articles, show total
  const wordCount = isBook && currentChapterData
    ? currentChapterData.wordCount
    : document.plainText.split(/\s+/).length;

  // Determine title and subtitle
  const title = isBook
    ? (isBookComplete ? 'Book Complete!' : 'Chapter Complete!')
    : 'Reading Complete!';
  
  const subtitle = isBook
    ? (isBookComplete 
        ? `You've finished "${document.metadata.title}"`
        : `You've finished "${currentChapterTitle}"`)
    : `You've finished "${document.metadata.title}"`;

  // Handle next chapter
  const handleNextChapter = () => {
    onClose();
    nextChapter();
  };

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
          <h2 id="completion-title" className="text-2xl font-bold mb-2">{title}</h2>
          <p className="opacity-60 mb-6">{subtitle}</p>

          {/* Progress indicator for books */}
          {isBook && chapters && !isBookComplete && (
            <p className="text-sm opacity-50 mb-4">
              Chapter {currentChapterIndex + 1} of {chapters.length}
            </p>
          )}

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
            {/* Next Chapter button - primary action when available */}
            {hasNextChapter && (
              <button
                onClick={handleNextChapter}
                className="w-full py-3 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--reader-link)',
                  color: '#ffffff',
                }}
              >
                Next Chapter
              </button>
            )}
            
            {/* Close Page - closes the reader tab */}
            <button
              onClick={() => window.close()}
              className="w-full py-3 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: hasNextChapter 
                  ? 'rgba(128, 128, 128, 0.15)' 
                  : 'var(--reader-link)',
                color: hasNextChapter ? undefined : '#ffffff',
              }}
            >
              Close Page
            </button>
            
            <button
              onClick={onReadAgain}
              className="w-full py-3 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(128, 128, 128, 0.15)',
              }}
            >
              {isBook ? 'Read Chapter Again' : 'Read Again'}
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
