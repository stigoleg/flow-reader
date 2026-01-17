/**
 * Filter Chips
 * 
 * Horizontal list of filter buttons for content types.
 */

import type { ArchiveItem, ArchiveItemType } from '@/types';
import type { FilterType } from '../store';

interface FilterChipsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  items: ArchiveItem[];
  onClearHistory: () => void;
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

export default function FilterChips({ 
  activeFilter, 
  onFilterChange,
  items,
  onClearHistory,
}: FilterChipsProps) {
  // Calculate counts for each filter
  const counts = FILTERS.reduce((acc, filter) => {
    if (filter.id === 'all') {
      acc[filter.id] = items.length;
    } else if (filter.types) {
      acc[filter.id] = items.filter(item => filter.types!.includes(item.type)).length;
    }
    return acc;
  }, {} as Record<FilterType, number>);
  
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="filter-chips overflow-x-auto">
        {FILTERS.map(filter => {
          const count = counts[filter.id] || 0;
          const isActive = activeFilter === filter.id;
          
          // Hide filters with no items (except All)
          if (filter.id !== 'all' && count === 0) {
            return null;
          }
          
          return (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={`filter-chip ${isActive ? 'active' : ''}`}
              aria-pressed={isActive}
            >
              {filter.label}
              {count > 0 && (
                <span 
                  className="ml-1.5 text-xs opacity-70"
                  style={isActive ? { opacity: 0.9 } : undefined}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {items.length > 0 && (
        <button
          onClick={onClearHistory}
          className="text-sm opacity-50 hover:opacity-100 transition-opacity whitespace-nowrap"
          aria-label="Clear all history"
        >
          Clear History
        </button>
      )}
    </div>
  );
}
