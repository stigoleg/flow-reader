/**
 * TypeDropdown
 * 
 * Dropdown for filtering by content type (All, Web, PDF, Books, etc.)
 * Replaces multiple type filter chips with a single compact dropdown.
 */

import { useState, useRef } from 'react';
import type { ArchiveItem, ArchiveItemType } from '@/types';
import type { FilterType } from '../../store';
import DropdownPortal from './DropdownPortal';

interface TypeDropdownProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  items: ArchiveItem[];
}

interface FilterConfig {
  id: FilterType;
  label: string;
  types?: ArchiveItemType[];
}

const FILTERS: FilterConfig[] = [
  { id: 'all', label: 'All' },
  { id: 'web', label: 'Web', types: ['web'] },
  { id: 'pdf', label: 'PDF', types: ['pdf'] },
  { id: 'docx', label: 'Word', types: ['docx'] },
  { id: 'books', label: 'Books', types: ['epub', 'mobi'] },
  { id: 'paste', label: 'Paste', types: ['paste'] },
];

export default function TypeDropdown({
  activeFilter,
  onFilterChange,
  items,
}: TypeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Calculate counts for each filter
  const counts = FILTERS.reduce((acc, filter) => {
    if (filter.id === 'all') {
      acc[filter.id] = items.length;
    } else if (filter.types) {
      acc[filter.id] = items.filter(item => filter.types!.includes(item.type)).length;
    }
    return acc;
  }, {} as Record<FilterType, number>);

  const currentFilter = FILTERS.find(f => f.id === activeFilter) || FILTERS[0];
  const isActive = activeFilter !== 'all';

  const handleSelect = (filterId: FilterType) => {
    onFilterChange(filterId);
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`filter-dropdown-trigger ${isActive ? 'active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filter by type: ${currentFilter.label}`}
      >
        <svg 
          className="w-4 h-4 opacity-70" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" 
          />
        </svg>
        <span>{currentFilter.label}</span>
        <svg 
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <DropdownPortal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        className="filter-dropdown-menu"
      >
        {FILTERS.map(filter => {
          const count = counts[filter.id] || 0;
          const isSelected = activeFilter === filter.id;
          
          // Show all types, but with disabled styling if count is 0 (except All)
          const isEmpty = filter.id !== 'all' && count === 0;
          
          return (
            <button
              key={filter.id}
              onClick={() => !isEmpty && handleSelect(filter.id)}
              className={`filter-dropdown-item ${isSelected ? 'selected' : ''} ${isEmpty ? 'disabled' : ''}`}
              role="option"
              aria-selected={isSelected}
              disabled={isEmpty}
            >
              <span className="filter-dropdown-item-label">{filter.label}</span>
              <span className="filter-dropdown-item-count">{count}</span>
            </button>
          );
        })}
      </DropdownPortal>
    </>
  );
}
