/**
 * NotesPanel Component
 * 
 * Slide-in panel that displays all annotations/highlights for the current document.
 * Allows users to view, navigate to, edit, and delete annotations.
 */

import { useEffect, useMemo } from 'react';
import type { Annotation } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';
import NoteItem from './NoteItem';
import ExportDropdown from '@/components/ExportDropdown';

interface NotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  annotations: Annotation[];
  documentTitle?: string;
  onNavigateToAnnotation: (annotation: Annotation) => void;
  onEditAnnotation: (annotation: Annotation) => void;
  onDeleteAnnotation: (id: string) => void;
}

export default function NotesPanel({
  isOpen,
  onClose,
  annotations,
  documentTitle,
  onNavigateToAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
}: NotesPanelProps) {
  // Sort annotations by position (block index, then word index)
  const sortedAnnotations = useMemo(() => {
    return [...annotations].sort((a, b) => {
      const blockA = parseInt(a.anchor.blockId, 10) || 0;
      const blockB = parseInt(b.anchor.blockId, 10) || 0;
      if (blockA !== blockB) return blockA - blockB;
      return a.anchor.startWordIndex - b.anchor.startWordIndex;
    });
  }, [annotations]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = annotations.length;
    const withNotes = annotations.filter(a => a.note && a.note.trim().length > 0).length;
    const byColor = HIGHLIGHT_COLORS.map(color => ({
      ...color,
      count: annotations.filter(a => a.color === color.color).length,
    })).filter(c => c.count > 0);
    
    return { total, withNotes, byColor };
  }, [annotations]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-90"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        className={`settings-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Notes and Highlights"
        aria-modal={isOpen}
        inert={!isOpen ? true : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">Notes & Highlights</h2>
            {documentTitle && (
              <p className="text-sm opacity-60 truncate">{documentTitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {stats.total > 0 && (
              <ExportDropdown
                annotations={sortedAnnotations}
                documentTitle={documentTitle || 'Document'}
              />
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 md:w-8 md:h-8"
              aria-label="Close notes panel"
            >
              <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats summary */}
        {stats.total > 0 && (
          <div className="mb-4 pb-4 border-b border-reader-text/10">
            <div className="flex items-center gap-4 text-sm">
              <span className="opacity-70">
                {stats.total} highlight{stats.total !== 1 ? 's' : ''}
              </span>
              {stats.withNotes > 0 && (
                <span className="opacity-70">
                  {stats.withNotes} with note{stats.withNotes !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {/* Color breakdown */}
            {stats.byColor.length > 1 && (
              <div className="flex items-center gap-2 mt-2">
                {stats.byColor.map(color => (
                  <div
                    key={color.id}
                    className="flex items-center gap-1"
                    title={`${color.count} ${color.label}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color.color }}
                    />
                    <span className="text-xs opacity-60">{color.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Annotations list */}
        <div className="flex-1 overflow-y-auto -mx-4 px-4">
          {sortedAnnotations.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 mx-auto mb-4 opacity-30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              <p className="text-sm opacity-60 mb-2">No highlights yet</p>
              <p className="text-xs opacity-40">
                Select text while reading to create highlights and notes
              </p>
            </div>
          ) : (
            <div className="divide-y divide-reader-text/10">
              {sortedAnnotations.map(annotation => (
                <NoteItem
                  key={annotation.id}
                  annotation={annotation}
                  onNavigate={() => onNavigateToAnnotation(annotation)}
                  onEdit={() => onEditAnnotation(annotation)}
                  onDelete={() => onDeleteAnnotation(annotation.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {sortedAnnotations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-reader-text/10">
            <p className="text-xs opacity-40 text-center">
              Click on a highlight to jump to that position
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
