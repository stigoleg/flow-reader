/**
 * AllAnnotationsModal Component
 * 
 * Global annotations browser showing all annotations across all documents.
 * Provides search, filtering, grouping, and navigation to specific annotations.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ArchiveItem, Annotation } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';
import { 
  getAllAnnotations, 
  getDocumentKeyFromArchiveItem,
  deleteAnnotation,
} from '@/lib/annotations-service';
import { queryRecents } from '@/lib/recents-service';

interface AllAnnotationsModalProps {
  onClose: () => void;
  onOpenDocument: (item: ArchiveItem, annotationId?: string) => void;
}

type AnnotationWithDoc = Annotation & {
  documentKey: string;
  archiveItem?: ArchiveItem;
};

type GroupBy = 'document' | 'date' | 'tag';

export default function AllAnnotationsModal({
  onClose,
  onOpenDocument,
}: AllAnnotationsModalProps) {
  const [loading, setLoading] = useState(true);
  const [annotations, setAnnotations] = useState<AnnotationWithDoc[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Grouping
  const [groupBy, setGroupBy] = useState<GroupBy>('document');

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    const load = async () => {
      const [allAnnotations, items] = await Promise.all([
        getAllAnnotations(),
        queryRecents(),
      ]);

      // Build lookup: documentKey → ArchiveItem
      const keyToItem = new Map<string, ArchiveItem>();
      for (const item of items) {
        const key = getDocumentKeyFromArchiveItem(item);
        if (key) keyToItem.set(key, item);
      }

      // Flatten annotations with document context
      const flat: AnnotationWithDoc[] = [];
      for (const [docKey, docAnnotations] of Object.entries(allAnnotations)) {
        for (const ann of docAnnotations) {
          flat.push({
            ...ann,
            documentKey: docKey,
            archiveItem: keyToItem.get(docKey),
          });
        }
      }

      setAnnotations(flat);
      setLoading(false);
    };
    load();
  }, []);

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

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    annotations.forEach(a => a.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [annotations]);

  // Get color stats
  const colorStats = useMemo(() => {
    return HIGHLIGHT_COLORS.map(color => ({
      ...color,
      count: annotations.filter(a => a.color === color.color).length,
    })).filter(c => c.count > 0);
  }, [annotations]);

  // Filter annotations
  const filteredAnnotations = useMemo(() => {
    let result = annotations;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.anchor.textContent.toLowerCase().includes(query) ||
        a.note?.toLowerCase().includes(query) ||
        a.tags?.some(t => t.toLowerCase().includes(query)) ||
        a.archiveItem?.title.toLowerCase().includes(query)
      );
    }

    if (colorFilter) {
      result = result.filter(a => a.color === colorFilter);
    }

    if (tagFilter) {
      result = result.filter(a => a.tags?.includes(tagFilter));
    }

    if (showFavoritesOnly) {
      result = result.filter(a => a.isFavorite);
    }

    return result;
  }, [annotations, searchQuery, colorFilter, tagFilter, showFavoritesOnly]);

  // Group annotations
  const groupedAnnotations = useMemo(() => {
    switch (groupBy) {
      case 'document': {
        const groups = new Map<string, AnnotationWithDoc[]>();
        for (const ann of filteredAnnotations) {
          const key = ann.documentKey;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(ann);
        }
        // Sort by document's most recent annotation
        return Array.from(groups.entries())
          .sort((a, b) => {
            const aMax = Math.max(...a[1].map(x => x.createdAt));
            const bMax = Math.max(...b[1].map(x => x.createdAt));
            return bMax - aMax;
          });
      }
      case 'date': {
        // Flat list sorted by date
        return [['all', [...filteredAnnotations].sort((a, b) => b.createdAt - a.createdAt)] as [string, AnnotationWithDoc[]]];
      }
      case 'tag': {
        const groups = new Map<string, AnnotationWithDoc[]>();
        groups.set('Untagged', []);
        for (const ann of filteredAnnotations) {
          if (!ann.tags || ann.tags.length === 0) {
            groups.get('Untagged')!.push(ann);
          } else {
            for (const tag of ann.tags) {
              if (!groups.has(tag)) groups.set(tag, []);
              groups.get(tag)!.push(ann);
            }
          }
        }
        if (groups.get('Untagged')!.length === 0) groups.delete('Untagged');
        return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
      }
    }
  }, [filteredAnnotations, groupBy]);

  // Stats
  const stats = useMemo(() => {
    const total = annotations.length;
    const withNotes = annotations.filter(a => a.note && a.note.trim()).length;
    const favorites = annotations.filter(a => a.isFavorite).length;
    const documentCount = new Set(annotations.map(a => a.documentKey)).size;
    return { total, withNotes, favorites, documentCount };
  }, [annotations]);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || colorFilter || tagFilter || showFavoritesOnly;

  // Navigate to annotation
  const handleNavigate = useCallback((ann: AnnotationWithDoc) => {
    if (ann.archiveItem) {
      onOpenDocument(ann.archiveItem, ann.id);
      onClose();
    }
  }, [onOpenDocument, onClose]);

  // Delete annotation
  const handleDelete = useCallback(async (ann: AnnotationWithDoc) => {
    if (confirmDeleteId !== ann.id) {
      setConfirmDeleteId(ann.id);
      return;
    }

    setDeletingId(ann.id);
    await deleteAnnotation(ann.documentKey, ann.id);
    setAnnotations(prev => prev.filter(a => a.id !== ann.id));
    setDeletingId(null);
    setConfirmDeleteId(null);
  }, [confirmDeleteId]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const getGroupLabel = (key: string, items: AnnotationWithDoc[]): string => {
    if (groupBy === 'document') {
      const item = items[0]?.archiveItem;
      return item?.title || 'Unknown Document';
    }
    if (groupBy === 'date') {
      return ''; // No header for date view
    }
    return key; // Tag name
  };

  const clearFilters = () => {
    setSearchQuery('');
    setColorFilter(null);
    setTagFilter(null);
    setShowFavoritesOnly(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] rounded-lg shadow-xl flex flex-col"
        style={{ backgroundColor: 'var(--reader-bg)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="All Annotations"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-reader-text/10">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-semibold">All Annotations</h2>
            {!loading && stats.total > 0 && (
              <p className="text-sm opacity-60 mt-1">
                {stats.total} highlight{stats.total !== 1 ? 's' : ''} across {stats.documentCount} document{stats.documentCount !== 1 ? 's' : ''}
                {stats.withNotes > 0 && ` · ${stats.withNotes} with notes`}
                {stats.favorites > 0 && ` · ${stats.favorites} starred`}
              </p>
            )}
          </div>
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

        {/* Filters */}
        {!loading && stats.total > 0 && (
          <div className="px-4 py-3 border-b border-reader-text/10 space-y-3">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search all annotations..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-reader-text/20 bg-transparent focus:outline-none focus:ring-1 focus:ring-reader-link"
              />
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Color filter */}
              {colorStats.length > 0 && (
                <div className="flex items-center gap-1">
                  {colorStats.map(color => (
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

              {/* Spacer */}
              <div className="flex-1" />

              {/* Group by dropdown */}
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="text-xs px-2 py-1 rounded border border-reader-text/20 bg-transparent focus:outline-none focus:ring-1 focus:ring-reader-link"
                aria-label="Group by"
              >
                <option value="document">By Document</option>
                <option value="date">By Date</option>
                <option value="tag">By Tag</option>
              </select>
            </div>

            {/* Active filter indicator */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between text-xs">
                <span className="opacity-60">
                  Showing {filteredAnnotations.length} of {stats.total}
                </span>
                <button
                  onClick={clearFilters}
                  className="text-reader-link hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}

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
              <p className="opacity-60 mb-2">No annotations yet</p>
              <p className="text-sm opacity-40">
                Select text while reading to create highlights and notes
              </p>
            </div>
          )}

          {!loading && annotations.length > 0 && filteredAnnotations.length === 0 && (
            <div className="text-center py-12 px-4">
              <svg
                className="w-12 h-12 mx-auto mb-4 opacity-30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm opacity-60 mb-2">No matching annotations</p>
              <button
                onClick={clearFilters}
                className="text-xs text-reader-link hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {!loading && filteredAnnotations.length > 0 && (
            <div>
              {groupedAnnotations.map(([key, items]) => (
                <div key={key}>
                  {/* Group header */}
                  {groupBy !== 'date' && (
                    <div className="sticky top-0 px-4 py-2 bg-reader-text/5 border-b border-reader-text/10 flex items-center gap-2">
                      {groupBy === 'document' && (
                        <svg className="w-4 h-4 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      {groupBy === 'tag' && (
                        <span className="opacity-50">#</span>
                      )}
                      <span className="text-sm font-medium truncate flex-1">
                        {getGroupLabel(key, items)}
                      </span>
                      <span className="text-xs opacity-50">
                        {items.length}
                      </span>
                    </div>
                  )}

                  {/* Annotations in group */}
                  <div className="divide-y divide-reader-text/10">
                    {items.map(ann => (
                      <div
                        key={ann.id}
                        className="p-4 hover:bg-reader-text/5 transition-colors group"
                      >
                        {/* Document title for date view */}
                        {groupBy === 'date' && ann.archiveItem && (
                          <p className="text-xs opacity-50 mb-1 truncate">
                            {ann.archiveItem.title}
                          </p>
                        )}

                        {/* Highlighted text with color indicator */}
                        <div className="flex items-start gap-2">
                          <div
                            className="w-1 min-h-[1.5rem] rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: ann.color }}
                            aria-hidden="true"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm leading-relaxed rounded px-1.5 py-0.5 -mx-1.5"
                              style={{ backgroundColor: `${ann.color}40` }}
                            >
                              "{ann.anchor.textContent}"
                            </p>
                          </div>
                        </div>

                        {/* Note content */}
                        {ann.note && ann.note.trim() && (
                          <div className="mt-2 ml-3 pl-2 border-l-2 border-reader-text/20">
                            <p className="text-sm opacity-80 whitespace-pre-wrap">
                              {ann.note}
                            </p>
                          </div>
                        )}

                        {/* Tags */}
                        {ann.tags && ann.tags.length > 0 && (
                          <div className="mt-2 ml-3 flex flex-wrap gap-1">
                            {ann.tags.map(tag => (
                              <span
                                key={tag}
                                className="text-xs px-1.5 py-0.5 rounded-full bg-reader-text/10 opacity-70"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Timestamp, star, and actions */}
                        <div className="mt-2 ml-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs opacity-50">
                              {formatDate(ann.createdAt)}
                            </span>
                            {ann.isFavorite && (
                              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {ann.archiveItem && (
                              <button
                                onClick={() => handleNavigate(ann)}
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
                            )}

                            {confirmDeleteId === ann.id ? (
                              <>
                                <button
                                  onClick={() => handleDelete(ann)}
                                  disabled={deletingId === ann.id}
                                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                  {deletingId === ann.id ? 'Deleting...' : 'Confirm'}
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
                                onClick={() => handleDelete(ann)}
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
        </div>
      </div>
    </div>
  );
}
