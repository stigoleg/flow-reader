/**
 * EditPasteModal Component
 * 
 * Slide-in panel for editing pasted text content (supports markdown).
 * Allows users to modify the original paste and re-process it.
 */

import { useState, useEffect, useRef } from 'react';

interface EditPasteModalProps {
  /** The original paste content to edit */
  initialContent: string;
  /** Callback to save the edited content */
  onSave: (content: string) => Promise<void> | void;
  /** Callback to close the modal */
  onClose: () => void;
}

export default function EditPasteModal({
  initialContent,
  onSave,
  onClose,
}: EditPasteModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Animate open on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsOpen(true);
    });
  }, []);

  // Focus textarea after panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(content);
      handleClose();
    } catch (error) {
      console.error('Failed to save paste content:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = content !== initialContent;
  const isEmpty = !content.trim();

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
        className={`slide-panel slide-panel-lg ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-paste-title"
      >
        {/* Header */}
        <div className="slide-panel-header">
          <div>
            <h2 id="edit-paste-title" className="slide-panel-title">Edit Content</h2>
            <p className="slide-panel-subtitle">
              Markdown formatting is supported
            </p>
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
        <div className="slide-panel-body flex flex-col h-full">
          {/* Content textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your text here..."
            className="flex-1 w-full p-3 rounded bg-transparent resize-none focus:outline-none focus:ring-2 font-mono text-sm min-h-[300px]"
            style={{
              border: '1px solid rgba(128, 128, 128, 0.2)',
              // @ts-expect-error CSS custom property
              '--tw-ring-color': 'var(--reader-link)',
            }}
          />

          {/* Character count */}
          <div className="text-xs opacity-50 text-right mt-2">
            {content.length.toLocaleString()} characters
          </div>
        </div>

        {/* Footer */}
        <div className="slide-panel-footer">
          <button
            onClick={handleClose}
            className="modal-btn modal-btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isEmpty || isSaving || !hasChanges}
            className="modal-btn modal-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save & Update'}
          </button>
        </div>
      </div>
    </>
  );
}
