/**
 * ArchiveNotesModal Component
 * 
 * Modal to view annotations for an archived item when not in the reader.
 * Shows all annotations with options to delete or open the document.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ArchiveItem, Annotation } from '@/types';
import { 
  getDocumentKeyFromArchiveItem, 
  getAnnotations, 
  deleteAnnotation 
} from '@/lib/annotations-service';
import ExportDropdown from '@/components/ExportDropdown';

interface ArchiveNotesModalProps {
  item: ArchiveItem;
  onClose: () => void;
  onOpenDocument: (item: ArchiveItem, annotationId?: string) => void;
}

export default function ArchiveNotesModal({
  item,
  onClose,
  onOpenDocument,
}: ArchiveNotesModalProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Load annotations for this item
  useEffect(() => {
    const loadAnnotations = async () => {
      const documentKey = getDocumentKeyFromArchiveItem(item);
      if (documentKey) {
        const annots = await getAnnotations(documentKey);
        // Sort by position (by block ID and start word index)
        annots.sort((a, b) => {
          if (a.anchor.blockId !== b.anchor.blockId) {
            return a.anchor.blockId.localeCompare(b.anchor.blockId);
          }
          return a.anchor.startWordIndex - b.anchor.startWordIndex;
        });
        setAnnotations(annots);
      }
      setLoading(false);
    };
    loadAnnotations();
  }, [item]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDelete = useCallback(async (annotationId: string) => {
    if (confirmDeleteId !== annotationId) {
      setConfirmDeleteId(annotationId);
      return;
    }

    setDeletingId(annotationId);
    const documentKey = getDocumentKeyFromArchiveItem(item);
    if (documentKey) {
      await deleteAnnotation(documentKey, annotationId);
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  }, [confirmDeleteId, item]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const handleOpenAndNavigate = useCallback((annotationId?: string) => {
    onOpenDocument(item, annotationId);
    onClose();
  }, [item, onOpenDocument, onClose]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const highlightCount = annotations.length;
  const notesCount = annotations.filter(a => a.note && a.note.trim()).length;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg max-h-[80vh] rounded-lg shadow-xl flex flex-col"
        style={{ backgroundColor: 'var(--reader-bg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-reader-text/10">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-semibold truncate">{item.title}</h2>
            <p className="text-sm opacity-60 mt-1">
              {highlightCount} highlight{highlightCount !== 1 ? 's' : ''}
              {notesCount > 0 && `, ${notesCount} with notes`}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!loading && annotations.length > 0 && (
              <ExportDropdown
                annotations={annotations}
                documentTitle={item.title}
              />
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-reader-text/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div 
                className="animate-spin rounded-full h-6 w-6 border-b-2" 
                style={{ borderColor: 'var(--reader-link)' }} 
              />
            </div>
          )}

          {!loading && annotations.length === 0 && (
            <div className="text-center py-12 px-4">
              <svg 
                className="w-12 h-12 mx-auto mb-4 opacity-30"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <p className="opacity-60">No annotations found</p>
            </div>
          )}

          {!loading && annotations.length > 0 && (
            <div className="divide-y divide-reader-text/10">
              {annotations.map(annotation => (
                <div 
                  key={annotation.id} 
                  className="p-4 hover:bg-reader-text/5 transition-colors group"
                >
                  {/* Highlighted text with color indicator */}
                  <div className="flex items-start gap-2">
                    <div
                      className="w-1 min-h-[1.5rem] rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: annotation.color }}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm leading-relaxed rounded px-1.5 py-0.5 -mx-1.5"
                        style={{ backgroundColor: `${annotation.color}40` }}
                      >
                        "{annotation.anchor.textContent}"
                      </p>
                    </div>
                  </div>

                  {/* Note content */}
                  {annotation.note && annotation.note.trim() && (
                    <div className="mt-2 ml-3 pl-2 border-l-2 border-reader-text/20">
                      <p className="text-sm opacity-80 whitespace-pre-wrap">
                        {annotation.note}
                      </p>
                    </div>
                  )}

                  {/* Timestamp and actions */}
                  <div className="mt-2 ml-3 flex items-center justify-between">
                    <span className="text-xs opacity-50">
                      {formatDate(annotation.createdAt)}
                    </span>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenAndNavigate(annotation.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-reader-text/10 transition-colors"
                        style={{ color: 'var(--reader-link)' }}
                        title="Open and navigate to this highlight"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      
                      {confirmDeleteId === annotation.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(annotation.id)}
                            disabled={deletingId === annotation.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {deletingId === annotation.id ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            onClick={handleCancelDelete}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-reader-text/10 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleDelete(annotation.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete annotation"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-reader-text/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded hover:bg-reader-text/10 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => handleOpenAndNavigate()}
            className="px-4 py-2 text-sm rounded transition-colors"
            style={{ 
              backgroundColor: 'var(--reader-link)', 
              color: 'var(--reader-bg)' 
            }}
          >
            Open Document
          </button>
        </div>
      </div>
    </div>
  );
}
