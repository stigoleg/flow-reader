/**
 * AnnotationToolbar Component
 * 
 * A floating toolbar that appears when text is selected, allowing users to
 * create highlights with different colors or add notes.
 */

import { useEffect, useRef, useState } from 'react';
import { HIGHLIGHT_COLORS } from '@/types';
import type { SelectionRange } from '../hooks/useTextSelection';

interface AnnotationToolbarProps {
  /** The current selection range */
  selection: SelectionRange;
  /** Container element for positioning calculations */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Callback when a highlight color is clicked */
  onHighlight: (color: string) => void;
  /** Callback when "Add Note" is clicked */
  onAddNote: () => void;
  /** Callback when the toolbar should close */
  onClose: () => void;
}

export default function AnnotationToolbar({
  selection,
  containerRef,
  onHighlight,
  onAddNote,
  onClose,
}: AnnotationToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Calculate toolbar position based on selection
  useEffect(() => {
    if (!selection?.rect || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const selectionRect = selection.rect;
    const toolbarHeight = 48; // Approximate toolbar height
    const padding = 8;

    // Calculate horizontal center of selection relative to viewport
    const centerX = selectionRect.left + selectionRect.width / 2;
    
    // Check if we should show above or below
    const spaceAbove = selectionRect.top - containerRect.top;
    const shouldShowAbove = spaceAbove > toolbarHeight + padding;

    // Calculate Y position
    const y = shouldShowAbove
      ? selectionRect.top - toolbarHeight - padding
      : selectionRect.bottom + padding;

    setPosition({ x: centerX, y });
  }, [selection, containerRef]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 p-1.5 rounded-lg shadow-lg border border-reader-text/10"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--reader-bg)',
      }}
      role="toolbar"
      aria-label="Annotation toolbar"
    >
      {/* Color swatches */}
      <div className="flex items-center gap-1 px-1">
        {HIGHLIGHT_COLORS.map((colorOption) => (
          <button
            key={colorOption.id}
            className="w-6 h-6 rounded-full border-2 border-transparent hover:border-reader-text/50 transition-colors focus:outline-none focus:ring-2 focus:ring-reader-link"
            style={{ backgroundColor: colorOption.color }}
            onClick={() => onHighlight(colorOption.color)}
            title={`Highlight ${colorOption.label}`}
            aria-label={`Highlight with ${colorOption.label} color`}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-reader-text/20" />

      {/* Add Note button */}
      <button
        className="flex items-center gap-1.5 px-2 py-1 text-sm rounded hover:bg-reader-text/10 transition-colors focus:outline-none focus:ring-2 focus:ring-reader-link"
        onClick={onAddNote}
        title="Add a note to this highlight"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        <span>Note</span>
      </button>
    </div>
  );
}
