/**
 * NoteEditorModal Component
 * 
 * Modal for editing annotation notes and changing highlight colors.
 */

import { useState, useEffect, useRef } from 'react';
import { HIGHLIGHT_COLORS } from '@/types';
import type { Annotation } from '@/types';

interface NoteEditorModalProps {
  /** The annotation being edited */
  annotation: Annotation;
  /** Callback to save the note */
  onSave: (note: string) => void;
  /** Callback to change the highlight color */
  onChangeColor: (color: string) => void;
  /** Callback to delete the annotation */
  onDelete: () => void;
  /** Callback to close the modal */
  onClose: () => void;
}

export default function NoteEditorModal({
  annotation,
  onSave,
  onChangeColor,
  onDelete,
  onClose,
}: NoteEditorModalProps) {
  const [note, setNote] = useState(annotation.note || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus textarea on open
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showDeleteConfirm]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSave = () => {
    onSave(note);
    onClose();
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="w-full max-w-md mx-4 rounded-lg shadow-xl border border-reader-text/10"
        style={{ backgroundColor: 'var(--reader-bg)' }}
        role="dialog"
        aria-label="Edit annotation note"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-reader-text/10">
          <h2 className="text-lg font-medium">Edit Note</h2>
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

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Highlighted text preview */}
          <div
            className="p-3 rounded text-sm"
            style={{ backgroundColor: annotation.color }}
          >
            <span className="text-gray-800 italic">
              "{annotation.anchor.textContent}"
            </span>
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-reader-text/70">Color:</span>
            <div className="flex items-center gap-1">
              {HIGHLIGHT_COLORS.map((colorOption) => (
                <button
                  key={colorOption.id}
                  className={`w-6 h-6 rounded-full transition-all ${
                    annotation.color === colorOption.color
                      ? 'ring-2 ring-offset-2 ring-reader-link'
                      : 'hover:scale-110'
                  }`}
                  style={{ 
                    backgroundColor: colorOption.color,
                    // @ts-expect-error CSS custom property
                    '--tw-ring-offset-color': 'var(--reader-bg)',
                  }}
                  onClick={() => onChangeColor(colorOption.color)}
                  title={colorOption.label}
                  aria-label={`Change to ${colorOption.label}`}
                  aria-pressed={annotation.color === colorOption.color}
                />
              ))}
            </div>
          </div>

          {/* Note textarea */}
          <div>
            <label htmlFor="annotation-note" className="block text-sm text-reader-text/70 mb-1">
              Note (optional)
            </label>
            <textarea
              ref={textareaRef}
              id="annotation-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add your thoughts about this passage..."
              className="w-full h-32 p-3 rounded border border-reader-text/20 bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-reader-link"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-reader-text/10">
          <button
            onClick={handleDelete}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              showDeleteConfirm
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'text-red-500 hover:bg-red-500/10'
            }`}
          >
            {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded hover:bg-reader-text/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm rounded hover:opacity-90 transition-opacity"
              style={{ 
                backgroundColor: 'var(--reader-link)',
                color: 'white',
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
