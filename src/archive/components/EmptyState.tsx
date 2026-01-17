/**
 * Empty State
 * 
 * Shown when there are no items or no search results.
 */

import { useMemo } from 'react';

interface EmptyStateProps {
  hasItems: boolean;
  hasSearch: boolean;
  hasFilter: boolean;
  onImportClick: () => void;
  onPasteClick: () => void;
}

export default function EmptyState({
  hasItems,
  hasSearch,
  hasFilter,
  onImportClick,
  onPasteClick,
}: EmptyStateProps) {
  const isMac = useMemo(() => navigator.platform.toUpperCase().includes('MAC'), []);
  const pasteShortcut = isMac ? '⌘V' : 'Ctrl+V';
  
  // No results from search/filter
  if (hasItems && (hasSearch || hasFilter)) {
    return (
      <div className="empty-state">
        <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h2 className="empty-state-title">No results found</h2>
        <p className="empty-state-description">
          Try adjusting your search or filter to find what you're looking for.
        </p>
      </div>
    );
  }
  
  // Truly empty - no items at all
  return (
    <div className="empty-state">
      <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <h2 className="empty-state-title">Your reading archive is empty</h2>
      <p className="empty-state-description">
        Import a document, paste some text, or visit a webpage and open it with FlowReader to start reading.
      </p>
      
      <div className="empty-state-actions">
        <button
          onClick={onImportClick}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ 
            backgroundColor: 'var(--reader-link)',
            color: 'white',
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Import File
        </button>
        
        <button
          onClick={onPasteClick}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ 
            backgroundColor: 'rgba(128, 128, 128, 0.1)',
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Paste Text
        </button>
      </div>
      
      <p className="text-sm opacity-50 mt-6">
        Tip: Drag and drop files anywhere on this page, or press {pasteShortcut} to paste text.
      </p>
    </div>
  );
}
