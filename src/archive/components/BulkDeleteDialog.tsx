/**
 * Bulk Delete Dialog
 * 
 * Confirmation dialog before bulk deleting items.
 */

interface BulkDeleteDialogProps {
  count: number;
  onClose: () => void;
  onConfirm: () => void;
}

export default function BulkDeleteDialog({
  count,
  onClose,
  onConfirm,
}: BulkDeleteDialogProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '400px' }}
      >
        <div className="modal-header">
          <h2 className="modal-title">Delete {count} Item{count !== 1 ? 's' : ''}?</h2>
          <button
            onClick={onClose}
            className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="modal-body">
          <p className="text-sm opacity-80">
            This will permanently remove {count} item{count !== 1 ? 's' : ''} from your archive. 
            This action cannot be undone.
          </p>
        </div>
        
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Delete {count} Item{count !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
