/**
 * NoteEditorModal Component
 * 
 * Slide-in panel for editing annotation notes and changing highlight colors.
 * Slides in from the right, matching the Settings panel pattern.
 */

import { useState, useEffect, useRef } from 'react';
import { HIGHLIGHT_COLORS } from '@/types';
import type { Annotation } from '@/types';
import TagInput from '@/components/TagInput';

interface NoteEditorModalProps {
  /** The annotation being edited */
  annotation: Annotation;
  /** Available tag suggestions for autocomplete */
  tagSuggestions?: string[];
  /** Callback to save the note */
  onSave: (note: string) => Promise<void> | void;
  /** Callback to change the highlight color */
  onChangeColor: (color: string) => Promise<void> | void;
  /** Callback to update tags */
  onChangeTags: (tags: string[]) => Promise<void> | void;
  /** Callback to delete the annotation */
  onDelete: () => Promise<void> | void;
  /** Callback to close the modal */
  onClose: () => void;
}

export default function NoteEditorModal({
  annotation,
  tagSuggestions = [],
  onSave,
  onChangeColor,
  onChangeTags,
  onDelete,
  onClose,
}: NoteEditorModalProps) {
  const [note, setNote] = useState(annotation.note || '');
  const [tags, setTags] = useState<string[]>(annotation.tags || []);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Animate open on mount
  useEffect(() => {
    // Small delay to trigger CSS transition
    requestAnimationFrame(() => {
      setIsOpen(true);
    });
  }, []);

  // Focus textarea after panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 200); // Wait for slide animation
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm]);

  const handleClose = () => {
    setIsOpen(false);
    // Wait for animation to complete
    setTimeout(onClose, 200);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleSave = async () => {
    await onSave(note);
    // Only call onChangeTags if tags actually changed
    const oldTags = annotation.tags || [];
    const tagsChanged = tags.length !== oldTags.length || 
      tags.some((t, i) => oldTags[i] !== t);
    if (tagsChanged) {
      await onChangeTags(tags);
    }
    handleClose();
  };

  const handleDelete = async () => {
    if (showDeleteConfirm) {
      await onDelete();
      handleClose();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`slide-panel-backdrop ${isOpen ? 'open' : ''}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`slide-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-editor-title"
      >
        {/* Header */}
        <div className="slide-panel-header">
          <div>
            <h2 id="note-editor-title" className="slide-panel-title">Edit Note</h2>
          </div>
          <button
            onClick={handleClose}
            className="slide-panel-close"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="slide-panel-body space-y-5">
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
          <div className="flex items-center gap-3">
            <span className="text-sm opacity-70">Color:</span>
            <div className="flex items-center gap-1.5">
              {HIGHLIGHT_COLORS.map((colorOption) => (
                <button
                  key={colorOption.id}
                  className={`w-7 h-7 rounded-full transition-all ${
                    annotation.color === colorOption.color
                      ? 'ring-2 ring-offset-2'
                      : 'hover:scale-110'
                  }`}
                  style={{ 
                    backgroundColor: colorOption.color,
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--reader-link)',
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
            <label htmlFor="annotation-note" className="block text-sm opacity-70 mb-2">
              Note (optional)
            </label>
            <textarea
              ref={textareaRef}
              id="annotation-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add your thoughts about this passage..."
              className="w-full h-40 p-3 rounded bg-transparent resize-none focus:outline-none focus:ring-2"
              style={{
                border: '1px solid rgba(128, 128, 128, 0.2)',
                // @ts-expect-error CSS custom property
                '--tw-ring-color': 'var(--reader-link)',
              }}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm opacity-70 mb-2">
              Tags (optional)
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
              placeholder="Add tags..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="slide-panel-footer slide-panel-footer-split">
          <button
            onClick={handleDelete}
            className={`modal-btn ${
              showDeleteConfirm
                ? 'modal-btn-danger modal-btn-danger-confirm'
                : 'modal-btn-danger'
            }`}
          >
            {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="modal-btn modal-btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="modal-btn modal-btn-primary"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
