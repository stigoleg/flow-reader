/**
 * TagInput Component
 * 
 * Input for adding/removing tags with autocomplete suggestions.
 */

import { useState, useRef, useEffect } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
}

export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add tag...',
  maxTags = 10,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input and exclude already-selected tags
  const filteredSuggestions = suggestions.filter(
    s => 
      s.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(s)
  ).slice(0, 5);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed]);
      setInputValue('');
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        addTag(filteredSuggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Don't allow commas - treat them as tag separators
    if (value.includes(',')) {
      const parts = value.split(',');
      parts.forEach(part => {
        if (part.trim()) addTag(part);
      });
      return;
    }
    setInputValue(value);
    setShowSuggestions(value.length > 0);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 border border-reader-text/20 rounded-lg bg-reader-bg min-h-[2.5rem]">
        {/* Existing tags */}
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-reader-text/10"
          >
            #{tag}
            <button
              onClick={() => removeTag(tag)}
              className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-reader-text/20 transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        
        {/* Input */}
        {tags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue && setShowSuggestions(true)}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-sm"
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div 
          className="absolute left-0 right-0 top-full mt-1 rounded-lg shadow-lg border border-reader-text/10 overflow-hidden z-50"
          style={{ backgroundColor: 'var(--reader-bg)' }}
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              onClick={() => addTag(suggestion)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                index === highlightedIndex ? 'bg-reader-text/10' : 'hover:bg-reader-text/5'
              }`}
            >
              #{suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
