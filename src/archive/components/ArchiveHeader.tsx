/**
 * Archive Header
 * 
 * Matches the reader's TopBar design with a floating rounded container.
 * Contains FlowReader title, search field, and settings button.
 */

import { RefObject, useState, useEffect } from 'react';
import type { ReaderSettings, ArchiveItem } from '@/types';
import type { ViewMode } from '../store';
import SearchSuggestions from './SearchSuggestions';

interface ArchiveHeaderProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  viewMode: ViewMode;
  items: ArchiveItem[];
  onSearchChange: (query: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onImportClick: () => void;
  onPasteClick: () => void;
  onSettingsClick: () => void;
  onStatsClick: () => void;
  onAllAnnotationsClick: () => void;
  settings: ReaderSettings;
}

export default function ArchiveHeader({
  searchInputRef,
  searchQuery,
  viewMode,
  items,
  onSearchChange,
  onViewModeChange,
  onImportClick,
  onPasteClick,
  onSettingsClick,
  onStatsClick,
  onAllAnnotationsClick,
  settings,
}: ArchiveHeaderProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Close suggestions on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchChange = (value: string) => {
    onSearchChange(value);
    setShowSuggestions(value.length >= 2);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    onSearchChange(suggestion);
    setShowSuggestions(false);
  };
  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-2 pt-2 md:px-4 md:pt-3" role="banner">
      <div
        className="mx-auto rounded-xl px-3 py-2 shadow-lg md:max-w-4xl md:px-4"
        style={{
          backgroundColor: settings.backgroundColor,
          border: '1px solid rgba(128, 128, 128, 0.2)',
        }}
      >
        <div className="flex items-center gap-3 md:gap-4">
          {/* Logo/Title - hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <svg 
              className="w-5 h-5" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
              style={{ color: settings.linkColor }}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" 
              />
            </svg>
            <span className="text-sm font-medium opacity-80">FlowReader</span>
          </div>

          {/* Search field - grows to fill space */}
          <div className="relative flex-1 search-container">
            <svg 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-50 pointer-events-none z-10" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
              placeholder="Search archive..."
              className="w-full py-2 pl-9 pr-8 text-sm rounded-lg bg-black/5 border-0 focus:outline-none focus:ring-2 transition-shadow"
              style={{
                '--tw-ring-color': settings.linkColor,
              } as React.CSSProperties}
              aria-label="Search archive"
              aria-haspopup="listbox"
              aria-expanded={showSuggestions}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  onSearchChange('');
                  setShowSuggestions(false);
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded opacity-50 hover:opacity-100 z-10"
                aria-label="Clear search"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            
            {/* Search suggestions */}
            {showSuggestions && (
              <SearchSuggestions
                query={searchQuery}
                items={items}
                onSelect={handleSuggestionSelect}
                onClose={() => setShowSuggestions(false)}
              />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 md:gap-2" role="toolbar" aria-label="Archive controls">
            {/* View mode toggle */}
            <div className="hidden md:flex items-center rounded-lg bg-black/5 p-0.5">
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                title="List view"
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => onViewModeChange('grid')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                title="Grid view"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>

            {/* Paste - desktop only */}
            <button
              onClick={onPasteClick}
              className="hidden md:flex w-8 h-8 items-center justify-center rounded opacity-60 hover:opacity-100"
              title="Paste text"
              aria-label="Paste text"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>

            {/* Import */}
            <button
              onClick={onImportClick}
              className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded opacity-60 hover:opacity-100"
              title="Import file"
              aria-label="Import file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </button>

            {/* Statistics */}
            <button
              onClick={onStatsClick}
              className="hidden md:flex w-8 h-8 items-center justify-center rounded opacity-60 hover:opacity-100"
              title="Reading statistics"
              aria-label="View reading statistics"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* All Annotations */}
            <button
              onClick={onAllAnnotationsClick}
              className="hidden md:flex w-8 h-8 items-center justify-center rounded opacity-60 hover:opacity-100"
              title="All annotations"
              aria-label="View all annotations"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </button>

            {/* Settings */}
            <button
              onClick={onSettingsClick}
              className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded opacity-60 hover:opacity-100"
              title="Settings"
              aria-label="Open settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
