/**
 * Clear History Dialog
 * 
 * Confirmation dialog for clearing all history.
 */

import { useEscapeKey } from '@/hooks/useEscapeKey';

interface ClearHistoryDialogProps {
  onClose: () => void;
  onConfirm: () => void;
}

export default function ClearHistoryDialog({ onClose, onConfirm }: ClearHistoryDialogProps) {
  useEscapeKey(onClose);
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content max-w-sm"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-dialog-title"
        aria-describedby="clear-dialog-description"
      >
        <div className="modal-body text-center py-6">
          <div 
            className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 id="clear-dialog-title" className="text-lg font-semibold mb-2">
            Clear all history?
          </h2>
          <p id="clear-dialog-description" className="text-sm opacity-70">
            This will remove all items from your reading archive. This action cannot be undone.
          </p>
        </div>
        
        <div className="modal-footer justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: 'rgba(128, 128, 128, 0.1)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: '#dc2626',
              color: 'white',
            }}
          >
            Clear History
          </button>
        </div>
      </div>
    </div>
  );
}
