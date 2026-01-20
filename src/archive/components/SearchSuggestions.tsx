/**
 * Search Suggestions
 * 
 * Dropdown showing search suggestions based on archive items.
 */

import { useMemo } from 'react';
import type { ArchiveItem } from '@/types';
import type { ReactNode } from 'react';

interface SearchSuggestionsProps {
  query: string;
  items: ArchiveItem[];
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

interface Suggestion {
  text: string;
  type: 'title' | 'author' | 'source';
  icon: ReactNode;
}

const MAX_SUGGESTIONS = 8;

export default function SearchSuggestions({
  query,
  items,
  onSelect,
  onClose,
}: SearchSuggestionsProps) {
  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) {
      return [];
    }

    const lowerQuery = query.toLowerCase().trim();
    const seen = new Set<string>();
    const results: Suggestion[] = [];

    // Search through items
    for (const item of items) {
      if (results.length >= MAX_SUGGESTIONS) break;

      // Title matches
      const titleLower = item.title.toLowerCase();
      if (titleLower.includes(lowerQuery) && !seen.has(item.title)) {
        seen.add(item.title);
        results.push({
          text: item.title,
          type: 'title',
          icon: (
            <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        });
      }

      // Author matches
      if (item.author && results.length < MAX_SUGGESTIONS) {
        const authorLower = item.author.toLowerCase();
        if (authorLower.includes(lowerQuery) && !seen.has(item.author)) {
          seen.add(item.author);
          results.push({
            text: item.author,
            type: 'author',
            icon: (
              <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ),
          });
        }
      }

      // Source matches
      if (results.length < MAX_SUGGESTIONS) {
        const sourceLower = item.sourceLabel.toLowerCase();
        if (sourceLower.includes(lowerQuery) && !seen.has(item.sourceLabel)) {
          seen.add(item.sourceLabel);
          results.push({
            text: item.sourceLabel,
            type: 'source',
            icon: (
              <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
              </svg>
            ),
          });
        }
      }
    }

    return results;
  }, [query, items]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div 
      className="absolute left-0 right-0 top-full mt-1 bg-[var(--reader-bg)] border border-gray-500/20 rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto"
      role="listbox"
      aria-label="Search suggestions"
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={`${suggestion.type}-${suggestion.text}-${index}`}
          onClick={() => {
            onSelect(suggestion.text);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-500/10 transition-colors"
          role="option"
        >
          {suggestion.icon}
          <span className="truncate flex-1">{suggestion.text}</span>
          <span className="text-xs opacity-40 capitalize">{suggestion.type}</span>
        </button>
      ))}
    </div>
  );
}
