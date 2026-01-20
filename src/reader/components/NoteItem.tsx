/**
 * NoteItem Component
 * 
 * Individual annotation item for the notes panel.
 * Shows the highlighted text, optional note, and action buttons.
 */

import { useState } from 'react';
import type { Annotation } from '@/types';
import { formatAnnotationForCopy, copyToClipboard } from '@/lib/annotations-export';

interface NoteItemProps {
  annotation: Annotation;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export default function NoteItem({
  annotation,
  onNavigate,
  onEdit,
  onDelete,
  onToggleFavorite,
}: NoteItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = formatAnnotationForCopy(annotation);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const hasNote = annotation.note && annotation.note.trim().length > 0;
  const notePreviewLength = 100;
  const isNoteLong = hasNote && annotation.note!.length > notePreviewLength;
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className="group border-b border-reader-text/10 last:border-b-0">
      {/* Clickable highlight area */}
      <button
        onClick={onNavigate}
        className="w-full text-left p-3 hover:bg-reader-text/5 transition-colors"
        title="Click to navigate to this highlight"
      >
        {/* Highlighted text with color indicator */}
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
            <div
              className="w-1 min-h-[1.5rem] rounded-full"
              style={{ backgroundColor: annotation.color }}
              aria-hidden="true"
            />
            {annotation.isFavorite && (
              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24" aria-label="Favorite">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            )}
          </div>
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
        {hasNote && (
          <div className="mt-2 ml-3 pl-2 border-l-2 border-reader-text/20">
            <p className="text-sm opacity-80">
              {isNoteLong && !isExpanded
                ? `${annotation.note!.slice(0, notePreviewLength)}...`
                : annotation.note}
            </p>
            {isNoteLong && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-xs text-reader-link hover:underline mt-1"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Tags */}
        {annotation.tags && annotation.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 ml-3">
            {annotation.tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded-full bg-reader-text/10 opacity-70"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs opacity-50 mt-2 ml-3">
          {formatDate(annotation.createdAt)}
        </p>
      </button>

      {/* Action buttons - visible on hover or focus */}
      <div className="flex items-center gap-1 px-3 pb-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <button
          onClick={onToggleFavorite}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-reader-text/10 transition-colors ${
            annotation.isFavorite ? 'text-yellow-500' : ''
          }`}
          title={annotation.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg className="w-3.5 h-3.5" fill={annotation.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          {annotation.isFavorite ? 'Starred' : 'Star'}
        </button>
        
        <button
          onClick={onEdit}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-reader-text/10 transition-colors"
          title="Edit annotation"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-reader-text/10 transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
        
        {showDeleteConfirm ? (
          <>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Confirm
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
            onClick={handleDelete}
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
  );
}
