import { useEffect, useState, useCallback } from 'react';

interface ExitConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (dontShowAgain: boolean) => void;
}

export default function ExitConfirmDialog({ isOpen, onCancel, onConfirm }: ExitConfirmDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleConfirm = useCallback(() => {
    onConfirm(dontShowAgain);
  }, [onConfirm, dontShowAgain]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onCancel, handleConfirm]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-confirm-title"
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-sm rounded-xl shadow-2xl z-[201] overflow-hidden fade-in"
        style={{
          backgroundColor: 'var(--reader-bg)',
          color: 'var(--reader-text)',
          border: '1px solid rgba(128, 128, 128, 0.3)',
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 id="exit-confirm-title" className="text-lg font-semibold">Close FlowReader?</h2>
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Cancel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Message */}
          <p className="text-sm opacity-80 mb-6">
            Are you sure you want to close? Your reading position is saved automatically.
          </p>

          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm opacity-70">Don't show this again</span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-lg transition-colors"
              style={{
                backgroundColor: 'rgba(128, 128, 128, 0.15)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm rounded-lg transition-colors bg-red-600 hover:bg-red-700 text-white"
            >
              Close
            </button>
          </div>

          {/* Footer hint */}
          <div className="mt-4 pt-3 border-t border-current/10 text-center">
            <p className="text-xs opacity-50">
              Press <kbd className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(128, 128, 128, 0.15)' }}>Esc</kbd> to cancel or <kbd className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(128, 128, 128, 0.15)' }}>Enter</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
