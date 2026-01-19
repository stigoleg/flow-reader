import { useEffect, useRef, useCallback } from 'react';
import { useReaderStore } from '../store';

/**
 * SearchBar component for in-reader document search.
 * Appears at the top of the reader when search is open.
 * Provides input field, prev/next navigation, match count, and close button.
 */
export default function SearchBar() {
  const {
    isSearchOpen,
    searchQuery,
    searchResults,
    currentSearchIndex,
    settings,
    document,
    setSearchQuery,
    nextSearchResult,
    prevSearchResult,
    closeSearch,
  } = useReaderStore();

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isSearchOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        prevSearchResult();
      } else {
        nextSearchResult();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  }, [nextSearchResult, prevSearchResult, closeSearch]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  if (!isSearchOpen) return null;

  const matchCount = searchResults.length;
  const hasResults = matchCount > 0;
  const currentMatch = hasResults ? currentSearchIndex + 1 : 0;
  
  // Get chapter info for current match (for multi-chapter books)
  const isBook = document?.book && document.book.chapters.length > 1;
  const currentMatchChapter = hasResults && currentSearchIndex >= 0
    ? searchResults[currentSearchIndex].chapterIndex
    : undefined;
  const chapterTitle = isBook && currentMatchChapter !== undefined
    ? document.book?.chapters[currentMatchChapter]?.title
    : undefined;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 px-2 pt-2 md:px-4 md:pt-3"
      role="search"
      aria-label="Search in document"
    >
      <div
        className="mx-auto rounded-xl px-3 py-2 shadow-lg md:max-w-xl flex items-center gap-2"
        style={{
          backgroundColor: settings.backgroundColor,
          border: '1px solid rgba(128, 128, 128, 0.3)',
        }}
      >
        {/* Search icon */}
        <svg
          className="w-4 h-4 opacity-50 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search in document..."
          className="flex-1 bg-transparent outline-none text-sm min-w-0"
          style={{ color: settings.textColor }}
          aria-label="Search query"
        />

        {/* Match count and chapter indicator */}
        {searchQuery && (
          <span className="text-xs opacity-60 flex-shrink-0 tabular-nums flex items-center gap-1.5">
            {hasResults ? (
              <>
                <span>{currentMatch}/{matchCount}</span>
                {chapterTitle && (
                  <span className="opacity-70 max-w-[120px] truncate" title={chapterTitle}>
                    in {chapterTitle}
                  </span>
                )}
              </>
            ) : (
              'No matches'
            )}
          </span>
        )}

        {/* Navigation buttons */}
        {hasResults && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={prevSearchResult}
              className="w-7 h-7 flex items-center justify-center rounded opacity-60 hover:opacity-100 hover:bg-black/5"
              title="Previous match (Shift+Enter)"
              aria-label="Previous match"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={nextSearchResult}
              className="w-7 h-7 flex items-center justify-center rounded opacity-60 hover:opacity-100 hover:bg-black/5"
              title="Next match (Enter)"
              aria-label="Next match"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={closeSearch}
          className="w-7 h-7 flex items-center justify-center rounded opacity-60 hover:opacity-100 hover:bg-black/5 flex-shrink-0"
          title="Close (Escape)"
          aria-label="Close search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
