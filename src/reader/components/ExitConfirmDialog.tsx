import { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';

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

  // Handle Enter key to confirm
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleConfirm]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Close FlowReader?"
      size="sm"
      ariaLabelledBy="exit-confirm-title"
    >
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
    </Modal>
  );
}
