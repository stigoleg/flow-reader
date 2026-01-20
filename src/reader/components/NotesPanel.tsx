/**
 * NotesPanel Component
 * 
 * Slide-in panel that displays all annotations/highlights for the current document.
 * Allows users to view, navigate to, edit, and delete annotations.
 */

import { useEffect, useMemo, useState } from 'react';
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
  onToggleFavorite: (id: string) => void;
  onImportAnnotations?: (data: { text: string; note: string | null; color: string; isFavorite?: boolean; tags?: string[]; createdAt: string }[]) => Promise<{ imported: number; skipped: number }>;
}

export default function NotesPanel({
  isOpen,
  onClose,
  annotations,
  documentTitle,
  onNavigateToAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  onToggleFavorite,
  onImportAnnotations,
}: NotesPanelProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Reset filters when panel closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setColorFilter(null);
      setTagFilter(null);
      setShowFavoritesOnly(false);
    }
  }, [isOpen]);

  // Sort annotations by position (block index, then word index)
  const sortedAnnotations = useMemo(() => {
    return [...annotations].sort((a, b) => {
      const blockA = parseInt(a.anchor.blockId, 10) || 0;
      const blockB = parseInt(b.anchor.blockId, 10) || 0;
      if (blockA !== blockB) return blockA - blockB;
      return a.anchor.startWordIndex - b.anchor.startWordIndex;
    });
  }, [annotations]);

  // Apply filters
  const filteredAnnotations = useMemo(() => {
    let result = sortedAnnotations;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.anchor.textContent.toLowerCase().includes(query) ||
        a.note?.toLowerCase().includes(query) ||
        a.tags?.some(t => t.toLowerCase().includes(query))
      );
    }
    
    // Color filter
    if (colorFilter) {
      result = result.filter(a => a.color === colorFilter);
    }
    
    // Tag filter
    if (tagFilter) {
      result = result.filter(a => a.tags?.includes(tagFilter));
    }
    
    // Favorites filter
    if (showFavoritesOnly) {
      result = result.filter(a => a.isFavorite);
    }
    
    return result;
  }, [sortedAnnotations, searchQuery, colorFilter, tagFilter, showFavoritesOnly]);

  // Get unique tags for filter dropdown
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    annotations.forEach(a => a.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [annotations]);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || colorFilter || tagFilter || showFavoritesOnly;

  // Calculate stats
  const stats = useMemo(() => {
    const total = annotations.length;
    const withNotes = annotations.filter(a => a.note && a.note.trim().length > 0).length;
    const favorites = annotations.filter(a => a.isFavorite).length;
    const byColor = HIGHLIGHT_COLORS.map(color => ({
      ...color,
      count: annotations.filter(a => a.color === color.color).length,
    })).filter(c => c.count > 0);
    
    return { total, withNotes, favorites, byColor };
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
            <ExportDropdown
              annotations={sortedAnnotations}
              documentTitle={documentTitle || 'Document'}
              onImport={onImportAnnotations}
            />
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
              {stats.favorites > 0 && (
                <span className="opacity-70 flex items-center gap-1">
                  <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {stats.favorites}
                </span>
              )}
            </div>
            
            {/* Filter controls */}
            <div className="mt-3 space-y-2">
              {/* Search input */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search highlights..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-reader-text/20 bg-transparent focus:outline-none focus:ring-1 focus:ring-reader-link"
                />
              </div>
              
              {/* Color and tag filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Color filter - clickable dots */}
                {stats.byColor.length > 0 && (
                  <div className="flex items-center gap-1">
                    {stats.byColor.map(color => (
                      <button
                        key={color.id}
                        onClick={() => setColorFilter(colorFilter === color.color ? null : color.color)}
                        className={`w-5 h-5 rounded-full transition-all flex items-center justify-center ${
                          colorFilter === color.color ? 'ring-2 ring-reader-link ring-offset-1' : 'hover:scale-110'
                        }`}
                        style={{ 
                          backgroundColor: color.color,
                          // @ts-expect-error CSS custom property
                          '--tw-ring-offset-color': 'var(--reader-bg)',
                        }}
                        title={`Filter by ${color.label} (${color.count})`}
                      >
                        {colorFilter === color.color && (
                          <svg className="w-3 h-3 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Favorites filter */}
                {stats.favorites > 0 && (
                  <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
                      showFavoritesOnly 
                        ? 'bg-yellow-500/20 text-yellow-600' 
                        : 'bg-reader-text/5 hover:bg-reader-text/10 opacity-70'
                    }`}
                    title="Show favorites only"
                  >
                    <svg className="w-3 h-3" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Starred
                  </button>
                )}
                
                {/* Tag filter chips */}
                {allTags.slice(0, 5).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                      tagFilter === tag 
                        ? 'bg-reader-link/20 text-reader-link' 
                        : 'bg-reader-text/5 hover:bg-reader-text/10 opacity-70'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
              
              {/* Active filter indicator */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between text-xs">
                  <span className="opacity-60">
                    Showing {filteredAnnotations.length} of {stats.total}
                  </span>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setColorFilter(null);
                      setTagFilter(null);
                      setShowFavoritesOnly(false);
                    }}
                    className="text-reader-link hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Annotations list */}
        <div className="flex-1 overflow-y-auto -mx-4 px-4">
          {filteredAnnotations.length === 0 ? (
            <div className="text-center py-12">
              {hasActiveFilters ? (
                <>
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
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p className="text-sm opacity-60 mb-2">No matching highlights</p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setColorFilter(null);
                      setTagFilter(null);
                      setShowFavoritesOnly(false);
                    }}
                    className="text-xs text-reader-link hover:underline"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-reader-text/10">
              {filteredAnnotations.map(annotation => (
                <NoteItem
                  key={annotation.id}
                  annotation={annotation}
                  onNavigate={() => onNavigateToAnnotation(annotation)}
                  onEdit={() => onEditAnnotation(annotation)}
                  onDelete={() => onDeleteAnnotation(annotation.id)}
                  onToggleFavorite={() => onToggleFavorite(annotation.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {filteredAnnotations.length > 0 && (
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
